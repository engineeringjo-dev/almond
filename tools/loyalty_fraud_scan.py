#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# loyalty_fraud_scan.py — READ-ONLY loyalty ABUSE SCAN of the LIVE Odoo 19 database — Almond
# ==========================================================================================
# WHY THIS EXISTS
#   The loyalty proposal contains no fraud section at all. Almond runs 3,238 invoices/day
#   across 8 branches and identifies members by PHONE NUMBER read out at the till. That
#   combination — a fallback identifier the cashier can type, a points balance worth real
#   money, and no OTP — is the textbook cashier self-crediting vector: the cashier attaches
#   an unclaimed sale to a phone number they control. It leaks silently, it compounds, and
#   it is invisible in every revenue report because the sale itself is genuine.
#
#   This script does not argue that fraud exists. It MEASURES the patterns that fraud
#   produces, ranks them, and prices them in JOD. Every number it prints is read from the
#   live database or derived, in the open, from something it read. It invents nothing:
#   where a value cannot be measured it prints UNAVAILABLE and says what is missing.
#
# WHAT IT DETECTS (7 detectors; each prints WHAT IT FLAGS / THE RULE / TOP OFFENDERS / JOD AT RISK)
#   D1 SELF-CREDITING     Members whose earning orders concentrate on one cashier far beyond
#                         chance (exact binomial tail against that cashier's own share of
#                         traffic at the branches the member actually uses, Bonferroni-corrected).
#   D2 IMPOSSIBLE PATTERN Members earning on orders they plausibly did not make: too many
#                         orders in one local day, two earning orders at DIFFERENT branches
#                         within minutes, near-duplicate orders seconds apart, and earning
#                         outside the member's own established hour/branch pattern.
#   D3 STAFF ACCOUNTS     Loyalty cards held by partners who are also employees or internal
#                         users — permitted or not, they must be a known, listed population.
#   D4 VELOCITY           Cards earning above a per-day point threshold, and cards that
#                         redeem immediately after almost every earn (burn-on-sight).
#   D5 REFUND ABUSE       Orders refunded AFTER points were issued, where the points were
#                         never clawed back. This one is an EXACT leak, in JOD.
#   D6 SHARED IDENTITY    One phone or one partner spread across many branches or many
#                         distinct payment methods; and one phone number attached to several
#                         partner records (the fallback-ID collision).
#   D7 POINT SPIKES       loyalty.history entries whose points do not match order amount x
#                         program rate — wrong rule, manual adjustment, or tampering — plus
#                         every history row with NO order behind it, grouped by who created it.
#
#   Then: a combined per-member ranking, a JOD-at-risk summary that says where the numbers
#   overlap, and a DAILY REPORT SPEC for the monitoring that must run from launch day.
#
# SAFETY (non-negotiable, enforced in code — see SAFE_METHODS / Odoo.rpc)
#   • READ-ONLY. The RPC wrapper refuses any method not on the read-only allow-list. There is
#     no create/write/unlink/button_* anywhere in this file and no escape hatch.
#   • No APPROVE PROD token is needed precisely because nothing is written. Safe to re-run,
#     safe to schedule, safe to run during trading hours (it is read traffic only).
#   • PRIVACY. This report is about people. Names and phones are MASKED by default and each
#     subject gets a stable pseudonymous token (P-xxxxxx) derived from the database name, so
#     the same person keeps the same token across daily runs without the report carrying PII.
#     --reveal adds record ids and full identifiers and is for the named investigator only.
#
# WHERE IT RUNS
#   NOT from the dev container (the egress proxy blocks *.odoo.com). Run it from a machine
#   that can reach the Odoo host, exactly like the other tools in this repo.
#
#     export ODOO_URL=https://ag-almond-coffee-house.odoo.com
#     export ODOO_DB=ag-almond-coffee-house-master1-29151411
#     export ODOO_LOGIN=you@almond.jo
#     export ODOO_API_KEY=xxxxxxxx
#     python3 tools/loyalty_fraud_scan.py                      # last 30 days, full report
#     python3 tools/loyalty_fraud_scan.py --days 90
#     python3 tools/loyalty_fraud_scan.py --days 1 --only d1,d2,d4,d5   # the daily job (= yesterday)
#     python3 tools/loyalty_fraud_scan.py --json scan.json     # machine-readable evidence
#     python3 tools/loyalty_fraud_scan.py --reveal             # PII on, for the investigator
#   Credentials may also come from $SCRATCH/.odoo_env (house format: `export KEY=value`).
#
# HOW TO READ THE OUTPUT
#   A FLAG IS NOT A VERDICT. Every detector here is a screen, not a finding: it says "this
#   pattern is unlikely to be innocent, look at it". A concentrated cashier can be the only
#   person on the morning shift at the branch below the member's office. Investigate before
#   accusing. What the script guarantees is that the screen is calibrated against the data,
#   not against a guess: next to every threshold it prints the MEASURED distribution of the
#   quantity it is thresholding, so the reviewer can see whether the cut is in the tail or
#   in the body of normal behaviour.
#   Labels used throughout:
#     EXACT      counted or summed directly from the database over the stated domain
#     DERIVED    arithmetic on EXACT values plus a config value itself read from the database
#     ESTIMATE   a statistical statement with sampling error, stated
#     ASSUMPTION an input that could NOT be read from the database (it is named, with its effect)
#     THRESHOLD  a policy choice, not a measurement (it is printed, with the distribution)
#
# VERSION ROBUSTNESS
#   Odoo moves loyalty and POS fields between versions and Odoo 19 changed the grouping API.
#   Every field is introspected with fields_get before use; a missing field or model degrades
#   ONE detector to UNAVAILABLE with a reason and the rest of the report still prints.
#
# EXIT CODES
#   0  report produced (possibly with UNAVAILABLE detectors)
#   2  could not connect / authenticate  (nothing printed as fact)
#   3  connected, but there is no POS or loyalty data in the window to scan
# ==========================================================================================

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import time
import xmlrpc.client
from collections import defaultdict
from datetime import datetime, timedelta

SCRIPT_VERSION = "1.0.0"

# --------------------------------------------------------------------------------- tunables
# Jordan has been on permanent UTC+3 since 2022 (no DST). Odoo stores date_order in UTC, so
# "orders in one local day" must be bucketed after shifting. Override with --tz-offset.
DEFAULT_TZ_OFFSET_HOURS = 3.0

# POS states that represent settled trade. Refunds are negative-value orders in these same
# states and are deliberately KEPT (detector D5 is entirely about them).
SALE_STATES = ["paid", "done", "invoiced"]

BATCH = 2000            # rows per search_read round-trip
MAX_ROWS = 400_000      # hard ceiling on rows pulled for local aggregation

# Only these methods may cross the wire. Anything else raises before it is sent.
SAFE_METHODS = {
    "search", "search_read", "search_count", "read", "fields_get",
    "read_group", "formatted_read_group", "web_read_group",
    "default_get", "check_access_rights",
}

# Cashier identity: probed in this order. POS in employee mode stamps employee_id; otherwise
# the session user lands on user_id. Which one was used is printed in the report header.
CASHIER_FIELDS = ("employee_id", "user_id")

EV: dict = {}   # evidence registry — every detector writes here; --json dumps it


# ================================================================================= plumbing
def load_env() -> dict:
    """Credentials from the environment, or $SCRATCH/.odoo_env / $ODOO_ENV_FILE
    (house format: `export KEY=value`). The API key is never printed or written back."""
    env = {}
    path = os.environ.get("ODOO_ENV_FILE")
    if not path:
        scratch = os.environ.get("SCRATCH", "")
        if scratch:
            path = os.path.join(scratch, ".odoo_env")
    if path and os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as fh:
                for ln in fh:
                    ln = ln.strip()
                    if not ln or ln.startswith("#") or "=" not in ln:
                        continue
                    ln = ln.replace("export ", "", 1)
                    k, v = ln.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
        except OSError as exc:
            sys.exit("ABORT: cannot read %s: %s" % (path, exc))
    for k in ("ODOO_URL", "ODOO_DB", "ODOO_LOGIN", "ODOO_API_KEY"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    missing = [k for k in ("ODOO_URL", "ODOO_DB", "ODOO_LOGIN", "ODOO_API_KEY") if not env.get(k)]
    if missing:
        sys.exit(
            "ABORT: missing credentials %s.\n"
            "  Provide them in the environment or in $SCRATCH/.odoo_env (export KEY=value).\n"
            "  This script is READ-ONLY; a read-scoped API key is enough. It still needs a login."
            % ", ".join(missing))
    env["ODOO_URL"] = env["ODOO_URL"].rstrip("/")
    return env


class Odoo:
    """Minimal read-only XML-RPC client (stdlib only): retries, a method allow-list,
    field introspection, and paged reads. There is no write path in this class."""

    def __init__(self, env: dict):
        self.env = env
        self.calls = 0
        try:
            common = xmlrpc.client.ServerProxy(env["ODOO_URL"] + "/xmlrpc/2/common")
            self.uid = common.authenticate(env["ODOO_DB"], env["ODOO_LOGIN"], env["ODOO_API_KEY"], {})
        except Exception as exc:                                   # network / DNS / TLS / proxy
            sys.exit("ABORT: cannot reach %s — %s: %s\n"
                     "  If you are running inside the dev container this is expected: the egress\n"
                     "  proxy blocks *.odoo.com. Run this from a host that can reach Odoo."
                     % (env["ODOO_URL"], type(exc).__name__, exc))
        if not self.uid:
            sys.exit("ABORT: authentication refused for %s on db %s (check ODOO_API_KEY)."
                     % (env["ODOO_LOGIN"], env["ODOO_DB"]))
        self.models = xmlrpc.client.ServerProxy(env["ODOO_URL"] + "/xmlrpc/2/object")
        self._fields_cache: dict = {}
        self.ctx = {"active_test": False}     # see archived programs/cards too

    def rpc(self, model: str, method: str, args: list, kw: dict | None = None, tries: int = 4):
        if method not in SAFE_METHODS:
            raise RuntimeError("BLOCKED: %s.%s is not a read-only method. This script never "
                               "writes to production." % (model, method))
        kw = dict(kw or {})
        kw.setdefault("context", dict(self.ctx))
        for attempt in range(tries):
            try:
                self.calls += 1
                return self.models.execute_kw(self.env["ODOO_DB"], self.uid,
                                              self.env["ODOO_API_KEY"], model, method, args, kw)
            except (xmlrpc.client.Fault, xmlrpc.client.ProtocolError, OSError) as exc:
                s = str(exc)
                if "cannot marshal None" in s:
                    return None
                transient = ("503" in s or "504" in s or "Connection" in s or "timed out" in s)
                if transient and attempt < tries - 1:
                    time.sleep(3 * (attempt + 1))
                    continue
                raise

    # ---- introspection ---------------------------------------------------------------
    def fields(self, model: str) -> dict:
        """fields_get, cached. Empty dict (with a printed note) if the model is absent here."""
        if model in self._fields_cache:
            return self._fields_cache[model]
        try:
            got = self.rpc(model, "fields_get", [[]], {"attributes": ["type", "string", "relation"]}) or {}
        except Exception as exc:
            got = {}
            warn("model %s is not readable here (%s) — detectors that need it will say so."
                 % (model, str(exc)[:110]))
        self._fields_cache[model] = got
        return got

    def has(self, model: str, field: str) -> bool:
        return field in self.fields(model)

    def pick(self, model: str, wanted: list) -> tuple:
        """Split `wanted` into (present, absent) for THIS deployment. Never guess a field."""
        f = self.fields(model)
        return [w for w in wanted if w in f], [w for w in wanted if w not in f]

    # ---- bulk reads ------------------------------------------------------------------
    def read_all(self, model: str, domain: list, fields_: list, order: str | None = None,
                 cap: int = MAX_ROWS, label: str = "") -> tuple:
        """Paged search_read. Returns (rows, truncated). A truncated read is reported by the
        caller: a truncated sum is a LOWER BOUND, never presented as a total."""
        out, offset = [], 0
        while True:
            lim = min(BATCH, max(1, cap - len(out)))
            kw = {"limit": lim, "offset": offset}
            if order:
                kw["order"] = order
            chunk = self.rpc(model, "search_read", [domain, fields_], kw) or []
            out.extend(chunk)
            if len(chunk) < lim or len(out) >= cap:
                return out, len(out) >= cap
            offset += len(chunk)

    def read_ids(self, model: str, ids: list, fields_: list) -> list:
        out = []
        ids = list(ids)
        for i in range(0, len(ids), BATCH):
            out.extend(self.rpc(model, "read", [ids[i:i + BATCH]], {"fields": fields_}) or [])
        return out

    def count(self, model: str, domain: list):
        try:
            return self.rpc(model, "search_count", [domain])
        except Exception as exc:
            warn("search_count on %s failed: %s" % (model, str(exc)[:110]))
            return None


# ================================================================================= printing
_W = 96


def head(question: str, title: str) -> None:
    print("\n" + "=" * _W)
    print("QUESTION: " + question)
    print("DETECTOR: " + title)
    print("=" * _W)


def sub(text: str) -> None:
    print("\n-- %s %s" % (text, "-" * max(0, _W - len(text) - 4)))


def kv(key: str, value) -> None:
    print("   %-40s %s" % (key + ":", value))


def bullet(text: str) -> None:
    for i, line in enumerate(wrap(text, _W - 6)):
        print(("   * " if i == 0 else "     ") + line)


def warn(text: str) -> None:
    for i, line in enumerate(wrap(text, _W - 8)):
        print(("   [!] " if i == 0 else "       ") + line)


def gap(text: str) -> None:
    """A field/model this deployment does not have. A gap is a finding, not an error."""
    for i, line in enumerate(wrap(text, _W - 10)):
        print(("   [GAP] " if i == 0 else "         ") + line)


def derive(text: str) -> None:
    for i, line in enumerate(wrap(text, _W - 14)):
        print(("   [DERIVED] " if i == 0 else "             ") + line)


def rule(text: str) -> None:
    """The exact decision rule of a detector, printed so it can be argued with."""
    for i, line in enumerate(wrap(text, _W - 11)):
        print(("   [RULE] " if i == 0 else "          ") + line)


def flags(text: str) -> None:
    for i, line in enumerate(wrap(text, _W - 12)):
        print(("   [FLAGS] " if i == 0 else "           ") + line)


def wrap(text: str, width: int) -> list:
    words, lines, cur = str(text).split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        lines.append(cur)
    return lines or [""]


def fmt(x, nd: int = 2):
    if x is None:
        return "—"
    if isinstance(x, bool):
        return "yes" if x else "no"
    if isinstance(x, float):
        return ("%%.%df" % nd) % x
    return x


def m2o_id(v):
    """[id, name] -> id ; False -> None."""
    if isinstance(v, (list, tuple)) and v:
        return v[0]
    return None


def m2o_name(v):
    if isinstance(v, (list, tuple)) and len(v) > 1:
        return v[1]
    return None


def table(rows: list, headers: list, aligns: str = "") -> None:
    """Fixed-width table. Long cells are truncated, never wrapped, so columns stay readable."""
    if not rows:
        print("   (no rows)")
        return
    cols = len(headers)
    widths = [len(str(h)) for h in headers]
    cells = []
    for r in rows:
        row = [("" if c is None else str(c)) for c in r] + [""] * (cols - len(r))
        cells.append(row[:cols])
        for i, c in enumerate(row[:cols]):
            widths[i] = max(widths[i], len(c))
    budget = _W - 3 - 2 * (cols - 1)
    while sum(widths) > budget:
        widths[widths.index(max(widths))] -= 1
    aligns = (aligns + "l" * cols)[:cols]

    def cut(s, w):
        return s if len(s) <= w else (s[:max(0, w - 1)] + "…")

    def lay(row):
        return "   " + "  ".join(
            (cut(c, widths[i]).rjust(widths[i]) if aligns[i] == "r" else cut(c, widths[i]).ljust(widths[i]))
            for i, c in enumerate(row))

    print(lay([str(h) for h in headers]))
    print("   " + "  ".join("-" * w for w in widths))
    for row in cells:
        print(lay(row))


# ================================================================================= maths
def pctl(sorted_vals: list, p: float):
    """Linear-interpolated percentile of an ALREADY SORTED list."""
    if not sorted_vals:
        return None
    if len(sorted_vals) == 1:
        return float(sorted_vals[0])
    k = (len(sorted_vals) - 1) * (p / 100.0)
    lo, hi = math.floor(k), math.ceil(k)
    if lo == hi:
        return float(sorted_vals[int(k)])
    return float(sorted_vals[lo]) * (hi - k) + float(sorted_vals[hi]) * (k - lo)


def distribution_line(vals: list, label: str, nd: int = 2) -> None:
    """Print the MEASURED distribution of the quantity a threshold cuts. This is what makes a
    threshold arguable instead of arbitrary: you can see whether it sits in the tail."""
    if not vals:
        kv("measured distribution of " + label, "no observations")
        return
    s = sorted(vals)
    kv("measured distribution of " + label,
       "n=%d  p50=%s  p90=%s  p99=%s  p99.9=%s  max=%s"
       % (len(s), fmt(pctl(s, 50), nd), fmt(pctl(s, 90), nd), fmt(pctl(s, 99), nd),
          fmt(pctl(s, 99.9), nd), fmt(float(s[-1]), nd)))


def log_binom_pmf(k: int, n: int, p: float) -> float:
    return (math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)
            + k * math.log(p) + (n - k) * math.log1p(-p))


def binom_sf(k: int, n: int, p: float) -> float:
    """P(X >= k) for X ~ Binomial(n, p), summed in log space (stdlib only, no scipy).

    This is the engine of D1: it converts "this cashier served 41 of this member's 44 orders"
    into "the chance of that happening if the till assignment were random is 1e-23", which is
    what makes the flag defensible rather than a hunch."""
    if k <= 0:
        return 1.0
    if p <= 0.0:
        return 0.0
    if p >= 1.0:
        return 1.0
    if k > n:
        return 0.0
    terms = [log_binom_pmf(i, n, p) for i in range(k, n + 1)]
    mx = max(terms)
    return math.exp(mx + math.log(sum(math.exp(t - mx) for t in terms)))


def neg_log10(p: float) -> float:
    if p <= 0.0:
        return 300.0
    return -math.log10(p)


# ================================================================================= masking
class Masker:
    """Pseudonymous, stable, non-reversible-without-the-db-name subject tokens.

    Why not just print names: this report is circulated to branch managers and it accuses
    people. Why a STABLE token: the daily monitoring report has to be able to say "P-7f3a91
    is back for the fourth day running", which a random id cannot do. The salt defaults to the
    database name, so tokens are consistent across runs on the same database and meaningless
    outside it. Override with ALMOND_SCAN_SALT to make them meaningless inside it too."""

    def __init__(self, salt: str, reveal: bool):
        self.salt = salt
        self.reveal = reveal

    def token(self, kind: str, rec_id) -> str:
        h = hashlib.sha256(("%s|%s|%s" % (self.salt, kind, rec_id)).encode("utf-8")).hexdigest()
        return "%s-%s" % (kind, h[:6])

    def name(self, name) -> str:
        if self.reveal:
            return str(name or "—")
        s = re.sub(r"\s+", " ", str(name or "")).strip()
        if not s:
            return "(no name)"
        parts = []
        for w in s.split(" ")[:2]:
            parts.append(w[0] + "*" * max(1, len(w) - 1) if len(w) > 1 else w)
        return " ".join(parts)

    def phone(self, phone) -> str:
        d = re.sub(r"\D", "", str(phone or ""))
        if not d:
            return "(no phone)"
        if self.reveal:
            return str(phone)
        return "*" * max(0, len(d) - 3) + d[-3:]

    def subject(self, kind: str, rec_id, name=None, phone=None) -> str:
        """The identifier printed in every offender table."""
        base = self.token(kind, rec_id)
        bits = [base]
        if name is not None:
            bits.append(self.name(name))
        if phone is not None:
            bits.append(self.phone(phone))
        if self.reveal:
            bits.append("id=%s" % rec_id)
        return " ".join(bits)


def normalise_phone(raw) -> str:
    """Jordan-aware normalisation so '0791234567', '+962791234567' and '00962 79 123 4567'
    collapse to ONE identity. This matters: the phone IS the fallback identifier, so any
    detector that keys on it must key on the same normalisation the till effectively uses."""
    d = re.sub(r"\D", "", str(raw or ""))
    if not d:
        return ""
    if d.startswith("00962"):
        d = d[5:]
    elif d.startswith("962"):
        d = d[3:]
    if d.startswith("0"):
        d = d[1:]
    return d


# ================================================================================= context
class Ctx:
    """Everything the detectors share: connection, capabilities, window, loaded data,
    the point value, the risk register, and the argument namespace."""

    def __init__(self, odoo, args, mask):
        self.o = odoo
        self.args = args
        self.mask = mask
        self.caps = {}
        self.point_value = None
        self.point_value_meta = {}
        self.program_rate = {}          # program_id -> points per currency unit
        self.orders = []                # pos.order rows in window
        self.orders_by_id = {}
        self.by_partner = defaultdict(list)
        self.cashier_field = None
        self.branch_field = None
        self.cards = {}                 # card_id -> row
        self.cards_by_partner = defaultdict(list)
        self.history = []               # loyalty.history rows in window
        self.hist_by_card = defaultdict(list)
        self.hist_by_order = defaultdict(list)
        self.partners = {}              # partner_id -> row
        self.truncated = []
        self.risk = defaultdict(list)   # partner_id -> [(detector, jod, note)]
        self.detector_jod = {}          # detector -> JOD at risk

    # -- risk register ---------------------------------------------------------------
    def add_risk(self, partner_id, detector: str, jod_amount: float, note: str) -> None:
        if partner_id is None:
            return
        self.risk[partner_id].append((detector, float(jod_amount or 0.0), note))

    def subject_for_partner(self, pid) -> str:
        p = self.partners.get(pid) or {}
        return self.mask.subject("P", pid, p.get("name"), p.get("phone") or p.get("mobile"))

    def points_to_jod(self, points) -> float:
        return float(points or 0.0) * float(self.point_value or 0.0)


# ================================================================================= window
def resolve_window(args):
    """Return (utc_start, utc_end, local_start, local_end, days).

    The window is expressed in LOCAL (Amman) calendar dates but Odoo stores date_order in
    UTC, so the boundaries are shifted. Getting this wrong silently moves a whole evening
    peak between windows, so the shift is printed in the header. End is EXCLUSIVE."""
    off = timedelta(hours=args.tz_offset)
    if args.date_from or args.date_to:
        if not (args.date_from and args.date_to):
            sys.exit("ABORT: --from and --to must be given together (or use --days).")
        try:
            l_start = datetime.strptime(args.date_from, "%Y-%m-%d")
            l_end = datetime.strptime(args.date_to, "%Y-%m-%d")
        except ValueError:
            sys.exit("ABORT: --from/--to must be YYYY-MM-DD.")
    else:
        l_end = (datetime.utcnow() + off).replace(hour=0, minute=0, second=0, microsecond=0)
        if args.include_today:
            l_end += timedelta(days=1)
        l_start = l_end - timedelta(days=args.days)
    if l_end <= l_start:
        sys.exit("ABORT: empty window (--to must be after --from).")
    u_start = (l_start - off).strftime("%Y-%m-%d %H:%M:%S")
    u_end = (l_end - off).strftime("%Y-%m-%d %H:%M:%S")
    return u_start, u_end, l_start, l_end, (l_end - l_start).days


def parse_dt(s):
    if not s:
        return None
    try:
        return datetime.strptime(str(s)[:19], "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None


def local_day(dt_utc, off_hours: float) -> str:
    return (dt_utc + timedelta(hours=off_hours)).strftime("%Y-%m-%d")


def local_hour(dt_utc, off_hours: float) -> int:
    return (dt_utc + timedelta(hours=off_hours)).hour


# ================================================================= capabilities + config
def detect_capabilities(ctx: Ctx) -> None:
    """Ask the database what it actually has. Every detector reads these flags instead of
    assuming a module is installed. Nothing here writes or installs anything."""
    o, caps = ctx.o, ctx.caps
    po = o.fields("pos.order")
    if not po:
        sys.exit("ABORT: pos.order is not readable. Is POS installed, and does this user have\n"
                 "  read access? Nothing in this scan can be measured without it.")
    caps["pos_order_fields"] = sorted(po)
    for f in CASHIER_FIELDS:
        if f in po:
            ctx.cashier_field = f
            break
    ctx.branch_field = "branch_id" if "branch_id" in po else ("config_id" if "config_id" in po else None)
    caps["has_loyalty"] = bool(o.fields("loyalty.card"))
    caps["has_history"] = bool(o.fields("loyalty.history"))
    caps["has_pos_payment"] = bool(o.fields("pos.payment"))
    caps["has_hr_employee"] = bool(o.fields("hr.employee"))
    caps["has_res_users"] = bool(o.fields("res.users"))
    caps["refund_link_field"] = next(
        (f for f in ("refunded_order_id", "refunded_order_ids", "refund_orders_count") if f in po), None)
    caps["has_refund_line_link"] = o.has("pos.order.line", "refunded_orderline_id")
    caps["history_fields"] = sorted(o.fields("loyalty.history")) if caps["has_history"] else []
    caps["card_fields"] = sorted(o.fields("loyalty.card")) if caps["has_loyalty"] else []

    sub("capability probe (fields_get before anything is read)")
    kv("cashier identity field", ctx.cashier_field or "NONE — D1 cannot run")
    kv("branch key", ("pos.order.branch_id (almond_branch installed)" if ctx.branch_field == "branch_id"
                      else "pos.config (per TILL, not per physical branch)" if ctx.branch_field
                      else "NONE"))
    kv("loyalty.card / loyalty.history", "%s / %s" % (caps["has_loyalty"], caps["has_history"]))
    kv("pos.payment readable", caps["has_pos_payment"])
    kv("hr.employee readable", caps["has_hr_employee"])
    kv("POS refund linkage", caps["refund_link_field"] or
       ("pos.order.line.refunded_orderline_id" if caps["has_refund_line_link"] else "NONE — D5 degrades"))
    if ctx.branch_field == "config_id":
        warn("almond_branch is not installed here, so 'branch' below means POS SHOP. Two tills "
             "in one shop will look like two branches and D2's cross-branch test will produce "
             "false positives. Read that detector accordingly.")


def derive_point_value(ctx: Ctx) -> None:
    """Determine JOD per point FROM THE DATABASE. Every JOD figure in this report is
    points x this number, so it is derived before anything else and its exactness is carried
    into every total.

    Odoo encodes it: discount_mode 'per_point' -> `discount` IS currency per point;
    'per_order' -> discount / required_points. The owner's verbal claim is 1 qirsh (0.01 JOD);
    that claim is VERIFIED or REFUTED here, never assumed."""
    o = ctx.o
    meta = {"observations": [], "value": None, "basis": None, "exactness": None}
    if not o.fields("loyalty.reward"):
        meta.update({"value": ctx.args.point_value, "basis": "--point-value CLI input "
                     "(loyalty.reward not readable)", "exactness": "ASSUMPTION"})
    else:
        present, _ = o.pick("loyalty.reward", ["program_id", "description", "reward_type",
                                               "required_points", "discount", "discount_mode"])
        rewards, _ = o.read_all("loyalty.reward", [], present + ["id"])
        per_point = []
        for w in rewards:
            rp = float(w.get("required_points") or 0.0)
            disc = float(w.get("discount") or 0.0)
            mode, rtype = w.get("discount_mode"), w.get("reward_type")
            val = None
            if rtype == "discount" and mode == "per_point" and disc:
                val = disc
            elif rtype == "discount" and mode == "per_order" and rp:
                val = disc / rp
            if val:
                per_point.append(val)
            meta["observations"].append({"reward_id": w.get("id"), "description": w.get("description"),
                                         "reward_type": rtype, "discount_mode": mode,
                                         "implied_jod_per_point": val})
        if per_point:
            per_point.sort()
            meta.update({"value": pctl(per_point, 50),
                         "basis": "median of %d cash-discount reward(s) in loyalty.reward" % len(per_point),
                         "exactness": "EXACT (read from loyalty.reward configuration)",
                         "spread": {"min": per_point[0], "max": per_point[-1]}})
        else:
            meta.update({"value": ctx.args.point_value,
                         "basis": "--point-value CLI input; no cash-discount reward with a "
                                  "derivable per-point value exists in loyalty.reward",
                         "exactness": "ASSUMPTION (not measurable from configuration)"})
    ctx.point_value = meta["value"]
    ctx.point_value_meta = meta
    sub("point value (the JOD multiplier under every number below)")
    kv("JOD per point", fmt(ctx.point_value, 4))
    kv("basis", meta["basis"])
    kv("exactness", meta["exactness"])
    if meta["value"] is not None:
        if abs(meta["value"] - 0.01) < 1e-9 and meta["exactness"].startswith("EXACT"):
            derive("The owner's verbal claim '1 point = 1 qirsh' is VERIFIED by the configuration.")
        elif meta["exactness"].startswith("EXACT"):
            derive("The owner's verbal claim '1 point = 1 qirsh (0.01 JOD)' is REFUTED: the "
                   "configuration says %.4f JOD per point. Every JOD figure below uses the "
                   "configured value, not the claim." % meta["value"])
        else:
            warn("Point value could NOT be read from configuration; %.4f JOD/point is an "
                 "ASSUMPTION from --point-value. Every JOD figure below scales linearly with "
                 "it: if the real value is double, every JOD-at-risk number doubles."
                 % meta["value"])
    # earn rate per program, for D7
    if o.fields("loyalty.rule"):
        present, _ = o.pick("loyalty.rule", ["program_id", "reward_point_amount", "reward_point_mode",
                                             "minimum_amount", "mode"])
        rules, _ = o.read_all("loyalty.rule", [], present + ["id"])
        for r in rules:
            if r.get("reward_point_mode") == "money" and r.get("reward_point_amount"):
                pid = m2o_id(r.get("program_id"))
                if pid:
                    ctx.program_rate.setdefault(pid, []).append(float(r["reward_point_amount"]))
        kv("programs with a money-mode earn rate", len(ctx.program_rate) or "none found")
    EV["point_value"] = meta
    EV["program_rate"] = {str(k): v for k, v in ctx.program_rate.items()}


# ================================================================================= loading
def load_data(ctx: Ctx, u_start: str, u_end: str) -> None:
    """One bulk read of each model the detectors share. Volume note: Almond runs ~3,238
    invoices/day, so a 30-day window is ~97k pos.order rows and a 90-day window ~291k — near
    the MAX_ROWS ceiling. If a read truncates, it is recorded and every total derived from it
    is printed as a LOWER BOUND."""
    o = ctx.o
    sub("bulk read (window %s .. %s UTC)" % (u_start, u_end))

    want = ["date_order", "partner_id", "amount_total", "amount_tax", "amount_paid", "state",
            "name", "session_id", "config_id", "branch_id", "employee_id", "user_id"]
    if ctx.caps.get("refund_link_field"):
        want.append(ctx.caps["refund_link_field"])
    present, _ = o.pick("pos.order", want)
    dom = [("date_order", ">=", u_start), ("date_order", "<", u_end), ("state", "in", SALE_STATES)]
    ctx.orders, trunc = o.read_all("pos.order", dom, present + ["id"], order="id", label="pos.order")
    if trunc:
        ctx.truncated.append("pos.order")
        warn("pos.order read hit the %d-row ceiling. Every count and sum from orders below is a "
             "LOWER BOUND. Re-run with a shorter --days." % MAX_ROWS)
    kv("pos.order rows in window", len(ctx.orders))
    if not ctx.orders:
        print("\nNo settled POS orders in this window. Nothing to scan.")
        raise SystemExit(3)

    for r in ctx.orders:
        r["_dt"] = parse_dt(r.get("date_order"))
        r["_pid"] = m2o_id(r.get("partner_id"))
        r["_cashier"] = m2o_id(r.get(ctx.cashier_field)) if ctx.cashier_field else None
        r["_cashier_name"] = m2o_name(r.get(ctx.cashier_field)) if ctx.cashier_field else None
        r["_branch"] = m2o_id(r.get(ctx.branch_field)) if ctx.branch_field else None
        r["_branch_name"] = m2o_name(r.get(ctx.branch_field)) if ctx.branch_field else None
        r["_amt"] = float(r.get("amount_total") or 0.0)
        ctx.orders_by_id[r["id"]] = r
        if r["_pid"]:
            ctx.by_partner[r["_pid"]].append(r)
    for rows in ctx.by_partner.values():
        rows.sort(key=lambda x: x["_dt"] or datetime.min)

    identified = sum(1 for r in ctx.orders if r["_pid"])
    kv("orders carrying a partner (identified)", "%d of %d (%.1f%%)"
       % (identified, len(ctx.orders), 100.0 * identified / max(1, len(ctx.orders))))
    kv("distinct partners transacting", len(ctx.by_partner))
    kv("distinct cashiers", len({r["_cashier"] for r in ctx.orders if r["_cashier"]}))
    kv("distinct branches/tills", len({r["_branch"] for r in ctx.orders if r["_branch"]}))

    # loyalty cards
    if ctx.caps["has_loyalty"]:
        present, _ = o.pick("loyalty.card", ["partner_id", "program_id", "points", "code",
                                             "expiration_date", "create_date"])
        rows, trunc = o.read_all("loyalty.card", [], present + ["id"], label="loyalty.card")
        if trunc:
            ctx.truncated.append("loyalty.card")
        for c in rows:
            c["_pid"] = m2o_id(c.get("partner_id"))
            ctx.cards[c["id"]] = c
            if c["_pid"]:
                ctx.cards_by_partner[c["_pid"]].append(c)
        kv("loyalty.card rows", len(rows))
        kv("distinct card-holding partners", len(ctx.cards_by_partner))
    else:
        gap("loyalty.card is not readable — D3/D4/D7 will report UNAVAILABLE.")

    # loyalty history in window
    if ctx.caps["has_history"]:
        want_h = ["card_id", "issued", "used", "points", "description", "create_date", "create_uid",
                  "order_id", "order_model", "pos_order_id"]
        present, absent = o.pick("loyalty.history", want_h)
        if absent:
            gap("loyalty.history has no field(s): %s. Detectors below say where that bites."
                % ", ".join(absent))
        hdom = [("create_date", ">=", u_start), ("create_date", "<", u_end)]
        ctx.history, trunc = o.read_all("loyalty.history", hdom, present + ["id"],
                                        order="id", label="loyalty.history")
        if trunc:
            ctx.truncated.append("loyalty.history")
            warn("loyalty.history read truncated at %d rows; point totals are LOWER BOUNDS." % MAX_ROWS)
        for h in ctx.history:
            h["_dt"] = parse_dt(h.get("create_date"))
            h["_card"] = m2o_id(h.get("card_id"))
            h["_issued"] = float(h.get("issued") or 0.0)
            h["_used"] = float(h.get("used") or 0.0)
            if "issued" not in present and "points" in present:
                p = float(h.get("points") or 0.0)
                h["_issued"], h["_used"] = (p, 0.0) if p >= 0 else (0.0, -p)
            h["_order"] = _history_order_id(h)
            ctx.hist_by_card[h["_card"]].append(h)
            if h["_order"]:
                ctx.hist_by_order[h["_order"]].append(h)
        kv("loyalty.history rows in window", len(ctx.history))
        linked = sum(1 for h in ctx.history if h["_order"])
        kv("history rows linked to a POS order", "%d of %d (%.1f%%)"
           % (linked, len(ctx.history), 100.0 * linked / max(1, len(ctx.history))))
        if ctx.history and linked == 0:
            warn("NO history row carries a POS order link on this build. D5 (refund clawback) "
                 "and D7 (point spikes) fall back to time-proximity matching, which is a "
                 "HEURISTIC — their numbers become ESTIMATE, not EXACT. D1/D2/D6 lose the "
                 "ledger too: they price an order's points as amount x the configured rate "
                 "instead of reading what was actually issued, so their JOD columns become "
                 "DERIVED. Each detector says so again where it matters.")
    else:
        gap("loyalty.history is not readable — D4/D5/D7 lose their primary evidence.")

    # partners actually referenced (names/phones for masking, employee/user linkage for D3)
    pids = set(ctx.by_partner) | set(ctx.cards_by_partner)
    if pids:
        pf, _ = o.pick("res.partner", ["name", "phone", "mobile", "email", "create_date",
                                       "employee", "user_ids"])
        for p in o.read_ids("res.partner", sorted(pids), pf + ["id"]):
            ctx.partners[p["id"]] = p
    kv("partners loaded for identification", len(ctx.partners))


def _history_order_id(h: dict):
    """Which POS order a history row belongs to. Odoo has moved this between a dedicated
    pos_order_id, a (order_model, order_id) pair, and nothing at all — try each."""
    if h.get("pos_order_id"):
        return m2o_id(h["pos_order_id"]) or (h["pos_order_id"] if isinstance(h["pos_order_id"], int) else None)
    if h.get("order_model") == "pos.order" and h.get("order_id"):
        v = h["order_id"]
        return m2o_id(v) if isinstance(v, (list, tuple)) else (v if isinstance(v, int) else None)
    v = h.get("order_id")
    if isinstance(v, (list, tuple)) and v and "order_model" not in h:
        return m2o_id(v)
    if isinstance(v, str) and v.startswith("pos.order,"):      # Reference-field form
        try:
            return int(v.split(",", 1)[1])
        except ValueError:
            return None
    return None


def earning_orders(ctx: Ctx) -> dict:
    """partner_id -> [orders that ISSUED points], the population D1/D2 reason about.

    Basis, in preference order, and the basis actually used is printed:
      (a) EXACT   — orders with a positive loyalty.history issuance linked to them
      (b) PROXY   — every order of a card-holding partner (used when history carries no order
                    link). This over-counts: an order that earned nothing still counts as an
                    earning order, which INFLATES concentration denominators and therefore makes
                    D1 more conservative, not less."""
    linked = {oid for oid, rows in ctx.hist_by_order.items() if any(r["_issued"] > 0 for r in rows)}
    if linked:
        out = defaultdict(list)
        for oid in linked:
            r = ctx.orders_by_id.get(oid)
            if r and r["_pid"]:
                out[r["_pid"]].append(r)
        for v in out.values():
            v.sort(key=lambda x: x["_dt"] or datetime.min)
        return {"basis": "EXACT (orders with a positive loyalty.history issuance)", "map": out}
    out = defaultdict(list)
    for pid, rows in ctx.by_partner.items():
        if pid in ctx.cards_by_partner:
            out[pid] = [r for r in rows if r["_amt"] > 0]
    return {"basis": "PROXY (all positive-value orders of card-holding partners; history has no "
                     "order link on this build)", "map": out}


# ============================================================ D1 — CASHIER SELF-CREDITING
def d1_self_crediting(ctx: Ctx, earn: dict) -> dict:
    head("Which members' earning orders concentrate on ONE cashier far beyond chance?",
         "D1 SELF-CREDITING (pos.order cashier concentration, exact binomial tail)")
    res = {"status": "OK", "offenders": []}
    if not ctx.cashier_field:
        gap("pos.order carries neither employee_id nor user_id here, so an order cannot be "
            "attributed to a cashier. D1 CANNOT RUN. This is itself the most important finding "
            "in the scan: without cashier attribution the dominant fraud vector is unobservable, "
            "and fixing it (enable POS employee mode) is a prerequisite to launching.")
        return {"status": "UNAVAILABLE", "reason": "no cashier field on pos.order"}

    flags("Members whose points were issued overwhelmingly by a single cashier — the signature of "
          "a cashier typing a phone number they control onto walk-in sales.")
    rule("For member m and cashier c: k = m's earning orders served by c, n = m's earning orders. "
         "The null p is c's OWN share of ALL orders at the branches m actually used, weighted by "
         "m's branch mix — so a member who only ever visits a one-cashier branch is NOT flagged. "
         "Flag when n >= %d, k/n >= %.2f, and the exact binomial tail P(X>=k | n,p) is below the "
         "Bonferroni-corrected alpha %g/(tests) — i.e. still significant after every member "
         "tested." % (ctx.args.d1_min_orders, ctx.args.d1_concentration, ctx.args.alpha))

    # cashier share of traffic per branch — the null model, measured, not assumed
    branch_total = defaultdict(int)
    branch_cashier = defaultdict(int)
    for r in ctx.orders:
        b = r["_branch"]
        branch_total[b] += 1
        if r["_cashier"]:
            branch_cashier[(b, r["_cashier"])] += 1

    emap = earn["map"]
    candidates = [(pid, rows) for pid, rows in emap.items() if len(rows) >= ctx.args.d1_min_orders]
    tests = max(1, len(candidates))
    alpha_corrected = ctx.args.alpha / tests
    kv("earning-order basis", earn["basis"])
    kv("members tested (n >= %d earning orders)" % ctx.args.d1_min_orders, len(candidates))
    kv("Bonferroni-corrected alpha", "%g / %d = %.3g" % (ctx.args.alpha, tests, alpha_corrected))

    conc_values, rows_out = [], []
    for pid, rows in candidates:
        n = len(rows)
        by_c = defaultdict(list)
        for r in rows:
            if r["_cashier"]:
                by_c[r["_cashier"]].append(r)
        if not by_c:
            continue
        cid, orders_c = max(by_c.items(), key=lambda kv_: len(kv_[1]))
        k = len(orders_c)
        conc = k / float(n)
        conc_values.append(conc)
        # null: this cashier's share of traffic across the branches THIS member used
        mix = defaultdict(int)
        for r in rows:
            mix[r["_branch"]] += 1
        num = den = 0.0
        for b, w in mix.items():
            bt = branch_total.get(b, 0)
            if bt:
                num += (w / float(n)) * branch_cashier.get((b, cid), 0)
                den += (w / float(n)) * bt
        p_null = (num / den) if den else 0.0
        if p_null <= 0.0 or p_null >= 1.0:
            continue
        p_val = binom_sf(k, n, p_null)
        if conc < ctx.args.d1_concentration or p_val > alpha_corrected:
            continue
        pts = sum(_issued_for_order(ctx, r) for r in orders_c)
        excess = max(0.0, k - p_null * n)
        pts_excess = (pts * excess / k) if k else 0.0
        rows_out.append({
            "partner_id": pid, "cashier_id": cid,
            "cashier": ctx.mask.subject("C", cid, orders_c[0]["_cashier_name"]),
            "n": n, "k": k, "conc": conc, "p_null": p_null, "p_value": p_val,
            "points_on_concentrated_orders": pts, "excess_orders": excess,
            "jod_at_risk": ctx.points_to_jod(pts_excess),
            "value_of_orders": sum(r["_amt"] for r in orders_c),
            "branches": len(mix),
        })

    distribution_line(conc_values, "single-cashier share per member (n>=min)", 3)
    kv("THRESHOLD concentration", "%.2f  (policy choice, not a measurement)" % ctx.args.d1_concentration)
    rows_out.sort(key=lambda x: (-neg_log10(x["p_value"]), -x["jod_at_risk"]))
    total_jod = sum(x["jod_at_risk"] for x in rows_out)

    sub("top offenders (masked; a flag is a screen, not a verdict)")
    table([[ctx.subject_for_partner(x["partner_id"]), x["cashier"],
            "%d/%d" % (x["k"], x["n"]), "%.0f%%" % (100 * x["conc"]),
            "%.1f%%" % (100 * x["p_null"]), "1e-%.0f" % neg_log10(x["p_value"]),
            "%.2f" % x["jod_at_risk"]]
           for x in rows_out[:ctx.args.top]],
          ["member (masked)", "dominant cashier", "k/n", "conc", "chance", "p", "JOD risk"],
          aligns="llrrrrr")
    kv("members flagged", len(rows_out))
    kv("JOD AT RISK (D1)",
       "%.2f  = EXCESS points (issued above the chance expectation) x %.4f JOD/point"
       % (total_jod, ctx.point_value or 0.0))
    bullet("Read 'chance' as: the share of orders this cashier serves anyway at the branches this "
           "member uses. Read 'p' as: how likely that k/n would happen if the member simply met "
           "whoever was on the till. 1e-12 means once in a trillion.")
    bullet("JOD at risk counts only the EXCESS above chance, not the whole concentrated block — "
           "the member genuinely would have met this cashier some of the time.")
    if not rows_out:
        derive("No member survived the corrected threshold. That is a real result and worth "
               "stating in the launch memo: at this window length, cashier concentration is "
               "within chance. Re-run at --days 90 before concluding anything durable.")
    for x in rows_out:
        ctx.add_risk(x["partner_id"], "D1", x["jod_at_risk"],
                     "%d/%d orders on one cashier (p=1e-%.0f)" % (x["k"], x["n"], neg_log10(x["p_value"])))
    res["offenders"] = rows_out
    res["jod_at_risk"] = total_jod
    res["alpha_corrected"] = alpha_corrected
    ctx.detector_jod["D1 self-crediting"] = total_jod
    return res


def _issued_for_order(ctx: Ctx, order: dict) -> float:
    """Points issued on an order: EXACT from loyalty.history when linked, else DERIVED from
    the program rate, else 0 with the caller stating the basis."""
    rows = ctx.hist_by_order.get(order["id"])
    if rows:
        return sum(r["_issued"] for r in rows)
    rates = [r for rl in ctx.program_rate.values() for r in rl]
    if rates and order["_amt"] > 0:
        return order["_amt"] * (sum(rates) / len(rates))
    return 0.0


# ============================================================ D2 — IMPOSSIBLE EARN PATTERNS
def d2_impossible_patterns(ctx: Ctx, earn: dict) -> dict:
    head("Which members earned on orders they plausibly did not make?",
         "D2 IMPOSSIBLE PATTERN (orders/day, cross-branch gap, duplicate bursts, off-pattern)")
    flags("Earning events that a single human customer could not plausibly have produced: too "
          "many purchases in one day, two purchases at different branches minutes apart, "
          "identical orders seconds apart, and earning far outside the member's own habits.")
    rule("Four sub-tests, each counted separately: (a) more than %d earning orders in one LOCAL "
         "day; (b) two earning orders at DIFFERENT branches less than %d minutes apart "
         "(no branch coordinates exist in Odoo, so this is a time test, not a distance test — "
         "the gap is a THRESHOLD, stated, not a measured travel time); (c) two earning orders at "
         "the SAME branch less than %d seconds apart (invoice splitting / repeat swipe); "
         "(d) for members with >= %d orders, orders outside BOTH their own p10-p90 hour band AND "
         "their usual branch set — weak evidence alone, scored lowest."
         % (ctx.args.d2_max_orders_day, ctx.args.d2_branch_gap_min, ctx.args.d2_same_branch_sec,
            ctx.args.d2_pattern_min_orders))

    emap = earn["map"]
    per_day_counts, hits = [], {}
    for pid, rows in emap.items():
        if not rows:
            continue
        rec = {"partner_id": pid, "burst_days": [], "cross_branch": [], "rapid": [], "offpattern": 0,
               "orders": len(rows), "points": 0.0}
        by_day = defaultdict(list)
        for r in rows:
            if r["_dt"]:
                by_day[local_day(r["_dt"], ctx.args.tz_offset)].append(r)
        for d, rs in by_day.items():
            per_day_counts.append(len(rs))
            if len(rs) > ctx.args.d2_max_orders_day:
                rec["burst_days"].append((d, len(rs), sum(_issued_for_order(ctx, r) for r in rs)))
        seq = [r for r in rows if r["_dt"]]
        for a, b in zip(seq, seq[1:]):
            delta = (b["_dt"] - a["_dt"]).total_seconds()
            if a["_branch"] != b["_branch"] and delta < ctx.args.d2_branch_gap_min * 60:
                rec["cross_branch"].append((a["id"], b["id"], delta / 60.0))
            elif a["_branch"] == b["_branch"] and delta < ctx.args.d2_same_branch_sec:
                rec["rapid"].append((a["id"], b["id"], delta))
        if len(seq) >= ctx.args.d2_pattern_min_orders:
            hours = sorted(local_hour(r["_dt"], ctx.args.tz_offset) for r in seq)
            lo, hi = pctl(hours, 10), pctl(hours, 90)
            usual = {r["_branch"] for r in seq}
            common = {b for b in usual
                      if sum(1 for r in seq if r["_branch"] == b) >= 0.1 * len(seq)}
            rec["offpattern"] = sum(
                1 for r in seq
                if not (lo <= local_hour(r["_dt"], ctx.args.tz_offset) <= hi) and r["_branch"] not in common)
        flagged_orders = set()
        for a_id, b_id, _ in rec["cross_branch"] + rec["rapid"]:
            flagged_orders.add(a_id)
            flagged_orders.add(b_id)
        for _, _, pts in rec["burst_days"]:
            rec["points"] += pts
        rec["points"] += sum(_issued_for_order(ctx, ctx.orders_by_id[i])
                             for i in flagged_orders if i in ctx.orders_by_id)
        rec["jod_at_risk"] = ctx.points_to_jod(rec["points"])
        rec["score"] = (3 * len(rec["burst_days"]) + 3 * len(rec["cross_branch"])
                        + 2 * len(rec["rapid"]) + 1 * (rec["offpattern"] > 0))
        if rec["score"]:
            hits[pid] = rec

    distribution_line(per_day_counts, "earning orders per member per LOCAL day", 1)
    kv("THRESHOLD orders/day", "%d (policy choice)" % ctx.args.d2_max_orders_day)
    kv("THRESHOLD cross-branch gap", "%d minutes (policy choice — NOT a measured travel time)"
       % ctx.args.d2_branch_gap_min)
    ranked = sorted(hits.values(), key=lambda x: (-x["score"], -x["jod_at_risk"]))
    total_jod = sum(x["jod_at_risk"] for x in ranked)

    sub("top offenders (masked)")
    table([[ctx.subject_for_partner(x["partner_id"]), x["orders"], len(x["burst_days"]),
            len(x["cross_branch"]), len(x["rapid"]), x["offpattern"], "%.2f" % x["jod_at_risk"]]
           for x in ranked[:ctx.args.top]],
          ["member (masked)", "earn ord", "burst days", "x-branch", "rapid", "off-pat", "JOD risk"],
          aligns="lrrrrrr")
    kv("members flagged", len(ranked))
    kv("JOD AT RISK (D2)", "%.2f  = points issued on the flagged orders/days x %.4f JOD/point"
       % (total_jod, ctx.point_value or 0.0))
    if ctx.branch_field == "config_id":
        warn("'x-branch' here means DIFFERENT TILL, not different building (almond_branch is not "
             "installed). Two tills in one shop will fire this test constantly — treat the "
             "x-branch column as unusable until branch_id exists.")
    bullet("Cross-branch and rapid pairs are the strongest single-order evidence in the whole scan: "
           "they are physically checkable against CCTV timestamps at both tills.")
    for x in ranked:
        ctx.add_risk(x["partner_id"], "D2", x["jod_at_risk"],
                     "%d burst days, %d cross-branch pairs, %d rapid pairs"
                     % (len(x["burst_days"]), len(x["cross_branch"]), len(x["rapid"])))
    ctx.detector_jod["D2 impossible pattern"] = total_jod
    return {"status": "OK", "offenders": ranked, "jod_at_risk": total_jod}


# ==================================================================== D3 — STAFF ACCOUNTS
def d3_staff_accounts(ctx: Ctx) -> dict:
    head("Which loyalty cards belong to people who also work here?",
         "D3 STAFF ACCOUNTS (loyalty.card partner is an hr.employee or a res.users)")
    flags("Cards held by employees or internal users. Staff earning is not automatically abuse — "
          "many chains allow it — but it must be a KNOWN, LISTED population with its own rules, "
          "because a staff card is the natural destination for self-credited points.")
    if not ctx.caps["has_loyalty"]:
        gap("loyalty.card not readable — D3 UNAVAILABLE.")
        return {"status": "UNAVAILABLE", "reason": "loyalty.card not readable"}
    o = ctx.o
    staff_partners = {}

    if ctx.caps["has_hr_employee"]:
        ef, _ = o.pick("hr.employee", ["name", "work_contact_id", "address_home_id", "user_id",
                                       "active", "department_id", "job_title"])
        emps, _ = o.read_all("hr.employee", [], ef + ["id"])
        for e in emps:
            for f in ("work_contact_id", "address_home_id"):
                pid = m2o_id(e.get(f))
                if pid:
                    staff_partners.setdefault(pid, {"kind": "employee", "employee_id": e["id"],
                                                    "dept": m2o_name(e.get("department_id")),
                                                    "active": e.get("active")})
        kv("hr.employee rows", len(emps))
    else:
        gap("hr.employee not readable — employee linkage is limited to res.users.")

    if ctx.caps["has_res_users"]:
        uf, _ = o.pick("res.users", ["partner_id", "login", "active", "share"])
        users, _ = o.read_all("res.users", [], uf + ["id"])
        for u in users:
            if u.get("share"):          # portal/public users are customers, not staff
                continue
            pid = m2o_id(u.get("partner_id"))
            if pid:
                staff_partners.setdefault(pid, {"kind": "internal user", "user_id": u["id"],
                                                "active": u.get("active")})
        kv("internal res.users rows", sum(1 for u in users if not u.get("share")))
    rule("A card is flagged when its partner_id is the work contact or home address of an "
         "hr.employee, or the partner of a non-share (internal) res.users. Portal/share users "
         "are excluded — those are customers with app logins, not staff.")

    rows_out = []
    for pid, meta in staff_partners.items():
        cards = ctx.cards_by_partner.get(pid) or []
        if not cards:
            continue
        bal = sum(float(c.get("points") or 0.0) for c in cards)
        orders = ctx.by_partner.get(pid) or []
        earned = sum(sum(h["_issued"] for h in ctx.hist_by_card.get(c["id"], [])) for c in cards)
        used = sum(sum(h["_used"] for h in ctx.hist_by_card.get(c["id"], [])) for c in cards)
        rows_out.append({"partner_id": pid, "kind": meta["kind"], "dept": meta.get("dept"),
                         "cards": len(cards), "balance_points": bal, "earned_window": earned,
                         "used_window": used, "orders_window": len(orders),
                         "jod_at_risk": ctx.points_to_jod(bal + earned)})
    rows_out.sort(key=lambda x: -x["jod_at_risk"])
    total_jod = sum(x["jod_at_risk"] for x in rows_out)

    sub("staff-held cards (masked)")
    table([[ctx.subject_for_partner(x["partner_id"]), x["kind"], x["dept"] or "—", x["cards"],
            "%.0f" % x["balance_points"], "%.0f" % x["earned_window"], x["orders_window"],
            "%.2f" % x["jod_at_risk"]]
           for x in rows_out[:ctx.args.top]],
          ["holder (masked)", "linkage", "dept", "cards", "balance pts", "earned", "orders", "JOD"],
          aligns="lllrrrrr")
    kv("staff-held cards found", len(rows_out))
    kv("JOD AT RISK (D3)", "%.2f  = (outstanding balance + points earned in window) x %.4f JOD/point"
       % (total_jod, ctx.point_value or 0.0))
    bullet("This is EXPOSURE, not loss: it is the value sitting on staff cards. Decide the policy "
           "(staff may earn / may not earn / earn at a reduced rate on their own purchases only), "
           "write it down, then re-run — after which any card here that is not on the approved "
           "list is a finding.")
    for x in rows_out:
        ctx.add_risk(x["partner_id"], "D3", x["jod_at_risk"], "staff-held card (%s)" % x["kind"])
    ctx.detector_jod["D3 staff accounts"] = total_jod
    return {"status": "OK", "offenders": rows_out, "jod_at_risk": total_jod}


# ========================================================================== D4 — VELOCITY
def d4_velocity(ctx: Ctx) -> dict:
    head("Which cards earn faster than a customer can, or burn points the instant they land?",
         "D4 VELOCITY (points/day per card; earn->redeem latency)")
    flags("Two shapes: (a) cards accumulating more points per active day than a real coffee "
          "customer produces; (b) cards that redeem immediately after nearly every earn, which "
          "is what a farming operation looks like — points are converted before anyone notices.")
    if not ctx.caps["has_history"]:
        gap("loyalty.history not readable — D4 UNAVAILABLE (velocity needs timestamped earn rows).")
        return {"status": "UNAVAILABLE", "reason": "loyalty.history not readable"}
    rule("(a) Flag a card whose points issued in any single LOCAL day exceed %d, or whose mean "
         "over at least %d ACTIVE days exceeds %d — the active-day floor is what stops one big "
         "legitimate order (a catering bill) from looking like sustained farming. (b) Flag a "
         "card with >= %d earn events where at least %.0f%% of earns are followed by a "
         "redemption within %d minutes."
         % (ctx.args.d4_points_day, ctx.args.d4_min_active_days, ctx.args.d4_points_day_mean,
            ctx.args.d4_min_earns, 100 * ctx.args.d4_burn_share, ctx.args.d4_burn_minutes))

    per_day_points, rows_out = [], []
    for cid, rows in ctx.hist_by_card.items():
        if not cid:
            continue
        rows = sorted([r for r in rows if r["_dt"]], key=lambda r: r["_dt"])
        earns = [r for r in rows if r["_issued"] > 0]
        redeems = [r for r in rows if r["_used"] > 0]
        if not earns:
            continue
        by_day = defaultdict(float)
        for r in earns:
            by_day[local_day(r["_dt"], ctx.args.tz_offset)] += r["_issued"]
        day_vals = list(by_day.values())
        per_day_points.extend(day_vals)
        peak = max(day_vals)
        mean_day = sum(day_vals) / len(day_vals)
        # burn-on-sight: for each earn, is there a redemption within the window?
        fast = 0
        for e in earns:
            if any(0 <= (r["_dt"] - e["_dt"]).total_seconds() <= ctx.args.d4_burn_minutes * 60
                   for r in redeems):
                fast += 1
        burn_share = fast / float(len(earns))
        hit_peak = peak > ctx.args.d4_points_day
        hit_mean = (len(day_vals) >= ctx.args.d4_min_active_days
                    and mean_day > ctx.args.d4_points_day_mean)
        hit_speed = hit_peak or hit_mean
        hit_burn = len(earns) >= ctx.args.d4_min_earns and burn_share >= ctx.args.d4_burn_share
        if not (hit_speed or hit_burn):
            continue
        card = ctx.cards.get(cid) or {}
        pid = card.get("_pid")
        # Excess is measured against the threshold that ACTUALLY fired, otherwise a card caught
        # by the mean rule reports 0.00 JOD and the row looks like a bug.
        base = ctx.args.d4_points_day if hit_peak else ctx.args.d4_points_day_mean
        excess = sum(max(0.0, v - base) for v in day_vals) if hit_speed else 0.0
        rows_out.append({"card_id": cid, "partner_id": pid, "earns": len(earns),
                         "peak_day_points": peak, "mean_day_points": mean_day,
                         "burn_share": burn_share, "active_days": len(day_vals),
                         "reasons": ("peak" if hit_peak else "mean" if hit_mean else "")
                         + ("+burn" if hit_burn else ""),
                         "excess_over": base if hit_speed else None,
                         "jod_at_risk": ctx.points_to_jod(excess)})
    distribution_line(per_day_points, "points issued per card per LOCAL day", 1)
    kv("THRESHOLD peak points/day", "%d (policy choice)" % ctx.args.d4_points_day)
    kv("THRESHOLD burn-on-sight share", "%.0f%% within %d min (policy choice)"
       % (100 * ctx.args.d4_burn_share, ctx.args.d4_burn_minutes))
    rows_out.sort(key=lambda x: (0 if "burn" in x["reasons"] else 1, -x["jod_at_risk"]))
    total_jod = sum(x["jod_at_risk"] for x in rows_out)

    sub("top offenders (masked)")
    table([[(ctx.subject_for_partner(x["partner_id"]) if x["partner_id"]
             else ctx.mask.subject("CARD", x["card_id"])),
            x["reasons"], x["earns"], x["active_days"], "%.0f" % x["peak_day_points"],
            "%.1f" % x["mean_day_points"], "%.0f%%" % (100 * x["burn_share"]),
            "%.2f" % x["jod_at_risk"]]
           for x in rows_out[:ctx.args.top]],
          ["card holder (masked)", "why", "earns", "days", "peak/day", "mean/day", "burn",
           "JOD risk"], aligns="llrrrrrr")
    kv("cards flagged", len(rows_out))
    kv("JOD AT RISK (D4)", "%.2f  = points issued ABOVE the threshold that fired (peak %d or "
       "mean %d per day) x %.4f JOD/point"
       % (total_jod, ctx.args.d4_points_day, ctx.args.d4_points_day_mean, ctx.point_value or 0.0))
    bullet("A high burn share with a LOW peak/day is the more interesting case: it is quiet, it "
           "clears the evidence, and it does not trip a volume alarm. Rank it by burn, not by JOD.")
    for x in rows_out:
        ctx.add_risk(x["partner_id"], "D4", x["jod_at_risk"],
                     "velocity %s (peak %.0f pts/day, burn %.0f%%)"
                     % (x["reasons"], x["peak_day_points"], 100 * x["burn_share"]))
    ctx.detector_jod["D4 velocity"] = total_jod
    return {"status": "OK", "offenders": rows_out, "jod_at_risk": total_jod}


# ======================================================================= D5 — REFUND ABUSE
def d5_refund_abuse(ctx: Ctx) -> dict:
    head("Were points issued on orders that were later refunded — and were they clawed back?",
         "D5 REFUND ABUSE (refunded pos.order vs a matching negative loyalty.history)")
    flags("The buy-then-refund loop: ring a large sale onto a phone number, collect the points, "
          "refund the sale. The money comes back, the points stay. Unlike every other detector "
          "here, this one measures a REALISED leak, not a suspicious pattern.")
    if not ctx.caps["has_history"]:
        gap("loyalty.history not readable — the clawback side cannot be checked. D5 UNAVAILABLE.")
        return {"status": "UNAVAILABLE", "reason": "loyalty.history not readable"}

    o = ctx.o
    refunds = [r for r in ctx.orders if r["_amt"] < 0]
    kv("refund orders in window (amount_total < 0)", len(refunds))
    kv("refund value", "%.2f JOD" % sum(r["_amt"] for r in refunds))

    # link refund -> original
    link_basis, links = None, {}
    lf = ctx.caps.get("refund_link_field")
    if lf == "refunded_order_id":
        for r in refunds:
            oid = m2o_id(r.get(lf))
            if oid:
                links[r["id"]] = oid
        link_basis = "EXACT (pos.order.refunded_order_id)"
    elif ctx.caps.get("has_refund_line_link") and refunds:
        try:
            lines, _ = o.read_all("pos.order.line",
                                  [("order_id", "in", [r["id"] for r in refunds])],
                                  ["order_id", "refunded_orderline_id"])
            orig_line_ids = sorted({m2o_id(l.get("refunded_orderline_id"))
                                    for l in lines if l.get("refunded_orderline_id")})
            orig = {l["id"]: m2o_id(l.get("order_id"))
                    for l in o.read_ids("pos.order.line", orig_line_ids, ["order_id"])}
            for l in lines:
                ol = m2o_id(l.get("refunded_orderline_id"))
                if ol and orig.get(ol):
                    links[m2o_id(l.get("order_id"))] = orig[ol]
            link_basis = "EXACT (pos.order.line.refunded_orderline_id -> original order)"
        except Exception as exc:
            warn("could not read refund line links: %s" % str(exc)[:110])
    if not link_basis:
        link_basis = ("UNAVAILABLE — no refund linkage field on this build. Refunds are counted "
                      "but cannot be tied to the order that issued the points.")
    kv("refund->original linkage", link_basis)
    rule("For every refund R linked to an original order O: I = points issued on O (from "
         "loyalty.history). Expected clawback = I x |refund value| / |original value| (a partial "
         "refund should claw back proportionally). Actual clawback = the sum of NEGATIVE issuance "
         "(or redemption-side reversal) on the same card linked to R or to O, or failing a link, "
         "occurring within %d hours after R. Leak = expected - actual, floored at zero."
         % ctx.args.d5_clawback_hours)

    leaks, checked, clawed_ok = [], 0, 0
    for r in refunds:
        oid = links.get(r["id"])
        if not oid:
            continue
        orig = ctx.orders_by_id.get(oid)
        if not orig:
            continue
        issued = sum(h["_issued"] for h in ctx.hist_by_order.get(oid, []))
        if issued <= 0:
            continue
        checked += 1
        frac = min(1.0, abs(r["_amt"]) / abs(orig["_amt"])) if orig["_amt"] else 1.0
        expected = issued * frac
        # clawback: negative issuance linked to either order, or on the same card just after R
        cards = {h["_card"] for h in ctx.hist_by_order.get(oid, [])}
        actual = 0.0
        for h in ctx.hist_by_order.get(r["id"], []) + ctx.hist_by_order.get(oid, []):
            if h["_issued"] < 0:
                actual += -h["_issued"]
        if actual <= 0 and r["_dt"]:
            for c in cards:
                for h in ctx.hist_by_card.get(c, []):
                    if h["_issued"] < 0 and h["_dt"] and \
                       0 <= (h["_dt"] - r["_dt"]).total_seconds() <= ctx.args.d5_clawback_hours * 3600:
                        actual += -h["_issued"]
        leak = max(0.0, expected - actual)
        if leak <= 0:
            clawed_ok += 1
            continue
        leaks.append({"refund_order": r["id"], "original_order": oid,
                      "partner_id": orig["_pid"] or r["_pid"],
                      "cashier": ctx.mask.subject("C", r["_cashier"], r["_cashier_name"])
                      if r["_cashier"] else "—",
                      "refund_value": r["_amt"], "original_value": orig["_amt"],
                      "points_issued": issued, "expected_clawback": expected,
                      "actual_clawback": actual, "leaked_points": leak,
                      "jod_at_risk": ctx.points_to_jod(leak),
                      "hours_between": ((r["_dt"] - orig["_dt"]).total_seconds() / 3600.0)
                      if (r["_dt"] and orig["_dt"]) else None})
    leaks.sort(key=lambda x: -x["jod_at_risk"])
    total_points = sum(x["leaked_points"] for x in leaks)
    total_jod = sum(x["jod_at_risk"] for x in leaks)

    kv("refunds of point-earning orders checked", checked)
    kv("of those, correctly clawed back", "%d (%.1f%%)" % (clawed_ok, 100.0 * clawed_ok / max(1, checked)))
    kv("of those, LEAKING", "%d (%.1f%%)" % (len(leaks), 100.0 * len(leaks) / max(1, checked)))

    sub("largest leaks (masked)")
    table([[ctx.subject_for_partner(x["partner_id"]) if x["partner_id"] else "(walk-in)",
            x["cashier"], "%.2f" % x["original_value"], "%.2f" % x["refund_value"],
            "%.0f" % x["points_issued"], "%.0f" % x["leaked_points"],
            ("%.1f" % x["hours_between"]) if x["hours_between"] is not None else "—",
            "%.2f" % x["jod_at_risk"]]
           for x in leaks[:ctx.args.top]],
          ["member (masked)", "refunding cashier", "orig JOD", "refund JOD", "pts", "leaked",
           "hrs", "JOD"], aligns="llrrrrrr")
    kv("LEAKED POINTS (total)", "%.0f" % total_points)
    kv("JOD AT RISK (D5)", "%.2f  = leaked points x %.4f JOD/point — EXACT, this is realised leakage"
       % (total_jod, ctx.point_value or 0.0))
    if checked:
        rate = len(leaks) / float(checked)
        annual = total_jod * (365.0 / max(1, ctx.args.days_measured))
        derive("Clawback failure rate is %.1f%% of refunded earning orders. Extrapolated at the "
               "SAME rate and the same trade mix, the annual leak is %.0f JOD/yr. That is an "
               "extrapolation of a measured window, not a measurement of a year — the window "
               "was %d days." % (100 * rate, annual, ctx.args.days_measured))
        if rate > 0.5:
            warn("More than half of refunds leave the points behind. That is not fraud yet — it "
                 "is a MISSING CONTROL. Odoo will not reverse loyalty points on a POS refund "
                 "unless the refund is created from the original order; fix the till procedure "
                 "before hunting individuals.")
    bullet("Sort your investigation by 'refunding cashier', not by member: the same cashier "
           "appearing on many rows is the signal, because the member may be an innocent walk-in "
           "whose phone was used.")
    for x in leaks:
        ctx.add_risk(x["partner_id"], "D5", x["jod_at_risk"],
                     "refund left %.0f points unclawed" % x["leaked_points"])
    ctx.detector_jod["D5 refund abuse"] = total_jod
    return {"status": "OK", "offenders": leaks, "jod_at_risk": total_jod,
            "checked": checked, "leaking": len(leaks), "link_basis": link_basis}


# ==================================================================== D6 — SHARED IDENTITY
def d6_shared_identity(ctx: Ctx) -> dict:
    head("Is one identity being shared — across branches, payment methods, or partner records?",
         "D6 SHARED IDENTITY (phone/partner spread; duplicate phone numbers)")
    flags("An identity used by more people than one: a phone number that shops in six branches "
          "on the same day, a partner paying through many distinct payment methods, and — the "
          "fallback-ID failure mode — one phone number attached to several partner records.")
    rule("(a) Flag a member visiting more than %d distinct branches in the window, or more than "
         "%d in a single LOCAL day. (b) Flag a member whose orders settle through more than %d "
         "distinct pos.payment.method. (c) Flag any NORMALISED phone number (Jordan form: strip "
         "+962/00962/leading 0) carried by more than one res.partner."
         % (ctx.args.d6_max_branches, ctx.args.d6_max_branches_day, ctx.args.d6_max_paymethods))

    branch_counts, rows_out = [], []
    for pid, rows in ctx.by_partner.items():
        if pid not in ctx.cards_by_partner:
            continue
        brs = {r["_branch"] for r in rows if r["_branch"]}
        branch_counts.append(len(brs))
        per_day = defaultdict(set)
        for r in rows:
            if r["_dt"] and r["_branch"]:
                per_day[local_day(r["_dt"], ctx.args.tz_offset)].add(r["_branch"])
        max_day = max((len(v) for v in per_day.values()), default=0)
        if len(brs) > ctx.args.d6_max_branches or max_day > ctx.args.d6_max_branches_day:
            pts = sum(_issued_for_order(ctx, r) for r in rows)
            rows_out.append({"partner_id": pid, "branches": len(brs), "branches_max_day": max_day,
                             "orders": len(rows), "paymethods": None,
                             "jod_at_risk": ctx.points_to_jod(pts)})
    distribution_line(branch_counts, "distinct branches per member in window", 1)
    kv("THRESHOLD branches in window / in one day",
       "%d / %d (policy choice)" % (ctx.args.d6_max_branches, ctx.args.d6_max_branches_day))

    # payment-method spread, only for the members already worth the round-trip
    if ctx.caps["has_pos_payment"] and rows_out:
        cand = {x["partner_id"] for x in rows_out}
        oids = [r["id"] for pid in cand for r in ctx.by_partner.get(pid, [])]
        try:
            pays, _ = ctx.o.read_all("pos.payment", [("pos_order_id", "in", oids)],
                                     ["pos_order_id", "payment_method_id", "amount"])
            per_partner = defaultdict(set)
            for p in pays:
                oid = m2o_id(p.get("pos_order_id"))
                r = ctx.orders_by_id.get(oid)
                if r and r["_pid"]:
                    per_partner[r["_pid"]].add(m2o_id(p.get("payment_method_id")))
            for x in rows_out:
                x["paymethods"] = len(per_partner.get(x["partner_id"], ()))
        except Exception as exc:
            warn("pos.payment read failed (%s); the payment-method column stays empty."
                 % str(exc)[:110])
    elif not ctx.caps["has_pos_payment"]:
        gap("pos.payment not readable — the payment-method spread test cannot run.")

    rows_out.sort(key=lambda x: (-(x["paymethods"] or 0), -x["branches"], -x["jod_at_risk"]))
    total_jod = sum(x["jod_at_risk"] for x in rows_out)

    sub("members spread across branches / payment methods (masked)")
    table([[ctx.subject_for_partner(x["partner_id"]), x["orders"], x["branches"],
            x["branches_max_day"], x["paymethods"] if x["paymethods"] is not None else "—",
            "%.2f" % x["jod_at_risk"]]
           for x in rows_out[:ctx.args.top]],
          ["member (masked)", "orders", "branches", "max/day", "pay methods", "JOD earned"],
          aligns="lrrrrr")

    # duplicate phone numbers across partner records
    sub("one phone number, several partner records (the fallback-ID collision)")
    by_phone = defaultdict(list)
    for pid, p in ctx.partners.items():
        for f in ("phone", "mobile"):
            n = normalise_phone(p.get(f))
            if n and len(n) >= 7:
                by_phone[n].append(pid)
    dupes = [(n, sorted(set(v))) for n, v in by_phone.items() if len(set(v)) > 1]
    dupes.sort(key=lambda x: -len(x[1]))
    kv("distinct normalised phone numbers seen", len(by_phone))
    kv("phone numbers on MORE THAN ONE partner", len(dupes))
    table([[ctx.mask.phone(n), len(v),
            ", ".join(ctx.mask.subject("P", q) for q in v[:4]),
            "%.0f" % sum(sum(float(c.get("points") or 0.0)
                             for c in ctx.cards_by_partner.get(q, [])) for q in v)]
           for n, v in dupes[:ctx.args.top]],
          ["phone (masked)", "partners", "partner tokens", "combined pts"], aligns="lrlr")
    dupe_points = sum(sum(float(c.get("points") or 0.0) for q in v
                          for c in ctx.cards_by_partner.get(q, [])) for _, v in dupes)
    kv("JOD AT RISK (D6)", "%.2f (spread) + %.2f (duplicate-phone balances) x %.4f JOD/point"
       % (total_jod, ctx.points_to_jod(dupe_points), ctx.point_value or 0.0))
    bullet("Duplicate phones are usually data hygiene, not fraud — but they are exactly what "
           "breaks phone-as-identity: the till cannot tell which record it just credited. Every "
           "duplicate is a place where points can be moved between records without a trace.")
    for x in rows_out:
        ctx.add_risk(x["partner_id"], "D6", x["jod_at_risk"],
                     "%d branches (%d in one day), %s payment methods"
                     % (x["branches"], x["branches_max_day"], x["paymethods"]))
    ctx.detector_jod["D6 shared identity"] = total_jod + ctx.points_to_jod(dupe_points)
    return {"status": "OK", "offenders": rows_out, "duplicate_phones": len(dupes),
            "jod_at_risk": total_jod + ctx.points_to_jod(dupe_points)}


# ======================================================================== D7 — POINT SPIKES
def d7_point_spikes(ctx: Ctx) -> dict:
    head("Do the points issued match order amount x the configured rate — and who issued the rest?",
         "D7 POINT SPIKES (loyalty.history vs order value; unlinked manual adjustments)")
    flags("Points that arithmetic cannot explain: entries far above amount x rate (wrong rule, "
          "tampering, a promo applied by hand) and entries with NO order behind them at all "
          "(pure manual adjustment), grouped by the user who created them.")
    if not ctx.caps["has_history"]:
        gap("loyalty.history not readable — D7 UNAVAILABLE.")
        return {"status": "UNAVAILABLE", "reason": "loyalty.history not readable"}
    if not ctx.program_rate:
        gap("No loyalty.rule with reward_point_mode='money' was found, so there is no configured "
            "points-per-JOD rate to compare against. The ratio test cannot run; the unlinked-"
            "adjustment test below still can.")

    rates = [r for rl in ctx.program_rate.values() for r in rl]
    rate = (sum(rates) / len(rates)) if rates else None
    kv("configured earn rate used", ("%.3f points per JOD (mean of %d money-mode rules)"
                                     % (rate, len(rates))) if rate else "none — ratio test skipped")
    rule("For each history row linked to an order: expected = amount x rate, computed on BOTH "
         "tax bases (amount_total and amount_total - amount_tax) because the tax basis of the "
         "live program is not settled (8%% vs 16%% is an open question in the brief). A row is "
         "flagged only when it deviates by more than %.0f%% from BOTH bases and by at least %d "
         "points in absolute terms — so rounding and the tax ambiguity cannot manufacture a flag."
         % (100 * ctx.args.d7_tolerance, ctx.args.d7_min_abs))

    ratios, spikes = [], []
    if rate:
        for h in ctx.history:
            if h["_issued"] <= 0 or not h["_order"]:
                continue
            o_ = ctx.orders_by_id.get(h["_order"])
            if not o_ or o_["_amt"] <= 0:
                continue
            gross = o_["_amt"] * rate
            net = (o_["_amt"] - float(o_.get("amount_tax") or 0.0)) * rate
            if gross <= 0:
                continue
            ratios.append(h["_issued"] / gross)
            dev_g = abs(h["_issued"] - gross) / gross
            dev_n = abs(h["_issued"] - net) / net if net > 0 else 1.0
            excess = h["_issued"] - max(gross, net)
            if (dev_g > ctx.args.d7_tolerance and dev_n > ctx.args.d7_tolerance
                    and abs(h["_issued"] - gross) >= ctx.args.d7_min_abs and excess > 0):
                card = ctx.cards.get(h["_card"]) or {}
                spikes.append({"history_id": h["id"], "order_id": h["_order"],
                               "partner_id": card.get("_pid") or o_["_pid"],
                               "cashier": ctx.mask.subject("C", o_["_cashier"], o_["_cashier_name"])
                               if o_["_cashier"] else "—",
                               "amount": o_["_amt"], "issued": h["_issued"],
                               "expected_gross": gross, "expected_net": net,
                               "excess_points": excess, "ratio": h["_issued"] / gross,
                               "jod_at_risk": ctx.points_to_jod(excess),
                               "created_by": m2o_name(h.get("create_uid"))})
    distribution_line(ratios, "issued / (amount_total x rate)", 3)
    bullet("Read the distribution before the table. A program with several rules legitimately "
           "produces MODES at 1x, 1.5x, 2x — those are tiers and promos, not fraud. Only the tail "
           "beyond the last mode is interesting, and this detector's false-positive rate is "
           "exactly as good as the rule set it was compared against.")
    spikes.sort(key=lambda x: -x["jod_at_risk"])

    sub("largest unexplained issuances (masked)")
    table([[ctx.subject_for_partner(x["partner_id"]) if x["partner_id"] else "—", x["cashier"],
            "%.2f" % x["amount"], "%.0f" % x["expected_gross"], "%.0f" % x["issued"],
            "%.1fx" % x["ratio"], "%.2f" % x["jod_at_risk"]]
           for x in spikes[:ctx.args.top]],
          ["member (masked)", "cashier", "order JOD", "expected", "issued", "ratio", "JOD"],
          aligns="llrrrrr")

    sub("history rows with NO order behind them (manual adjustments), by creator")
    unlinked = [h for h in ctx.history if h["_issued"] > 0 and not h["_order"]]
    by_user = defaultdict(lambda: {"rows": 0, "points": 0.0})
    for h in unlinked:
        u = m2o_name(h.get("create_uid")) or "(unknown)"
        by_user[u]["rows"] += 1
        by_user[u]["points"] += h["_issued"]
    ranked_u = sorted(by_user.items(), key=lambda kv_: -kv_[1]["points"])
    table([[ctx.mask.name(u), v["rows"], "%.0f" % v["points"],
            "%.2f" % ctx.points_to_jod(v["points"])]
           for u, v in ranked_u[:ctx.args.top]],
          ["created by (masked)", "rows", "points", "JOD"], aligns="lrrr")
    unlinked_points = sum(h["_issued"] for h in unlinked)
    kv("unlinked issuance rows", "%d of %d (%.1f%%)"
       % (len(unlinked), len(ctx.history), 100.0 * len(unlinked) / max(1, len(ctx.history))))
    if "create_uid" not in (ctx.caps.get("history_fields") or []):
        gap("loyalty.history has no create_uid on this build, so manual adjustments cannot be "
            "attributed to a person. Attribution is the whole point of this table — raise it.")
    total_jod = ctx.points_to_jod(sum(x["excess_points"] for x in spikes) + unlinked_points)
    kv("JOD AT RISK (D7)", "%.2f  = (excess above the configured rate + ALL unlinked issuance) "
       "x %.4f JOD/point" % (total_jod, ctx.point_value or 0.0))
    bullet("Unlinked issuance is counted in full because a point with no sale behind it has no "
           "revenue behind it either. Some of it will be legitimate goodwill — that is precisely "
           "why it must be attributable to a named user and reviewed.")
    for x in spikes:
        ctx.add_risk(x["partner_id"], "D7", x["jod_at_risk"],
                     "issued %.0f pts on a %.2f JOD order (%.1fx expected)"
                     % (x["issued"], x["amount"], x["ratio"]))
    ctx.detector_jod["D7 point spikes"] = total_jod
    return {"status": "OK", "spikes": spikes, "unlinked_rows": len(unlinked),
            "unlinked_points": unlinked_points, "jod_at_risk": total_jod}


# ================================================================= combined ranking + totals
def combined_ranking(ctx: Ctx) -> None:
    head("Who should be investigated FIRST?", "COMBINED RANKING (all detectors, per member)")
    rows = []
    for pid, hits in ctx.risk.items():
        dets = sorted({h[0] for h in hits})
        worst = max(h[1] for h in hits)
        rows.append({"partner_id": pid, "detectors": dets, "n_detectors": len(dets),
                     "jod_max": worst, "jod_sum": sum(h[1] for h in hits),
                     "notes": "; ".join(h[2] for h in hits)[:120]})
    rows.sort(key=lambda x: (-x["n_detectors"], -x["jod_max"]))
    bullet("Ranked by NUMBER OF INDEPENDENT DETECTORS first, JOD second. One detector is a "
           "pattern; three detectors on the same person is a case. A member flagged by D1 and D2 "
           "and D4 together is the classic self-crediting profile: one cashier, impossible "
           "frequency, points burned on sight.")
    table([[ctx.subject_for_partner(x["partner_id"]), "+".join(x["detectors"]),
            "%.2f" % x["jod_max"], x["notes"]]
           for x in rows[:ctx.args.top]],
          ["member (masked)", "detectors", "JOD (max)", "why"], aligns="llrl")
    kv("members flagged by >= 2 detectors", sum(1 for x in rows if x["n_detectors"] >= 2))
    kv("members flagged by >= 3 detectors", sum(1 for x in rows if x["n_detectors"] >= 3))
    EV["combined"] = rows[:200]

    sub("JOD AT RISK — by detector")
    table([[k, "%.2f" % v] for k, v in sorted(ctx.detector_jod.items(), key=lambda kv_: -kv_[1])],
          ["detector", "JOD at risk"], aligns="lr")
    naive = sum(ctx.detector_jod.values())
    dedup = sum(max(h[1] for h in hits) for hits in ctx.risk.values())
    kv("naive total (double counts)", "%.2f JOD" % naive)
    kv("de-duplicated per member (max per member)", "%.2f JOD" % dedup)
    warn("Do NOT quote the naive total. The detectors overlap by construction — the same member "
         "appears under D1, D2 and D4 for the same points. The de-duplicated figure is the "
         "defensible one, and even it mixes REALISED leakage (D5, exact) with EXPOSURE (D3, a "
         "balance) and SUSPICION (D1/D2, a screen). Report the three separately.")
    kv("of which REALISED (D5 refund leakage, exact)",
       "%.2f JOD" % ctx.detector_jod.get("D5 refund abuse", 0.0))
    kv("of which EXPOSURE (D3 staff balances)",
       "%.2f JOD" % ctx.detector_jod.get("D3 staff accounts", 0.0))
    EV["totals"] = {"by_detector": ctx.detector_jod, "naive_total": naive, "dedup_total": dedup}


# ==================================================================== DAILY REPORT SPEC
def daily_report_spec(ctx: Ctx) -> None:
    print("\n" + "=" * _W)
    print("DAILY REPORT SPEC — the monitoring that must run from launch day")
    print("=" * _W)
    a = ctx.args
    bullet("This scan is a one-off X-ray. Fraud on a phone-number identifier is not a project, it "
           "is a permanent condition, so the same detectors must run on a schedule and land in "
           "front of a named human. Below is the spec: what runs, when, on what threshold, to "
           "whom, and what happens when it fires. It is implemented by scheduling THIS script — "
           "nothing new has to be built.")

    sub("A. DAILY — every morning at 07:00 Amman, covering the previous trading day")
    bullet("'--days 1' means yesterday: the window is N COMPLETE local days ending at last "
           "midnight, so the 07:00 job never reports on a half-finished day. Use "
           "--include-today only for an ad-hoc look at trade in progress.")
    table([
        ["D1 self-crediting", "--days 1 (rolling 30d for the null)",
         "conc >= %.2f, n >= %d, p < alpha/tests" % (a.d1_concentration, a.d1_min_orders),
         "Ops Manager + Branch Manager (own branch only)"],
        ["D2 impossible pattern", "--days 1",
         "> %d earn orders/day; cross-branch < %d min" % (a.d2_max_orders_day, a.d2_branch_gap_min),
         "Ops Manager"],
        ["D4 velocity", "--days 1",
         "> %d pts/day, or burn >= %.0f%% within %d min"
         % (a.d4_points_day, 100 * a.d4_burn_share, a.d4_burn_minutes),
         "Loyalty Owner"],
        ["D5 refund abuse", "--days 1",
         "any refund of an earning order with leak > 0", "Finance + Ops Manager"],
        ["D7 unlinked issuance", "--days 1",
         "any manual issuance with no order", "Loyalty Owner + Internal Audit"],
    ], ["detector", "window", "trigger", "goes to"], aligns="llll")
    bullet("Top-earner-per-branch leaderboard: the daily mail also carries the top 5 earning "
           "members per branch with their dominant cashier. It costs nothing, and it is the "
           "single control the proposal's fraud gap most needs — a cashier who sees the "
           "leaderboard knows the pattern is watched.")

    sub("B. WEEKLY — Sunday 08:00, covering the previous 7 days")
    table([
        ["D3 staff accounts", "--days 7", "any card not on the approved staff list",
         "HR + Loyalty Owner"],
        ["D6 shared identity", "--days 7",
         "> %d branches, or > %d payment methods, or a new duplicate phone"
         % (a.d6_max_branches, a.d6_max_paymethods), "Loyalty Owner"],
        ["D7 point spikes", "--days 7",
         "deviation > %.0f%% from both tax bases" % (100 * a.d7_tolerance),
         "Loyalty Owner + Odoo admin"],
        ["Combined ranking", "--days 7", ">= 2 detectors on one member",
         "Ops Manager (case list)"],
    ], ["detector", "window", "trigger", "goes to"], aligns="llll")

    sub("C. MONTHLY — first working day, covering 90 days")
    bullet("Full scan at --days 90 with --json, retained. Two jobs: (1) RE-BASELINE every "
           "threshold below against the measured distribution the scan prints — after 30 days of "
           "live data the thresholds stop being policy guesses and become percentiles of observed "
           "behaviour; (2) trend the pseudonymous tokens, since a token appearing every month is "
           "a different problem from a token appearing once.")

    sub("D. THRESHOLDS IN FORCE (all overridable on the command line)")
    table([["--d1-concentration", a.d1_concentration, "single-cashier share of a member's earning orders"],
           ["--d1-min-orders", a.d1_min_orders, "minimum orders before D1 tests a member"],
           ["--alpha", a.alpha, "family-wise significance, Bonferroni-divided by members tested"],
           ["--d2-max-orders-day", a.d2_max_orders_day, "earning orders per member per local day"],
           ["--d2-branch-gap-min", a.d2_branch_gap_min, "minutes between two branches"],
           ["--d2-same-branch-sec", a.d2_same_branch_sec, "seconds between two orders at one till"],
           ["--d4-points-day", a.d4_points_day, "points issued to one card in one local day"],
           ["--d4-points-day-mean", a.d4_points_day_mean, "mean points/day over active days"],
           ["--d4-min-active-days", a.d4_min_active_days, "active days before the mean rule fires"],
           ["--d4-burn-share", a.d4_burn_share, "share of earns redeemed almost immediately"],
           ["--d4-burn-minutes", a.d4_burn_minutes, "what 'immediately' means"],
           ["--d5-clawback-hours", a.d5_clawback_hours, "window in which a clawback still counts"],
           ["--d6-max-branches", a.d6_max_branches, "distinct branches per member per window"],
           ["--d6-max-paymethods", a.d6_max_paymethods, "distinct payment methods per member"],
           ["--d7-tolerance", a.d7_tolerance, "allowed deviation from amount x rate"]],
          ["flag", "value now", "what it cuts"], aligns="lrl")
    warn("Every value in that table is a POLICY CHOICE made before the data was seen. Each "
         "detector above printed the measured distribution of the quantity it cuts; after 30 days "
         "of live monitoring, replace each threshold with the p99.9 of its own distribution and "
         "record the date you did it. Thresholds that were never re-based are how monitoring dies.")

    sub("E. RECIPIENTS AND ESCALATION (roles, to be filled with names before launch)")
    table([["Loyalty Programme Owner", "daily D4/D7, weekly all", "owns thresholds and the case list"],
           ["Operations Manager", "daily D1/D2/D5", "opens investigations, holds the CCTV request"],
           ["Branch Manager", "daily, OWN BRANCH ONLY", "confirms or clears a flag within 48h"],
           ["Finance / Internal Audit", "daily D5, monthly full", "prices the leak, signs the writeoff"],
           ["HR", "weekly D3", "owns the approved staff-card list"],
           ["Odoo administrator", "weekly D7", "fixes rules and rights, never investigates people"]],
          ["role", "receives", "responsibility"], aligns="lll")
    bullet("Escalation: a flag confirmed by a Branch Manager, or any member flagged by >= 3 "
           "detectors, becomes a case owned by the Operations Manager. Cards under investigation "
           "are FROZEN, not deleted — deletion destroys the evidence and the audit trail.")
    bullet("Distribution rule: the daily mail goes out MASKED (no --reveal). Only the Operations "
           "Manager and Internal Audit run with --reveal, and only against a named case. The "
           "tokens are stable, so a masked report is still perfectly actionable as a watch list.")

    sub("F. CONTROLS THAT MAKE THESE DETECTORS UNNECESSARY (fix the cause, not the symptom)")
    bullet("OTP-gate the phone lookup: the member's phone receives a code, the cashier cannot "
           "type an identity. This closes D1/D2/D6 at the source and is the single highest-value "
           "change in this document.")
    bullet("Enable POS employee mode everywhere, so every order carries a cashier. Without it, "
           "D1 cannot run at all — attribution is a precondition for monitoring.")
    bullet("Make POS refunds go through the original order so Odoo reverses the points "
           "automatically; D5 measures exactly what that omission costs today.")
    bullet("Cap points per member per day in the program itself. A cap that cannot be exceeded "
           "removes the need to detect exceeding it.")
    bullet("Install almond_branch on production if it is not there: without pos.order.branch_id "
           "the cross-branch test is measuring tills, not places.")


# ========================================================================= main
def build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="READ-ONLY loyalty abuse scan for the live Odoo 19 database (Almond).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument("--days", type=int, default=30,
                   help="window length in COMPLETE local days ending at last midnight, so "
                        "--days 1 is yesterday (what the 07:00 daily job wants)")
    p.add_argument("--include-today", action="store_true",
                   help="extend the window through the partial current day")
    p.add_argument("--from", dest="date_from", help="window start YYYY-MM-DD (local)")
    p.add_argument("--to", dest="date_to", help="window end YYYY-MM-DD (local, exclusive)")
    p.add_argument("--tz-offset", type=float, default=DEFAULT_TZ_OFFSET_HOURS,
                   help="local UTC offset used for day/hour bucketing (Amman = 3)")
    p.add_argument("--top", type=int, default=15, help="rows per offender table")
    p.add_argument("--only", default="", help="comma list of detectors to run, e.g. d1,d2,d5")
    p.add_argument("--json", dest="json_out", help="also write machine-readable evidence here")
    p.add_argument("--reveal", action="store_true",
                   help="print real names, phones and record ids (investigator use only)")
    p.add_argument("--point-value", type=float, default=0.01,
                   help="JOD per point, used ONLY if it cannot be read from loyalty.reward")
    p.add_argument("--alpha", type=float, default=1e-3, help="D1 family-wise significance level")
    p.add_argument("--d1-min-orders", type=int, default=8)
    p.add_argument("--d1-concentration", type=float, default=0.80)
    p.add_argument("--d2-max-orders-day", type=int, default=6)
    p.add_argument("--d2-branch-gap-min", type=int, default=20)
    p.add_argument("--d2-same-branch-sec", type=int, default=90)
    p.add_argument("--d2-pattern-min-orders", type=int, default=20)
    p.add_argument("--d4-points-day", type=int, default=300)
    p.add_argument("--d4-points-day-mean", type=int, default=150)
    p.add_argument("--d4-min-active-days", type=int, default=3)
    p.add_argument("--d4-min-earns", type=int, default=5)
    p.add_argument("--d4-burn-share", type=float, default=0.8)
    p.add_argument("--d4-burn-minutes", type=int, default=10)
    p.add_argument("--d5-clawback-hours", type=int, default=48)
    p.add_argument("--d6-max-branches", type=int, default=5)
    p.add_argument("--d6-max-branches-day", type=int, default=3)
    p.add_argument("--d6-max-paymethods", type=int, default=4)
    p.add_argument("--d7-tolerance", type=float, default=0.25)
    p.add_argument("--d7-min-abs", type=int, default=10)
    return p


def main() -> None:
    args = build_argparser().parse_args()
    env = load_env()
    u_start, u_end, l_start, l_end, days = resolve_window(args)
    args.days_measured = days
    only = {s.strip().lower() for s in args.only.split(",") if s.strip()}

    print("=" * _W)
    print("ALMOND — LOYALTY ABUSE SCAN (READ-ONLY)   v%s" % SCRIPT_VERSION)
    print("=" * _W)
    kv("host", env["ODOO_URL"])
    kv("database", env["ODOO_DB"])
    kv("login", env["ODOO_LOGIN"])
    kv("run at (UTC)", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))
    kv("window (local)", "%s .. %s  (%d days, exclusive end)"
       % (l_start.strftime("%Y-%m-%d"), l_end.strftime("%Y-%m-%d"), days))
    kv("window (UTC sent to Odoo)", "%s .. %s  (local offset %+.1f h)" % (u_start, u_end, args.tz_offset))
    kv("mode", "READ-ONLY — non-read RPC methods are blocked in code (SAFE_METHODS)")
    kv("identifiers", "REVEALED (contains PII — handle accordingly)" if args.reveal
       else "MASKED (stable pseudonymous tokens; --reveal for the investigator copy)")

    o = Odoo(env)
    kv("authenticated uid", o.uid)
    salt = os.environ.get("ALMOND_SCAN_SALT") or env["ODOO_DB"]
    ctx = Ctx(o, args, Masker(salt, args.reveal))

    detect_capabilities(ctx)
    derive_point_value(ctx)
    load_data(ctx, u_start, u_end)
    earn = earning_orders(ctx)

    def want(tag):
        return not only or tag in only

    if want("d1"):
        EV["d1"] = d1_self_crediting(ctx, earn)
    if want("d2"):
        EV["d2"] = d2_impossible_patterns(ctx, earn)
    if want("d3"):
        EV["d3"] = d3_staff_accounts(ctx)
    if want("d4"):
        EV["d4"] = d4_velocity(ctx)
    if want("d5"):
        EV["d5"] = d5_refund_abuse(ctx)
    if want("d6"):
        EV["d6"] = d6_shared_identity(ctx)
    if want("d7"):
        EV["d7"] = d7_point_spikes(ctx)

    combined_ranking(ctx)
    daily_report_spec(ctx)

    print("\n" + "=" * _W)
    kv("RPC calls made", o.calls)
    if ctx.truncated:
        warn("These reads were TRUNCATED at the %d-row ceiling: %s. Every total derived from them "
             "is a LOWER BOUND. Re-run with a shorter window." % (MAX_ROWS, ", ".join(ctx.truncated)))
    kv("writes performed", "0 — this script has no write path")
    print("=" * _W)

    if args.json_out:
        EV["_meta"] = {"version": SCRIPT_VERSION, "db": env["ODOO_DB"],
                       "window_utc": [u_start, u_end], "days": days,
                       "masked": not args.reveal, "point_value": ctx.point_value,
                       "thresholds": {k: v for k, v in vars(args).items()
                                      if k.startswith(("d1_", "d2_", "d4_", "d5_", "d6_", "d7_"))
                                      or k == "alpha"}}
        try:
            with open(args.json_out, "w", encoding="utf-8") as fh:
                json.dump(EV, fh, ensure_ascii=False, indent=2, default=str)
            print("\n   Evidence written to %s%s"
                  % (args.json_out, " — CONTAINS PII (--reveal was on)." if args.reveal else "."))
        except OSError as exc:
            warn("could not write %s: %s" % (args.json_out, exc))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:                                    # never dump a raw traceback
        print("\nABORTED: %s: %s" % (type(exc).__name__, exc))
        print("Nothing was written to Odoo — this script has no write path.")
        sys.exit(1)
