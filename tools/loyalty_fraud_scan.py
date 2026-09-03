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
#                         partner records (the fallback-ID collision). This is an IDENTITY /
#                         DATA-QUALITY screen and carries NO loss estimate — see D6 for why.
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
#     The --json evidence file obeys the SAME rule: without --reveal every partner/cashier/
#     card/order/history id is replaced by its masked token before the file is written, so a
#     file stamped "masked": true really is masked and really is safe to circulate.
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
# EXIT CODES  (a cron wrapper must be able to tell "page somebody" from "quiet day")
#   0  report produced (possibly with UNAVAILABLE detectors)
#   1  usage error (bad flags) or an unexpected internal error — the message says which
#   2  could not connect / authenticate / read pos.order  (nothing printed as fact)
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
MAX_ROWS = 250_000      # hard ceiling on rows pulled for local aggregation (see BYTES_PER_ORDER)

# A row ceiling is not a memory ceiling. A loaded pos.order row (the fields below plus the
# derived keys) measures ~2.9 KB with a recursive sizeof, so the ceiling above is ~720 MB for
# pos.order alone, before loyalty.history and before xmlrpc's transient parse buffers. The
# script is meant to run on a laptop, so it PRINTS the estimated footprint from a search_count
# before it starts reading, and refuses nothing silently.
BYTES_PER_ORDER = 2_900
FOOTPRINT_WARN_MB = 400

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
def die(msg: str, code: int) -> None:
    """Abort with the DOCUMENTED exit code, on stderr. sys.exit("string") always exits 1,
    which made the header's exit-code contract a lie: a cron wrapper could not tell
    "credentials expired, page somebody" (2) from "quiet trading day" (3)."""
    sys.stderr.write(msg.rstrip("\n") + "\n")
    sys.stderr.flush()
    raise SystemExit(code)


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
            die("ABORT: cannot read %s: %s" % (path, exc), 2)
    for k in ("ODOO_URL", "ODOO_DB", "ODOO_LOGIN", "ODOO_API_KEY"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    missing = [k for k in ("ODOO_URL", "ODOO_DB", "ODOO_LOGIN", "ODOO_API_KEY") if not env.get(k)]
    if missing:
        die("ABORT: missing credentials %s.\n"
            "  Provide them in the environment or in $SCRATCH/.odoo_env (export KEY=value).\n"
            "  This script is READ-ONLY; a read-scoped API key is enough. It still needs a login."
            % ", ".join(missing), 2)
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
            die("ABORT: cannot reach %s — %s: %s\n"
                "  If you are running inside the dev container this is expected: the egress\n"
                "  proxy blocks *.odoo.com. Run this from a host that can reach Odoo."
                % (env["ODOO_URL"], type(exc).__name__, exc), 2)
        if not self.uid:
            die("ABORT: authentication refused for %s on db %s (check ODOO_API_KEY)."
                % (env["ODOO_LOGIN"], env["ODOO_DB"]), 2)
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


# Keys in the evidence registry that hold a raw database id. Each one is a direct
# re-identifier: one Odoo lookup turns it back into a person, a till or an invoice.
ID_KEYS = {
    "partner_id": "P", "cashier_id": "C", "card_id": "CARD",
    "history_id": "H", "order_id": "O", "refund_order": "O", "original_order": "O",
    "employee_id": "E", "user_id": "U",
}


def scrub_evidence(node, ctx: Ctx):
    """Return a copy of the evidence tree with every raw record id replaced by its stable
    masked token.

    Why this exists: the console tables were masked but the --json file was not, while _meta
    stamped itself "masked": true. A scan.json produced by the scheduled job and circulated as
    "the masked evidence file" was fully re-identifiable, and D7 named a member of staff in it.
    Tokens are the SAME ones the console prints, so a masked file is still a usable watch list —
    it just cannot be turned back into people without the database."""
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            if k in ID_KEYS and isinstance(v, int):
                if k == "partner_id":
                    out["subject"] = ctx.subject_for_partner(v)
                else:
                    out[k.replace("_id", "") + "_token"] = ctx.mask.token(ID_KEYS[k], v)
                continue
            out[k] = scrub_evidence(v, ctx)
        return out
    if isinstance(node, list):
        return [scrub_evidence(v, ctx) for v in node]
    if isinstance(node, tuple):
        return [scrub_evidence(v, ctx) for v in node]
    return node


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
        self.cashier_candidates = []    # fields that EXIST on pos.order
        self.cashier_field = None       # the one that is actually POPULATED (measured)
        self.cashier_fill = {}          # field -> share of window orders carrying a value
        self.cashier_coverage = 0.0     # fill rate of the chosen field, 0.0 if none
        self.branch_field = None
        self.cards = {}                 # card_id -> row
        self.cards_by_partner = defaultdict(list)
        self._card_partners_loaded = set()   # partners whose cards have already been fetched
        self.history = []               # loyalty.history rows IN WINDOW (every count uses this)
        self.hist_by_card = defaultdict(list)   # indexes also carry the post-window clawback tail
        self.hist_by_order = defaultdict(list)
        self.hist_ids = set()           # every loyalty.history id loaded, in any pass
        self.hist_tail_rows = 0         # rows loaded past u_end purely for D5 clawback matching
        self.hist_signed = True         # False when `issued` is absent and sign had to be inferred
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
    """Return (utc_start, utc_end, utc_hist_end, local_start, local_end, days).

    The window is expressed in LOCAL (Amman) calendar dates but Odoo stores date_order in
    UTC, so the boundaries are shifted. Getting this wrong silently moves a whole evening
    peak between windows, so the shift is printed in the header. End is EXCLUSIVE.

    utc_hist_end extends the loyalty.history upper bound by --d5-clawback-hours. D5 asks a
    FORWARD-looking question ("was this refund reversed within N hours?") and the daily job
    runs at --days 1, so with a window that stops at last midnight the clawback of a 22:00
    refund is created OUTSIDE the loaded data and the refund is scored as a full leak. The
    tail is used ONLY for clawback matching; every count and sum that describes the window
    still uses utc_end (see load_data's `_in_window` marker)."""
    off = timedelta(hours=args.tz_offset)
    if args.date_from or args.date_to:
        if not (args.date_from and args.date_to):
            die("ABORT: --from and --to must be given together (or use --days).", 1)
        try:
            l_start = datetime.strptime(args.date_from, "%Y-%m-%d")
            l_end = datetime.strptime(args.date_to, "%Y-%m-%d")
        except ValueError:
            die("ABORT: --from/--to must be YYYY-MM-DD.", 1)
        if l_end <= l_start:
            die("ABORT: empty window (--to must be after --from).", 1)
    else:
        # --days is validated at parse time (see build_argparser), so the message a user gets
        # for `--days 0` names --days, not the --from/--to flags they never passed.
        l_end = (datetime.utcnow() + off).replace(hour=0, minute=0, second=0, microsecond=0)
        if args.include_today:
            l_end += timedelta(days=1)
        l_start = l_end - timedelta(days=args.days)
    u_start = (l_start - off).strftime("%Y-%m-%d %H:%M:%S")
    u_end = (l_end - off).strftime("%Y-%m-%d %H:%M:%S")
    u_hist_end = (l_end + timedelta(hours=args.d5_clawback_hours) - off).strftime("%Y-%m-%d %H:%M:%S")
    return u_start, u_end, u_hist_end, l_start, l_end, (l_end - l_start).days


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
        die("ABORT: pos.order is not readable. Is POS installed, and does this user have\n"
            "  read access? Nothing in this scan can be measured without it.", 2)
    caps["pos_order_fields"] = sorted(po)
    # Existence is NOT usability. pos.order.employee_id is contributed by pos_hr and is present
    # in fields_get whenever pos_hr is installed, but it is only WRITTEN when a pos.config has
    # employee mode enabled. Choosing a field here on existence alone produced a D1 that tested
    # nothing and then printed an all-clear. So: record every candidate that EXISTS, read them
    # all, and let load_data pick the one that is actually POPULATED (see choose_cashier_field).
    ctx.cashier_candidates = [f for f in CASHIER_FIELDS if f in po]
    ctx.cashier_field = ctx.cashier_candidates[0] if ctx.cashier_candidates else None
    ctx.branch_field = "branch_id" if "branch_id" in po else ("config_id" if "config_id" in po else None)
    caps["has_loyalty"] = bool(o.fields("loyalty.card"))
    caps["has_history"] = bool(o.fields("loyalty.history"))
    caps["has_pos_payment"] = bool(o.fields("pos.payment"))
    caps["has_hr_employee"] = bool(o.fields("hr.employee"))
    caps["has_res_users"] = bool(o.fields("res.users"))
    # Only genuine LINKAGE fields belong here. pos.order.refund_orders_count is an Integer
    # computed alongside refunded_order_id — it counts refunds and carries no id, so listing it
    # made the header assert a linkage that does not exist. Both survivors have a D5 branch.
    caps["refund_link_field"] = next(
        (f for f in ("refunded_order_id", "refunded_order_ids") if f in po), None)
    caps["has_refund_line_link"] = o.has("pos.order.line", "refunded_orderline_id")
    caps["history_fields"] = sorted(o.fields("loyalty.history")) if caps["has_history"] else []
    caps["card_fields"] = sorted(o.fields("loyalty.card")) if caps["has_loyalty"] else []

    sub("capability probe (fields_get before anything is read)")
    kv("cashier identity field(s) present",
       ", ".join(ctx.cashier_candidates) if ctx.cashier_candidates else "NONE — D1 cannot run")
    kv("cashier field actually used", "measured after the bulk read (fill rate decides)")
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
            lo, hi = per_point[0], per_point[-1]
            # A median across rewards that DISAGREE is not an exact reading of anything. The
            # spread was being computed and then never printed, so a configuration that
            # contradicts itself was presented as measured fact. Print it, and say so.
            ambiguous = len(per_point) > 1 and lo > 0 and (hi / lo) > 1.2
            meta.update({"value": pctl(per_point, 50),
                         "basis": "median of %d cash-discount reward(s) in loyalty.reward" % len(per_point),
                         "exactness": ("EXACT but AMBIGUOUS (rewards disagree — see spread)"
                                       if ambiguous else "EXACT (read from loyalty.reward configuration)"),
                         "spread": {"min": lo, "max": hi, "n": len(per_point),
                                    "ambiguous": ambiguous}})
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
    sp = meta.get("spread") or {}
    if sp.get("n", 0) > 1:
        kv("spread across rewards", "min %.4f  max %.4f  (n=%d)" % (sp["min"], sp["max"], sp["n"]))
        if sp.get("ambiguous"):
            warn("The cash-discount rewards do NOT agree on what a point is worth (%.4f .. %.4f "
                 "JOD/point). Every JOD figure below uses the MEDIAN, %.4f. Treat the totals as "
                 "a mid-point of a configured range, not a single measured value, and settle the "
                 "reward configuration before quoting any of them."
                 % (sp["min"], sp["max"], meta["value"]))
    exact_unambiguous = meta["exactness"].startswith("EXACT") and not sp.get("ambiguous")
    if meta["value"] is not None:
        if abs(meta["value"] - 0.01) < 1e-9 and exact_unambiguous:
            derive("The owner's verbal claim '1 point = 1 qirsh' is VERIFIED by the configuration.")
        elif exact_unambiguous:
            derive("The owner's verbal claim '1 point = 1 qirsh (0.01 JOD)' is REFUTED: the "
                   "configuration says %.4f JOD per point. Every JOD figure below uses the "
                   "configured value, not the claim." % meta["value"])
        elif meta["exactness"].startswith("ASSUMPTION"):
            warn("Point value could NOT be read from configuration; %.4f JOD/point is an "
                 "ASSUMPTION from --point-value. Every JOD figure below scales linearly with "
                 "it: if the real value is double, every JOD-at-risk number doubles."
                 % meta["value"])
        else:   # EXACT but AMBIGUOUS — the spread warning above already said what to do
            derive("The claim '1 point = 1 qirsh' can be neither verified nor refuted while the "
                   "rewards disagree with each other. Settle the configuration, then re-run.")
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
def choose_cashier_field(ctx: Ctx) -> None:
    """Pick the cashier field by MEASURED POPULATION, not by the order of CASHIER_FIELDS.

    pos.order.employee_id exists whenever pos_hr is installed but is only written when a
    pos.config has employee mode enabled. Picking it on existence alone gave D1 a field that
    was False on every row: no member was testable, so D1 fell through to its "cashier
    concentration is within chance" line and handed the owner a written all-clear on the
    dominant fraud vector. The fill rate is measured here and printed, and D1 refuses to draw
    a negative conclusion below the floor."""
    n = float(len(ctx.orders)) or 1.0
    for f in ctx.cashier_candidates:
        ctx.cashier_fill[f] = sum(1 for r in ctx.orders if m2o_id(r.get(f))) / n
    best = max(ctx.cashier_fill.items(), key=lambda kv_: kv_[1], default=(None, 0.0))
    ctx.cashier_field, ctx.cashier_coverage = (best[0] if best[1] > 0 else None), best[1]
    if ctx.cashier_fill:
        kv("cashier field fill rate", "  ".join("%s %.1f%%" % (f, 100 * v)
                                                for f, v in sorted(ctx.cashier_fill.items(),
                                                                   key=lambda kv_: -kv_[1])))
    kv("cashier field actually used",
       ("%s (populated on %.1f%% of orders)" % (ctx.cashier_field, 100 * ctx.cashier_coverage))
       if ctx.cashier_field else "NONE POPULATED — D1 cannot run")


def load_data(ctx: Ctx, u_start: str, u_end: str, u_hist_end: str) -> None:
    """One bulk read of each model the detectors share. Volume note: Almond runs ~3,238
    invoices/day, so a 30-day window is ~97k pos.order rows and a 90-day window ~291k. Rows
    are BYTES_PER_ORDER bytes each once loaded, so the footprint is ESTIMATED from a
    search_count and printed BEFORE the read starts — a row ceiling alone told nobody that
    --days 90 wants most of a gigabyte. If a read truncates, it is recorded and every total
    derived from it is printed as a LOWER BOUND.

    Two reads are deliberately NOT unbounded:
      * pos.order carries only the fields a detector actually reads. In particular the refund
        LINK field is not requested here: pos.order.refunded_order_id is a NON-STORED compute
        that traverses order lines, so putting it in a 97k-row paged read forces Odoo to walk
        every line in the window to populate a field D5 needs for a few hundred refunds. D5
        reads it for those ids only.
      * loyalty.card is domained on the partners in scope instead of the whole customer base.
        D3 tops it up for staff partners who did not transact."""
    o = ctx.o
    sub("bulk read (window %s .. %s UTC)" % (u_start, u_end))

    # Only fields a detector reads. `name`, `session_id` and `amount_paid` were carried for
    # ~97k rows and never looked at; config_id is dropped when branch_id exists.
    want = ["date_order", "partner_id", "amount_total", "amount_tax"]
    if ctx.branch_field:
        want.append(ctx.branch_field)
    want.extend(ctx.cashier_candidates)          # both, so fill rate can be measured
    present, _ = o.pick("pos.order", want)
    dom = [("date_order", ">=", u_start), ("date_order", "<", u_end), ("state", "in", SALE_STATES)]

    expected = o.count("pos.order", dom)
    if expected is not None:
        mb = expected * BYTES_PER_ORDER / 1e6
        kv("pos.order rows to read (search_count)", "%d  (~%.0f MB resident once loaded)"
           % (expected, mb))
        if mb > FOOTPRINT_WARN_MB:
            warn("This window needs roughly %.0f MB for pos.order alone, before loyalty.history "
                 "and before xmlrpc's parse buffers. On a laptop that is where swapping starts. "
                 "Shorten --days, or run it on a machine sized for it — the ceiling below is a "
                 "ROW count (%d) and would not have stopped this." % (mb, MAX_ROWS))
    ctx.orders, trunc = o.read_all("pos.order", dom, present + ["id"], order="id", label="pos.order")
    if trunc:
        ctx.truncated.append("pos.order")
        warn("pos.order read hit the %d-row ceiling. Every count and sum from orders below is a "
             "LOWER BOUND. Re-run with a shorter --days." % MAX_ROWS)
    kv("pos.order rows in window", len(ctx.orders))
    if not ctx.orders:
        print("\nNo settled POS orders in this window. Nothing to scan.")
        raise SystemExit(3)

    choose_cashier_field(ctx)
    cf = ctx.cashier_field
    for r in ctx.orders:
        r["_dt"] = parse_dt(r.get("date_order"))
        r["_pid"] = m2o_id(r.get("partner_id"))
        r["_cashier"] = m2o_id(r.get(cf)) if cf else None
        r["_cashier_name"] = m2o_name(r.get(cf)) if cf else None
        r["_branch"] = m2o_id(r.get(ctx.branch_field)) if ctx.branch_field else None
        r["_branch_name"] = m2o_name(r.get(ctx.branch_field)) if ctx.branch_field else None
        r["_amt"] = float(r.get("amount_total") or 0.0)
        r["_in_window"] = True      # D5 may add out-of-window originals to orders_by_id later
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

    # loyalty cards — SCOPED to the partners who transacted in the window. An empty domain here
    # read the entire customer base (up to the row ceiling, ~200 round trips) to discard nearly
    # all of it. D3 tops up staff partners; the history pass below tops up cards seen in the
    # ledger but held by non-transacting partners.
    if ctx.caps["has_loyalty"]:
        total_cards = o.count("loyalty.card", [])
        if total_cards is not None:
            kv("loyalty.card rows in database", total_cards)
        load_cards_for_partners(ctx, set(ctx.by_partner), label="transacting partners")
        kv("loyalty.card rows loaded (scoped)", len(ctx.cards))
        kv("distinct card-holding partners", len(ctx.cards_by_partner))
    else:
        gap("loyalty.card is not readable — D3/D4/D7 will report UNAVAILABLE.")

    # loyalty history: the WINDOW, plus a forward tail for D5's clawback horizon
    if ctx.caps["has_history"]:
        want_h = ["card_id", "issued", "used", "points", "description", "create_date", "create_uid",
                  "order_id", "order_model", "pos_order_id"]
        present, absent = o.pick("loyalty.history", want_h)
        if absent:
            gap("loyalty.history has no field(s): %s. Detectors below say where that bites."
                % ", ".join(absent))
        ctx.hist_signed = "issued" in present and "used" in present
        hdom = [("create_date", ">=", u_start), ("create_date", "<", u_hist_end)]
        rows_h, trunc = o.read_all("loyalty.history", hdom, present + ["id"],
                                   order="id", label="loyalty.history")
        if trunc:
            ctx.truncated.append("loyalty.history")
            warn("loyalty.history read truncated at %d rows; point totals are LOWER BOUNDS." % MAX_ROWS)
        for h in rows_h:
            ctx.hist_ids.add(h["id"])
            _prepare_history_row(h, present, in_window=(str(h.get("create_date") or "") < u_end))
            ctx.hist_by_card[h["_card"]].append(h)
            if h["_order"]:
                ctx.hist_by_order[h["_order"]].append(h)
            if h["_in_window"]:
                ctx.history.append(h)
            else:
                ctx.hist_tail_rows += 1
        kv("loyalty.history rows in window", len(ctx.history))
        kv("clawback tail read past the window", "%d rows, up to %s UTC (+%d h, D5 only)"
           % (ctx.hist_tail_rows, u_hist_end, ctx.args.d5_clawback_hours))
        # top up cards referenced by the ledger but held by partners who did not transact
        missing_cards = {h["_card"] for h in ctx.history if h["_card"] and h["_card"] not in ctx.cards}
        if missing_cards and ctx.caps["has_loyalty"]:
            load_cards_by_id(ctx, missing_cards)
            kv("extra cards loaded from the ledger", len(missing_cards))
        linked = sum(1 for h in ctx.history if h["_order"])
        share = 100.0 * linked / max(1, len(ctx.history))
        kv("history rows linked to a POS order", "%d of %d (%.1f%%)" % (linked, len(ctx.history), share))
        if not ctx.hist_signed:
            warn("loyalty.history has no `issued`/`used` pair on this build, so the sign of each "
                 "movement is INFERRED from `points`. D5 keeps a signed copy (_signed) and says "
                 "so; it will not print the EXACT label on this build.")
        if ctx.history and share < 95.0:
            warn("Only %.1f%% of history rows carry a POS order link. Below that, D1/D2/D6 price "
                 "an order's points as amount x the configured rate instead of reading what was "
                 "actually issued, so their JOD columns are DERIVED, not EXACT; D5 and D7 fall "
                 "back to time-proximity matching, which is a HEURISTIC. Each detector prints "
                 "its own basis — read those, not this warning alone." % share)
    else:
        gap("loyalty.history is not readable — D4/D5/D7 lose their primary evidence.")

    # partners actually referenced (names/phones for masking, employee/user linkage for D3)
    load_partners(ctx, set(ctx.by_partner) | set(ctx.cards_by_partner))
    kv("partners loaded for identification", len(ctx.partners))


def _prepare_history_row(h: dict, present: list, in_window: bool) -> None:
    """Derive the fields every detector reads off a loyalty.history row.

    Odoo's convention (the same one tools/loyalty_measure.py documents): a history row carries
    `issued` and `used` as TWO NON-NEGATIVE floats — a reversal is written to `used`, never as a
    negative `issued`. `_signed` is the single signed movement, so a detector can ask "was this
    a reversal?" without caring which shape the build uses."""
    h["_dt"] = parse_dt(h.get("create_date"))
    h["_card"] = m2o_id(h.get("card_id"))
    h["_issued"] = float(h.get("issued") or 0.0)
    h["_used"] = float(h.get("used") or 0.0)
    if "issued" not in present and "points" in present:
        p = float(h.get("points") or 0.0)
        h["_issued"], h["_used"] = (p, 0.0) if p >= 0 else (0.0, -p)
        h["_signed"] = p                       # keep the sign the fallback would have clamped away
    else:
        h["_signed"] = h["_issued"] - h["_used"]
    h["_order"] = _history_order_id(h)
    h["_in_window"] = bool(in_window)


def load_cards_for_partners(ctx: Ctx, pids: set, label: str = "") -> int:
    """Read loyalty.card for a NAMED set of partners. Never an empty domain: that pulls the
    whole customer base over XML-RPC to throw almost all of it away."""
    pids = {p for p in pids if p and p not in ctx._card_partners_loaded}
    if not pids or not ctx.caps.get("has_loyalty"):
        return 0
    present, _ = ctx.o.pick("loyalty.card", ["partner_id", "program_id", "points", "code",
                                             "expiration_date", "create_date"])
    rows, trunc = ctx.o.read_all("loyalty.card", [("partner_id", "in", sorted(pids))],
                                 present + ["id"], label="loyalty.card/%s" % (label or "scoped"))
    if trunc:
        ctx.truncated.append("loyalty.card")
    _index_cards(ctx, rows)
    ctx._card_partners_loaded |= pids
    return len(rows)


def load_cards_by_id(ctx: Ctx, card_ids: set) -> int:
    """Cards referenced by the ledger whose holder never transacted in the window."""
    card_ids = {c for c in card_ids if c and c not in ctx.cards}
    if not card_ids or not ctx.caps.get("has_loyalty"):
        return 0
    present, _ = ctx.o.pick("loyalty.card", ["partner_id", "program_id", "points", "code",
                                             "expiration_date", "create_date"])
    _index_cards(ctx, ctx.o.read_ids("loyalty.card", sorted(card_ids), present + ["id"]))
    return len(card_ids)


def _index_cards(ctx: Ctx, rows: list) -> None:
    for c in rows:
        if c["id"] in ctx.cards:
            continue
        c["_pid"] = m2o_id(c.get("partner_id"))
        ctx.cards[c["id"]] = c
        if c["_pid"]:
            ctx.cards_by_partner[c["_pid"]].append(c)


def load_partners(ctx: Ctx, pids: set) -> int:
    """res.partner rows for masking and D3 linkage — only for ids already in scope."""
    pids = {p for p in pids if p and p not in ctx.partners}
    if not pids:
        return 0
    pf, _ = ctx.o.pick("res.partner", ["name", "phone", "mobile", "email", "create_date",
                                       "employee", "user_ids"])
    for p in ctx.o.read_ids("res.partner", sorted(pids), pf + ["id"]):
        ctx.partners[p["id"]] = p
    return len(pids)


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
    unavailable_text = (
        "pos.order carries no POPULATED cashier identity here, so an order cannot be attributed "
        "to a cashier. D1 CANNOT RUN. This is itself the most important finding in the scan: "
        "without cashier attribution the dominant fraud vector is unobservable, and fixing it "
        "(enable POS employee mode on every pos.config) is a prerequisite to launching.")
    if not ctx.cashier_candidates:
        gap(unavailable_text + " Neither employee_id nor user_id exists on pos.order on this build.")
        return {"status": "UNAVAILABLE", "reason": "no cashier field on pos.order"}
    # A field that EXISTS but is EMPTY is not a negative result, it is a missing measurement.
    # Below the floor D1 must say UNAVAILABLE, never "concentration is within chance".
    if ctx.cashier_coverage < ctx.args.d1_min_cashier_coverage:
        gap(unavailable_text + " The best-populated candidate is %s, filled on only %.1f%% of "
            "orders (floor for testing: %.0f%%) — POS employee mode is off, or on at only some "
            "tills."
            % (ctx.cashier_field or "none", 100 * ctx.cashier_coverage,
               100 * ctx.args.d1_min_cashier_coverage))
        return {"status": "UNAVAILABLE",
                "reason": "cashier field %s is populated on only %.1f%% of orders — POS employee "
                          "mode is off" % (ctx.cashier_field, 100 * ctx.cashier_coverage),
                "cashier_coverage": ctx.cashier_coverage}

    flags("Members whose points were issued overwhelmingly by a single cashier — the signature of "
          "a cashier typing a phone number they control onto walk-in sales.")
    rule("For member m and cashier c: k = m's ATTRIBUTED earning orders served by c, n = m's "
         "attributed earning orders. The null p is the branch-mix-weighted average of c's own "
         "share of ATTRIBUTED EARNING orders at each branch m used: p = sum_b (w_b/n) x "
         "(c_b/T_b) — so a member who only ever visits a one-cashier branch is NOT flagged. "
         "Flag when n >= %d, k/n >= %.2f, and the exact binomial tail P(X>=k | n,p) is below the "
         "Bonferroni-corrected alpha %g/(tests) — i.e. still significant after every member "
         "tested." % (ctx.args.d1_min_orders, ctx.args.d1_concentration, ctx.args.alpha))

    # ---- the null model, measured over the SAME population as the numerator -------------
    # Two corrections live here, and they resolve into one rule.
    #   (a) The denominator must count only CASHIER-ATTRIBUTED orders. Counting orders with no
    #       cashier stamped scaled every measured share down by the unattributed fraction, so
    #       p_null was systematically too low and every p-value systematically too small.
    #   (b) The population must be EARNING orders, not all traffic. k/n is measured over the
    #       member's earning orders (identified customers who gave a phone number); a null built
    #       from all traffic including anonymous walk-ins flags the cashier who simply asks for
    #       the phone number most often. (b) is the stricter statement and subsumes (a): the
    #       counters below are restricted to orders that are both attributed AND earning.
    branch_total = defaultdict(int)
    branch_cashier = defaultdict(int)
    for rows in earn["map"].values():
        for r in rows:
            if r["_cashier"]:
                branch_total[r["_branch"]] += 1
                branch_cashier[(r["_branch"], r["_cashier"])] += 1

    emap = earn["map"]
    candidates = [(pid, rows) for pid, rows in emap.items()
                  if len([r for r in rows if r["_cashier"]]) >= ctx.args.d1_min_orders]
    tests = max(1, len(candidates))
    alpha_corrected = ctx.args.alpha / tests
    kv("earning-order basis", earn["basis"])
    kv("cashier attribution coverage", "%.1f%% of window orders carry %s"
       % (100 * ctx.cashier_coverage, ctx.cashier_field))
    kv("null model population", "%d attributed earning orders across %d branches"
       % (sum(branch_total.values()), len(branch_total)))
    kv("members tested (n >= %d ATTRIBUTED earning orders)" % ctx.args.d1_min_orders, len(candidates))
    kv("Bonferroni-corrected alpha", "%g / %d = %.3g" % (ctx.args.alpha, tests, alpha_corrected))
    if ctx.cashier_coverage < 0.9:
        warn("Cashier attribution is incomplete (%.1f%% of orders). D1's numbers are an ESTIMATE, "
             "not an EXACT reading: the %.1f%% of orders with no cashier stamped are invisible to "
             "both the numerator and the null, so a member served on those tills is undertested. "
             "Enable POS employee mode everywhere and re-run before acting on this table."
             % (100 * ctx.cashier_coverage, 100 * (1 - ctx.cashier_coverage)))

    conc_values, rows_out = [], []
    for pid, all_rows in candidates:
        rows = [r for r in all_rows if r["_cashier"]]     # numerator population = attributed
        n = len(rows)
        by_c = defaultdict(list)
        for r in rows:
            by_c[r["_cashier"]].append(r)
        if not by_c:
            continue
        cid, orders_c = max(by_c.items(), key=lambda kv_: len(kv_[1]))
        k = len(orders_c)
        conc = k / float(n)
        conc_values.append(conc)
        # null: the MIX-WEIGHTED AVERAGE OF SHARES the rule above promises — sum_b (w_b/n)(c_b/T_b).
        # The old code accumulated weighted counts over weighted totals and divided, which is a
        # traffic-weighted POOLED rate: one high-volume branch in the mix inflated the
        # denominator without touching the numerator, collapsing p_null and manufacturing
        # 1e-13 p-values for exactly the members the rule text says are safe.
        mix = defaultdict(int)
        for r in rows:
            mix[r["_branch"]] += 1
        p_null, weight = 0.0, 0.0
        for b, w in mix.items():
            bt = branch_total.get(b, 0)
            if bt:                                   # a branch with no attributed traffic
                p_null += w * (branch_cashier.get((b, cid), 0) / float(bt))
                weight += w                          # carries no information: drop and renormalise
        p_null = (p_null / weight) if weight else 0.0
        if p_null <= 0.0 or p_null >= 1.0:
            continue
        p_val = binom_sf(k, n, p_null)
        if conc < ctx.args.d1_concentration or p_val > alpha_corrected:
            continue
        tally = BasisTally()
        pts = sum(tally.add(ctx, r) for r in orders_c)
        excess = max(0.0, k - p_null * n)
        pts_excess = (pts * excess / k) if k else 0.0
        rows_out.append({
            "partner_id": pid, "cashier_id": cid,
            "cashier": ctx.mask.subject("C", cid, orders_c[0]["_cashier_name"]),
            "n": n, "n_raw": len(all_rows), "k": k, "conc": conc, "p_null": p_null, "p_value": p_val,
            "points_on_concentrated_orders": pts, "points_basis": tally.label(),
            "excess_orders": excess,
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
            "%d/%d" % (x["k"], x["n"]), x["n_raw"], "%.0f%%" % (100 * x["conc"]),
            "%.1f%%" % (100 * x["p_null"]), "1e-%.0f" % neg_log10(x["p_value"]),
            "%.2f" % x["jod_at_risk"]]
           for x in rows_out[:ctx.args.top]],
          ["member (masked)", "dominant cashier", "k/n", "earn ord", "conc", "chance", "p",
           "JOD risk"], aligns="llrrrrrr")
    kv("members flagged", len(rows_out))
    kv("JOD AT RISK (D1)",
       "%.2f  = EXCESS points (issued above the chance expectation) x %.4f JOD/point"
       % (total_jod, ctx.point_value or 0.0))
    bullet("'k/n' is measured over ATTRIBUTED earning orders; 'earn ord' is the member's raw "
           "earning-order count. When the two differ, the gap is orders with no cashier stamped — "
           "they are excluded from the test on BOTH sides, so the base is visible here.")
    bullet("Read 'chance' as: the share of ATTRIBUTED EARNING orders this cashier serves anyway at "
           "the branches this member uses, averaged over the member's own branch mix. Read 'p' as: "
           "how likely that k/n would happen if the member simply met whoever was on the till. "
           "1e-12 means once in a trillion.")
    bullet("JOD at risk counts only the EXCESS above chance, not the whole concentrated block — "
           "the member genuinely would have met this cashier some of the time.")
    if not rows_out:
        # A negative result is only reportable if something was actually tested. `candidates`
        # already requires the minimum ATTRIBUTED earning orders, so len(candidates) == 0 means
        # nothing was testable, which is a gap, not an all-clear.
        if not candidates:
            gap("No member reached %d attributed earning orders in this window, so NOTHING was "
                "tested. This is NOT an all-clear on cashier self-crediting — it is a statement "
                "that the window is too short or attribution too sparse to test it. Re-run at "
                "--days 90; if it still says this, fix attribution first."
                % ctx.args.d1_min_orders)
        else:
            derive("No member survived the corrected threshold, out of %d actually tested. That "
                   "is a real result and worth stating in the launch memo: at this window length, "
                   "with %.1f%% cashier attribution, concentration is within chance. Re-run at "
                   "--days 90 before concluding anything durable."
                   % (len(candidates), 100 * ctx.cashier_coverage))
    for x in rows_out:
        ctx.add_risk(x["partner_id"], "D1", x["jod_at_risk"],
                     "%d/%d orders on one cashier (p=1e-%.0f)" % (x["k"], x["n"], neg_log10(x["p_value"])))
    res["offenders"] = rows_out
    res["jod_at_risk"] = total_jod
    res["alpha_corrected"] = alpha_corrected
    res["members_tested"] = len(candidates)
    res["cashier_field"] = ctx.cashier_field
    res["cashier_coverage"] = ctx.cashier_coverage
    res["exactness"] = "ESTIMATE (partial cashier attribution)" if ctx.cashier_coverage < 0.9 else "EXACT"
    ctx.detector_jod["D1 self-crediting"] = total_jod
    return res


def _issued_for_order(ctx: Ctx, order: dict) -> tuple:
    """(points, basis) for one order. Returns a PAIR so every caller can label its own JOD
    column instead of silently mixing the two: EXACT is read from loyalty.history, DERIVED is
    amount_total x the mean money-mode rule rate (tax-INCLUSIVE — D7 tests both tax bases
    because that basis is unsettled, so a DERIVED figure here is an upper reading of it)."""
    rows = ctx.hist_by_order.get(order["id"])
    if rows:
        return sum(r["_issued"] for r in rows), "EXACT"
    rates = [r for rl in ctx.program_rate.values() for r in rl]
    if rates and order["_amt"] > 0:
        return order["_amt"] * (sum(rates) / len(rates)), "DERIVED"
    return 0.0, "NONE"


# Words Odoo and its localisations put in loyalty.history.description when a movement is a
# reversal rather than a customer redemption. Matched case-insensitively, as a hint only.
REVERSAL_HINTS = ("refund", "reversal", "revers", "cancel", "return", "claw",
                  "استرجاع", "إلغاء", "الغاء", "مرتجع")


def _is_reversal(ctx: Ctx, h: dict) -> bool:
    """Is this `used` movement a CLAWBACK rather than a customer redemption?

    Odoo writes both to the same non-negative `used` field, so the two are only separable by
    context. Three tells, in order of strength: the row sits on an order that also ISSUED
    points (you cannot redeem against the sale that granted them); the row's order is a refund
    (negative amount); or the description names a reversal. Conservative by design — a row that
    matches none of these is treated as a genuine redemption."""
    if h.get("_used", 0.0) <= 0:
        return False
    oid = h.get("_order")
    if oid:
        siblings = ctx.hist_by_order.get(oid) or []
        if any(s is not h and s["_issued"] > 0 for s in siblings):
            return True
        o_ = ctx.orders_by_id.get(oid)
        if o_ and o_["_amt"] < 0:
            return True
    desc = str(h.get("description") or "").lower()
    return any(w in desc for w in REVERSAL_HINTS)


class BasisTally:
    """Counts how each detector's points were obtained, so it can print one honest label."""

    def __init__(self):
        self.n = defaultdict(int)

    def add(self, ctx: Ctx, order: dict) -> float:
        pts, basis = _issued_for_order(ctx, order)
        self.n[basis] += 1
        return pts

    def label(self) -> str:
        tot = sum(self.n.values())
        if not tot:
            return "no priced orders"
        if self.n.get("EXACT", 0) == tot:
            return "EXACT (read from loyalty.history)"
        if self.n.get("EXACT", 0) == 0:
            return "DERIVED (amount x configured rate — no linked issuance on these orders)"
        return ("MIXED: %.1f%% EXACT (loyalty.history), %.1f%% DERIVED (amount x rate)"
                % (100.0 * self.n.get("EXACT", 0) / tot, 100.0 * self.n.get("DERIVED", 0) / tot))


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
    # D2 consumes the same earning-order map as D1 and prices it with the same fallback, so it
    # must disclose the same basis. Without this the JOD column could be entirely DERIVED
    # (amount x rate) with nothing on the page saying so.
    kv("earning-order basis", earn["basis"])
    tally = BasisTally()
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
                rec["burst_days"].append((d, len(rs), sum(tally.add(ctx, r) for r in rs)))
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
        rec["points"] += sum(tally.add(ctx, ctx.orders_by_id[i])
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
    kv("basis of the points priced above", tally.label())
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
    return {"status": "OK", "offenders": ranked, "jod_at_risk": total_jod,
            "earn_basis": earn["basis"], "points_basis": tally.label()}


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

    # fields_get succeeding does NOT mean the rows are readable: hr.employee read is gated on
    # hr.group_hr_user, and this scan is meant to run under a read-scoped key. Each read is
    # guarded on its own so D3 degrades to the path that still works instead of taking the
    # whole report down with it.
    if ctx.caps["has_hr_employee"]:
        try:
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
        except Exception as exc:
            gap("hr.employee exists but is not readable by this user (%s: %s). This is the usual "
                "shape of a read-scoped API key without the HR group. Employee linkage falls back "
                "to res.users only, so a member of staff whose partner has no internal user will "
                "be MISSED here — grant HR read, or accept the gap and say so."
                % (type(exc).__name__, str(exc)[:110]))
    else:
        gap("hr.employee not readable — employee linkage is limited to res.users.")

    if ctx.caps["has_res_users"]:
        try:
            uf, _ = o.pick("res.users", ["partner_id", "login", "active", "share"])
            # Filter SERVER-SIDE. An empty domain read every res.users row — on a database where
            # the Expo app gives each customer a portal login, that is the whole member base
            # pulled over XML-RPC to discard nearly all of it in Python.
            udom = [("share", "=", False)] if "share" in uf else []
            users, _ = o.read_all("res.users", udom, uf + ["id"])
            for u in users:
                if u.get("share"):      # portal/public users are customers, not staff
                    continue
                pid = m2o_id(u.get("partner_id"))
                if pid:
                    staff_partners.setdefault(pid, {"kind": "internal user", "user_id": u["id"],
                                                    "active": u.get("active")})
            kv("internal res.users rows", sum(1 for u in users if not u.get("share")))
            if not udom:
                warn("res.users has no `share` field on this build, so internal users could not be "
                     "separated in the domain and every user row was read. Portal customers are "
                     "still excluded below, but the read was larger than it needed to be.")
        except Exception as exc:
            gap("res.users is not readable by this user (%s: %s) — internal-user linkage is "
                "missing from the table below." % (type(exc).__name__, str(exc)[:110]))
    rule("A card is flagged when its partner_id is the work contact or home address of an "
         "hr.employee, or the partner of a non-share (internal) res.users. Portal/share users "
         "are excluded — those are customers with app logins, not staff.")

    # Cards are loaded scoped to transacting partners, so top up the staff partners who hold a
    # card but did not buy anything in the window — otherwise D3 would miss exactly the dormant
    # staff card that is the most interesting row in this table.
    load_cards_for_partners(ctx, set(staff_partners), label="staff partners")
    load_partners(ctx, set(staff_partners))

    rows_out = []
    for pid, meta in staff_partners.items():
        cards = ctx.cards_by_partner.get(pid) or []
        if not cards:
            continue
        bal = sum(float(c.get("points") or 0.0) for c in cards)
        orders = ctx.by_partner.get(pid) or []
        # _in_window: hist_by_card also carries D5's forward clawback tail and any ledger row
        # pulled for an out-of-window original. A "points earned in the window" column must not
        # include either.
        earned = sum(h["_issued"] for c in cards
                     for h in ctx.hist_by_card.get(c["id"], []) if h["_in_window"])
        used = sum(h["_used"] for c in cards
                   for h in ctx.hist_by_card.get(c["id"], []) if h["_in_window"])
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

    per_day_points, rows_out, reversal_rows = [], [], 0
    for cid, rows in ctx.hist_by_card.items():
        if not cid:
            continue
        # Only rows INSIDE the window count here: hist_by_card also carries the forward
        # clawback tail that D5 needs, and a velocity figure must describe the stated window.
        rows = sorted([r for r in rows if r["_dt"] and r["_in_window"]], key=lambda r: r["_dt"])
        earns = [r for r in rows if r["_issued"] > 0]
        # A refund clawback is written to `used` exactly like a redemption. Counting reversals as
        # redemptions inflated the burn-on-sight share — the quiet signal this detector exists to
        # find — so a `used` row sharing an order with an `issued` row is excluded as a reversal.
        redeems = []
        for r in rows:
            if r["_used"] <= 0:
                continue
            if _is_reversal(ctx, r):
                reversal_rows += 1
                continue
            redeems.append(r)
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
    kv("`used` rows excluded as refund reversals", "%d (they are clawbacks, not redemptions)"
       % reversal_rows)
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

    # link refund -> original.
    # The linkage field is read HERE, for the refund ids only. pos.order.refunded_order_id is a
    # NON-STORED compute (it walks order lines), so requesting it in the ~97k-row bulk read made
    # Odoo compute refund linkage for the entire window to serve a few hundred rows. Same rule
    # applies to any other non-stored field: never put one in a full-window read.
    link_basis, links = None, {}
    lf = ctx.caps.get("refund_link_field")
    if lf in ("refunded_order_id", "refunded_order_ids") and refunds:
        try:
            for row in o.read_ids("pos.order", [r["id"] for r in refunds], [lf]):
                v = row.get(lf)
                if lf == "refunded_order_ids":
                    # many2many/one2many: take the first original it points at
                    oid = (v[0] if isinstance(v, (list, tuple)) and v and isinstance(v[0], int)
                           else m2o_id(v))
                else:
                    oid = m2o_id(v)
                if oid:
                    links[row["id"]] = oid
            link_basis = "EXACT (pos.order.%s, read for the %d refund rows only)" % (lf, len(refunds))
        except Exception as exc:
            warn("could not read pos.order.%s for the refunds: %s" % (lf, str(exc)[:110]))
    if not link_basis and ctx.caps.get("has_refund_line_link") and refunds:
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

    # A refund raised today against yesterday's sale links correctly and then resolves to an
    # order OUTSIDE the window. Dropping those silently made the one detector that claims a
    # REALISED loss report near-zero by construction — worst at --days 1, which is the job that
    # reaches Finance. So: fetch the missing originals (and their ledger rows) regardless of the
    # window, and count whatever still cannot be resolved.
    out_of_window, unresolved = _load_missing_originals(ctx, set(links.values()))
    if out_of_window:
        kv("originals loaded from OUTSIDE the window", out_of_window)
    if unresolved:
        kv("refunds whose original order could not be loaded", unresolved)
        warn("%d refund(s) link to an original this scan could not read. Those refunds are NOT "
             "counted below, so the leak total is a LOWER BOUND, not an exact figure." % unresolved)

    rule("For every refund R linked to an original order O: I = points issued on O (from "
         "loyalty.history). Expected clawback = I x |refund value| / |original value| (a partial "
         "refund should claw back proportionally). Actual clawback = the reversal booked against "
         "R or O — Odoo writes a reversal to loyalty.history.`used` (both `issued` and `used` are "
         "NON-NEGATIVE floats), so `used` is the primary term and a negative `issued` is accepted "
         "only as a fallback for builds that store signed points. Failing a link, a reversal on "
         "the same card within %d hours after R counts, provided it is not an ordinary customer "
         "redemption. Leak = expected - actual, floored at zero."
         % ctx.args.d5_clawback_hours)

    now_utc = datetime.utcnow()
    horizon = timedelta(hours=ctx.args.d5_clawback_hours)
    leaks, checked, clawed_ok, pending = [], 0, 0, 0
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
        # Clawback = the REVERSAL side. The previous version looked only for `issued` < 0, which
        # Odoo never writes: reversals go to `used`. `actual` was therefore 0.0 for every refund,
        # every refunded earning order was reported as leaking, and the detector labelled EXACT
        # printed a fabricated 100% clawback-failure rate and annualised it.
        cards = {h["_card"] for h in ctx.hist_by_order.get(oid, [])}
        actual = 0.0
        for h in ctx.hist_by_order.get(r["id"], []) + ctx.hist_by_order.get(oid, []):
            actual += h["_used"]                              # the normal Odoo shape
            if h["_signed"] < 0 and h["_used"] <= 0:          # signed-points builds
                actual += -h["_signed"]
        if actual <= 0 and r["_dt"]:
            for c in cards:
                for h in ctx.hist_by_card.get(c, []):
                    if not h["_dt"]:
                        continue
                    if not (0 <= (h["_dt"] - r["_dt"]).total_seconds() <= horizon.total_seconds()):
                        continue
                    # Time proximity alone would swallow a genuine redemption made minutes after
                    # the refund and score the leak as zero. Only reversal-shaped rows count.
                    if h["_used"] > 0 and _is_reversal(ctx, h):
                        actual += h["_used"]
                    elif h["_signed"] < 0 and h["_used"] <= 0:
                        actual += -h["_signed"]
        leak = max(0.0, expected - actual)
        if leak <= 0:
            clawed_ok += 1
            continue
        # A refund whose clawback horizon has not closed yet cannot be called a leak: the
        # reversal may still be written. Report it as PENDING and keep it out of the total.
        if r["_dt"] and (r["_dt"] + horizon) > now_utc:
            pending += 1
            continue
        leaks.append({"refund_order": r["id"], "original_order": oid,
                      "partner_id": orig["_pid"] or r["_pid"],
                      "cashier": ctx.mask.subject("C", r["_cashier"], r["_cashier_name"])
                      if r["_cashier"] else "—",
                      "refund_value": r["_amt"], "original_value": orig["_amt"],
                      "points_issued": issued, "expected_clawback": expected,
                      "actual_clawback": actual, "leaked_points": leak,
                      "jod_at_risk": ctx.points_to_jod(leak),
                      "original_in_window": bool(orig.get("_in_window", True)),
                      "hours_between": ((r["_dt"] - orig["_dt"]).total_seconds() / 3600.0)
                      if (r["_dt"] and orig["_dt"]) else None})
    leaks.sort(key=lambda x: -x["jod_at_risk"])
    total_points = sum(x["leaked_points"] for x in leaks)
    total_jod = sum(x["jod_at_risk"] for x in leaks)
    settled = max(0, checked - pending)

    kv("refunds of point-earning orders checked", checked)
    kv("of those, clawback horizon still open (PENDING)",
       "%d — the +%dh window has not closed yet, so they are not scored"
       % (pending, ctx.args.d5_clawback_hours))
    kv("settled refunds scored", settled)
    kv("of those, correctly clawed back", "%d (%.1f%%)" % (clawed_ok, 100.0 * clawed_ok / max(1, settled)))
    kv("of those, LEAKING", "%d (%.1f%%)" % (len(leaks), 100.0 * len(leaks) / max(1, settled)))

    sub("largest leaks (masked)")
    table([[ctx.subject_for_partner(x["partner_id"]) if x["partner_id"] else "(walk-in)",
            x["cashier"], "%.2f" % x["original_value"], "%.2f" % x["refund_value"],
            "%.0f" % x["points_issued"], "%.0f" % x["leaked_points"],
            ("%.1f" % x["hours_between"]) if x["hours_between"] is not None else "—",
            "%.2f" % x["jod_at_risk"]]
           for x in leaks[:ctx.args.top]],
          ["member (masked)", "refunding cashier", "orig JOD", "refund JOD", "pts", "leaked",
           "hrs", "JOD"], aligns="llrrrrrr")
    # The EXACT label has preconditions. It is earned only when the refund->original link is a
    # real linkage, the ledger carries a proper issued/used pair, and every linked original was
    # actually loaded. Otherwise this is an ESTIMATE and a LOWER BOUND, and says so.
    degradations = []
    if not link_basis.startswith("EXACT"):
        degradations.append("refund->original linkage is not exact")
    if not ctx.hist_signed:
        degradations.append("loyalty.history has no issued/used pair; movement signs are inferred")
    if unresolved:
        degradations.append("%d refund(s) have an unreadable original order" % unresolved)
    exactness = ("EXACT, this is realised leakage" if not degradations
                 else "ESTIMATE / LOWER BOUND — " + "; ".join(degradations))
    kv("LEAKED POINTS (total)", "%.0f" % total_points)
    kv("JOD AT RISK (D5)", "%.2f  = leaked points x %.4f JOD/point — %s"
       % (total_jod, ctx.point_value or 0.0, exactness))
    if settled:
        rate = len(leaks) / float(settled)
        annual = total_jod * (365.0 / max(1, ctx.args.days_measured))
        derive("Clawback failure rate is %.1f%% of SETTLED refunded earning orders (%d of %d; "
               "%d more are still inside their clawback horizon and are excluded). Extrapolated "
               "at the SAME rate and the same trade mix, the annual leak is %.0f JOD/yr. That is "
               "an extrapolation of a measured window, not a measurement of a year — the window "
               "was %d days." % (100 * rate, len(leaks), settled, pending, annual,
                                 ctx.args.days_measured))
        if rate > 0.5:
            warn("More than half of settled refunds leave the points behind. That is not fraud yet "
                 "— it is a MISSING CONTROL. Odoo will not reverse loyalty points on a POS refund "
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
            "checked": checked, "settled": settled, "pending": pending,
            "unresolved_originals": unresolved, "leaking": len(leaks),
            "link_basis": link_basis, "exactness": exactness}


def _load_missing_originals(ctx: Ctx, oids: set) -> tuple:
    """Load the original orders (and their ledger rows) that a refund points at but the window
    does not contain. Returns (loaded, still_unresolved)."""
    missing = sorted(o_ for o_ in oids if o_ and o_ not in ctx.orders_by_id)
    if not missing:
        return 0, 0
    want = ["date_order", "partner_id", "amount_total", "amount_tax"]
    if ctx.branch_field:
        want.append(ctx.branch_field)
    want.extend(ctx.cashier_candidates)
    present, _ = ctx.o.pick("pos.order", want)
    try:
        rows = ctx.o.read_ids("pos.order", missing, present + ["id"])
    except Exception as exc:
        warn("could not read %d out-of-window original order(s): %s"
             % (len(missing), str(exc)[:110]))
        return 0, len(missing)
    cf = ctx.cashier_field
    for r in rows:
        r["_dt"] = parse_dt(r.get("date_order"))
        r["_pid"] = m2o_id(r.get("partner_id"))
        r["_cashier"] = m2o_id(r.get(cf)) if cf else None
        r["_cashier_name"] = m2o_name(r.get(cf)) if cf else None
        r["_branch"] = m2o_id(r.get(ctx.branch_field)) if ctx.branch_field else None
        r["_branch_name"] = m2o_name(r.get(ctx.branch_field)) if ctx.branch_field else None
        r["_amt"] = float(r.get("amount_total") or 0.0)
        r["_in_window"] = False        # loaded for D5 only; no window count may include it
        ctx.orders_by_id[r["id"]] = r
    _load_history_for_orders(ctx, [r["id"] for r in rows])
    load_partners(ctx, {r["_pid"] for r in rows if r["_pid"]})
    return len(rows), len(missing) - len(rows)


def _load_history_for_orders(ctx: Ctx, oids: list) -> None:
    """loyalty.history for named orders, whatever shape this build links them with. Without it
    an out-of-window original has no issuance and D5 skips the refund all over again."""
    if not oids or not ctx.caps.get("has_history"):
        return
    hf = ctx.o.fields("loyalty.history")
    if "pos_order_id" in hf:
        dom = [("pos_order_id", "in", oids)]
    elif "order_id" in hf and "order_model" in hf:
        dom = [("order_model", "=", "pos.order"), ("order_id", "in", oids)]
    else:
        return                      # nothing to domain on; the caller's leak stays a lower bound
    present, _ = ctx.o.pick("loyalty.history",
                            ["card_id", "issued", "used", "points", "description", "create_date",
                             "create_uid", "order_id", "order_model", "pos_order_id"])
    try:
        rows, _ = ctx.o.read_all("loyalty.history", dom, present + ["id"], label="loyalty.history/D5")
    except Exception as exc:
        warn("could not read ledger rows for out-of-window originals: %s" % str(exc)[:110])
        return
    for h in rows:
        if h["id"] in ctx.hist_ids:          # already loaded by the window read or its tail
            continue
        ctx.hist_ids.add(h["id"])
        _prepare_history_row(h, present, in_window=False)
        ctx.hist_by_card[h["_card"]].append(h)
        if h["_order"]:
            ctx.hist_by_order[h["_order"]].append(h)


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

    bullet("D6 carries NO LOSS ESTIMATE. It is an identity and data-quality screen: the test is "
           "'this identity behaves like more than one person', not 'these points were stolen'. "
           "The JOD column below is the member's TOTAL window earnings — legitimate earnings "
           "included — so booking it as risk would inflate the de-duplicated headline by whatever "
           "the widest-travelling members happen to spend. It is context; it contributes 0.00 to "
           "the risk register.")
    tally = BasisTally()
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
            pts = sum(tally.add(ctx, r) for r in rows)
            rows_out.append({"partner_id": pid, "branches": len(brs), "branches_max_day": max_day,
                             "orders": len(rows), "paymethods": None,
                             "jod_earned_context": ctx.points_to_jod(pts),
                             "jod_at_risk": 0.0})
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

    rows_out.sort(key=lambda x: (-(x["paymethods"] or 0), -x["branches"], -x["jod_earned_context"]))
    total_earned = sum(x["jod_earned_context"] for x in rows_out)

    sub("members spread across branches / payment methods (masked)")
    table([[ctx.subject_for_partner(x["partner_id"]), x["orders"], x["branches"],
            x["branches_max_day"], x["paymethods"] if x["paymethods"] is not None else "—",
            "%.2f" % x["jod_earned_context"]]
           for x in rows_out[:ctx.args.top]],
          ["member (masked)", "orders", "branches", "max/day", "pay methods",
           "JOD earned (context)"], aligns="lrrrrr")
    kv("earning basis of the JOD column", tally.label())

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
    kv("JOD EARNED by spread-flagged members (context only)", "%.2f" % total_earned)
    kv("JOD sitting on duplicate-phone balances (context only)",
       "%.2f" % ctx.points_to_jod(dupe_points))
    kv("JOD AT RISK (D6)", "0.00 — by design; see the note above")
    bullet("Duplicate phones are usually data hygiene, not fraud — but they are exactly what "
           "breaks phone-as-identity: the till cannot tell which record it just credited. Every "
           "duplicate is a place where points can be moved between records without a trace.")
    for x in rows_out:
        # 0.00, deliberately: D6 still puts the member on the combined ranking (a second
        # independent detector on one person is the whole point of that list) but it must not
        # price them, or the de-duplicated total stops being defensible.
        ctx.add_risk(x["partner_id"], "D6", 0.0,
                     "%d branches (%d in one day), %s payment methods"
                     % (x["branches"], x["branches_max_day"], x["paymethods"]))
    ctx.detector_jod["D6 shared identity"] = 0.0
    return {"status": "OK", "offenders": rows_out, "duplicate_phones": len(dupes),
            "jod_at_risk": 0.0, "jod_earned_context": total_earned,
            "jod_duplicate_phone_balances": ctx.points_to_jod(dupe_points),
            "points_basis": tally.label(),
            "note": "identity / data-quality screen — carries no loss estimate"}


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
                               # masked HERE, not at print time: this dict is what --json writes,
                               # and it was carrying the staff member's real name into a file
                               # stamped "masked". Masker.name returns the real name under
                               # --reveal, so the investigator copy is unaffected.
                               "created_by": ctx.mask.name(m2o_name(h.get("create_uid")))})
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
    bullet("D6 contributes 0.00 to both totals on purpose. It flags identities that behave like "
           "more than one person; it does not price them, because its natural quantity is the "
           "member's whole legitimate spend. It still counts toward 'number of detectors' above.")
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
    bullet("Run the --days 90 job on a machine, not a laptop: at ~3,238 invoices/day that window "
           "is ~291k pos.order rows and roughly %.0f MB resident for orders alone. The scan "
           "prints its estimated footprint from a search_count before it reads anything, so "
           "check that line first."
           % (291_420 * BYTES_PER_ORDER / 1e6))
    bullet("Full scan at --days 90 with --json, retained. Two jobs: (1) RE-BASELINE every "
           "threshold below against the measured distribution the scan prints — after 30 days of "
           "live data the thresholds stop being policy guesses and become percentiles of observed "
           "behaviour; (2) trend the pseudonymous tokens, since a token appearing every month is "
           "a different problem from a token appearing once.")

    sub("D. THRESHOLDS IN FORCE (all overridable on the command line)")
    table([["--d1-concentration", a.d1_concentration, "single-cashier share of a member's earning orders"],
           ["--d1-min-orders", a.d1_min_orders, "minimum ATTRIBUTED earning orders before D1 tests a member"],
           ["--d1-min-cashier-coverage", a.d1_min_cashier_coverage,
            "attribution floor below which D1 refuses to conclude anything"],
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
    bullet("Distribution rule: the daily mail goes out MASKED (no --reveal), and so does the "
           "--json evidence file that accompanies it — without --reveal every partner, cashier, "
           "card, order and history id in that file is replaced by the same stable token the "
           "console prints, so it can be attached to the mail without carrying PII. Only the "
           "Operations Manager and Internal Audit run with --reveal, and only against a named "
           "case; a --reveal file is named as such in the line that writes it and must not be "
           "circulated.")

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
    p.add_argument("--d1-min-cashier-coverage", type=float, default=0.5,
                   help="minimum share of orders that must carry a cashier before D1 will "
                        "test anything at all; below it D1 reports UNAVAILABLE rather than "
                        "an all-clear it did not measure")
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


def parse_args() -> argparse.Namespace:
    """Parse and VALIDATE. --days is checked here so a wrapper that computes `--days $N` and
    lands on 0 is told about --days, not about the --from/--to flags it never passed."""
    args = build_argparser().parse_args()
    if not (args.date_from or args.date_to) and args.days < 1:
        die("ABORT: --days must be at least 1 (--days 1 = yesterday, the complete previous "
            "local day). Got %d." % args.days, 1)
    if args.d5_clawback_hours < 0:
        die("ABORT: --d5-clawback-hours cannot be negative.", 1)
    if not (0.0 <= args.d1_min_cashier_coverage <= 1.0):
        die("ABORT: --d1-min-cashier-coverage is a share, so it must be between 0 and 1.", 1)
    return args


def main() -> None:
    args = parse_args()
    env = load_env()
    u_start, u_end, u_hist_end, l_start, l_end, days = resolve_window(args)
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
    kv("loyalty.history read up to (UTC)", "%s  (+%d h tail, used ONLY to match D5 clawbacks "
       "that land after the window closes)" % (u_hist_end, args.d5_clawback_hours))
    kv("mode", "READ-ONLY — non-read RPC methods are blocked in code (SAFE_METHODS)")
    kv("identifiers", "REVEALED (contains PII — handle accordingly)" if args.reveal
       else "MASKED (stable pseudonymous tokens; --reveal for the investigator copy)")

    o = Odoo(env)
    kv("authenticated uid", o.uid)
    salt = os.environ.get("ALMOND_SCAN_SALT") or env["ODOO_DB"]
    ctx = Ctx(o, args, Masker(salt, args.reveal))

    detect_capabilities(ctx)
    derive_point_value(ctx)
    load_data(ctx, u_start, u_end, u_hist_end)
    earn = earning_orders(ctx)

    def want(tag):
        return not only or tag in only

    # The header promises that a missing field or model degrades ONE detector and the rest of
    # the report still prints. Nothing enforced it: a bare AccessError inside D3 (hr.employee
    # read is gated on hr.group_hr_user, and this scan is meant to run on a read-scoped key)
    # propagated to the top-level handler and destroyed D4..D7, the combined ranking and the
    # daily report spec after D1 and D2 had already printed. Now every detector is guarded.
    detectors = (("d1", lambda: d1_self_crediting(ctx, earn)),
                 ("d2", lambda: d2_impossible_patterns(ctx, earn)),
                 ("d3", lambda: d3_staff_accounts(ctx)),
                 ("d4", lambda: d4_velocity(ctx)),
                 ("d5", lambda: d5_refund_abuse(ctx)),
                 ("d6", lambda: d6_shared_identity(ctx)),
                 ("d7", lambda: d7_point_spikes(ctx)))
    for tag, fn in detectors:
        if not want(tag):
            continue
        try:
            EV[tag] = fn()
        except SystemExit:
            raise
        except Exception as exc:
            gap("%s ABORTED: %s: %s — this detector is UNAVAILABLE for this run; every other "
                "detector below is unaffected."
                % (tag.upper(), type(exc).__name__, str(exc)[:150]))
            EV[tag] = {"status": "UNAVAILABLE",
                       "reason": "%s: %s" % (type(exc).__name__, str(exc)[:200])}

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
        payload = EV if args.reveal else scrub_evidence(EV, ctx)
        payload["_meta"] = {"version": SCRIPT_VERSION, "db": env["ODOO_DB"],
                            "window_utc": [u_start, u_end], "history_read_to_utc": u_hist_end,
                            "days": days,
                            "masked": not args.reveal, "point_value": ctx.point_value,
                            "thresholds": {k: v for k, v in vars(args).items()
                                           if k.startswith(("d1_", "d2_", "d4_", "d5_", "d6_", "d7_"))
                                           or k == "alpha"}}
        try:
            with open(args.json_out, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, ensure_ascii=False, indent=2, default=str)
            print("\n   Evidence written to %s — %s"
                  % (args.json_out,
                     "CONTAINS PII (--reveal was on): named investigator only, do not circulate."
                     if args.reveal else
                     "MASKED (every record id replaced by its stable token) — safe to circulate."))
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
