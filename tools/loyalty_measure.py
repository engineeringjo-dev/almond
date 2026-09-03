#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Almond Coffee House — Phase-0 loyalty MEASUREMENT GATE  (READ-ONLY)
==================================================================

WHY THIS EXISTS
---------------
The loyalty redesign rests on numbers nobody has read off production. The
proposal's own gate says "nothing is built before this". This script produces
every gate number from the live Odoo 19 database and refuses to invent any of
them. Where a number cannot be measured it is printed as UNAVAILABLE with the
reason, never as a plausible-looking default.

WHAT IT MEASURES (each with a stated method + a stated confidence caveat)
  1. MEMBER COVERAGE   — share of pos.order (count AND value) carrying a
                         partner who holds a loyalty.card, PER BRANCH.
                         Every coverage assumption in the design hangs on this.
  2. SPEND DISTRIBUTION— per-member spend over the window, percentiles
                         50/70/90/95/97, and the exact JOD tier thresholds that
                         WOULD produce a target tier shape (base 60-75%,
                         middle 20-30%, top 3-8%). Also scores the thresholds
                         the proposal and the repo already propose.
  3. REDEMPTION RATE   — points used / points issued in the window, plus the
                         outstanding point balance converted to JOD.
  4. LIABILITY         — outstanding points x point value, as a share of one
                         measured month of sales.
  5. SUBSTITUTION k    — the design's most sensitive input. Within-person
                         pre/post estimator over the trailing 8 visits, with a
                         bootstrap CI, a bias direction, and a resolvability
                         diagnostic. Printed as a RANGE, never a point value.
  6. TIME TO 1st REWARD— visits between first earn and first redemption,
                        with the right-censoring share stated.
  7. REDEMPTION MIX    — reward lines by product category
                        (drinks / pastry / sweets / sandwich / other) and the
                        measured COGS per reward that feeds cost-per-reward-JOD.

HARD RULES OBEYED HERE
  - READ-ONLY. The RPC wrapper hard-blocks every method that is not on a
    read whitelist; there is no code path that writes, and no production-write
    approval token is accepted or needed.
  - stdlib only (xmlrpc.client). No pip install. Runs anywhere with network
    access to the Odoo host -- it will NOT run from the dev container, whose
    egress proxy blocks *.odoo.com.
  - Credentials from the environment (or --env-file), never hardcoded.
  - Degrades with a useful message, not a traceback. A missing model, a missing
    field or a renamed RPC method downgrades ONE section to UNAVAILABLE and the
    rest of the report still prints.

EXACTNESS LABELS used throughout
  EXACT      - a direct count/sum from the database over the stated domain.
  DERIVED    - arithmetic on EXACT values plus a configuration value that was
               itself read from the database.
  ESTIMATE   - a statistical estimator with sampling error; a CI is printed.
  ASSUMPTION - depends on an input that could NOT be read from the database
               (it is named, and its effect is stated).

USAGE
  export ODOO_URL=https://ag-almond-coffee-house.odoo.com
  export ODOO_DB=ag-almond-coffee-house-master1-29151411
  export ODOO_LOGIN=you@almond.jo
  export ODOO_API_KEY=xxxxxxxx
  python3 tools/loyalty_measure.py                      # last 90 days, human report
  python3 tools/loyalty_measure.py --days 180
  python3 tools/loyalty_measure.py --from 2026-06-01 --to 2026-09-01
  python3 tools/loyalty_measure.py --json > phase0.json # paste into the design doc
  python3 tools/loyalty_measure.py --only coverage,k    # one section while iterating

EXIT CODES
  0 report produced (possibly with UNAVAILABLE sections)
  2 could not connect / authenticate / no usable POS data  (nothing printed as fact)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import random
import re
import sys
import time
import xmlrpc.client
from collections import defaultdict

SCRIPT_VERSION = "1.0.0"

# POS order states that represent real, settled sales. 'draft' and 'cancel' are
# excluded; refunds are negative-value orders in these same states and ARE
# included so every value figure is net (their count is reported separately).
SALE_STATES = ["paid", "done", "invoiced"]

# Jordan has been on permanent UTC+3 since 2022 (no DST). Odoo stores
# date_order in UTC, so a local calendar window must be shifted before it is
# sent as a domain. Override with --tz-offset if the database says otherwise.
DEFAULT_TZ_OFFSET_HOURS = 3.0

# Category bucketing for the redemption mix. Matched case-insensitively against
# product.category.complete_name, first hit wins. Override wholesale with
# --category-map path/to/map.json  ({"drinks": ["..."], ...}).
DEFAULT_CATEGORY_MAP = {
    "drinks": ["drink", "beverage", "coffee", "tea", "juice", "cold", "hot",
               "مشروب", "قهوة", "شاي", "عصير", "بارد", "ساخن"],
    "pastry": ["pastry", "bakery", "croissant", "bake", "معجنات", "مخبوزات", "كرواسون"],
    "sweets": ["sweet", "dessert", "cake", "حلو", "حلويات", "كيك", "تحلية"],
    "sandwich": ["sandwich", "savou", "savor", "wrap", "toast", "ساندويش", "سندويش"],
}

READ_ONLY_METHODS = {
    "search", "search_read", "search_count", "read", "read_group",
    "formatted_read_group", "fields_get", "default_get", "name_search",
    "check_access_rights", "search_fetch", "web_search_read",
}


# --------------------------------------------------------------------------
# small utilities
# --------------------------------------------------------------------------

def warn(msg: str) -> None:
    print("  ! %s" % msg, file=sys.stderr)


def die(msg: str, code: int = 2) -> None:
    print("FATAL: %s" % msg, file=sys.stderr)
    raise SystemExit(code)


def money(x) -> str:
    """Format a JOD amount with thousands separators and 3 decimals (fils)."""
    try:
        return "{:,.3f}".format(float(x))
    except Exception:
        return "n/a"


def pct(x, digits=1) -> str:
    try:
        return ("{:." + str(digits) + "f}%").format(100.0 * float(x))
    except Exception:
        return "n/a"


def chunks(seq, size):
    seq = list(seq)
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def pctl(sorted_vals, p):
    """Linear-interpolation percentile (the 'type 7' definition, same as numpy's
    default and Excel's PERCENTILE.INC), so quoted thresholds are reproducible.
    `sorted_vals` MUST already be sorted ascending. p is 0..100."""
    n = len(sorted_vals)
    if n == 0:
        return None
    if n == 1:
        return float(sorted_vals[0])
    rank = (p / 100.0) * (n - 1)
    lo = int(math.floor(rank))
    hi = int(math.ceil(rank))
    if lo == hi:
        return float(sorted_vals[lo])
    frac = rank - lo
    return float(sorted_vals[lo]) * (1.0 - frac) + float(sorted_vals[hi]) * frac


def mean(vals):
    vals = list(vals)
    return sum(vals) / float(len(vals)) if vals else None


def stdev(vals):
    vals = list(vals)
    if len(vals) < 2:
        return None
    m = sum(vals) / float(len(vals))
    return math.sqrt(sum((v - m) ** 2 for v in vals) / float(len(vals) - 1))


def ratio_of_sums(pairs):
    """Sum(numerator) / Sum(denominator) over a list of (num, den) pairs.
    This is the value-weighted estimator; it is what the money cares about,
    and it is far more stable than the mean of per-item ratios."""
    den = sum(d for _, d in pairs)
    if den == 0:
        return None
    return sum(n for n, _ in pairs) / den


def bootstrap_ci(pairs, n_boot, seed, lo_p=2.5, hi_p=97.5):
    """Percentile bootstrap CI for ratio_of_sums over a resampled-with-
    replacement set of (num, den) pairs. Captures sampling variability of the
    estimator ONLY -- it does NOT capture the estimator's bias, which is stated
    separately in the report. Deterministic for a given --seed."""
    if len(pairs) < 2:
        return (None, None)
    rng = random.Random(seed)
    n = len(pairs)
    stats = []
    for _ in range(n_boot):
        num = 0.0
        den = 0.0
        for _ in range(n):
            a, b = pairs[rng.randrange(n)]
            num += a
            den += b
        if den != 0:
            stats.append(num / den)
    if not stats:
        return (None, None)
    stats.sort()
    return (pctl(stats, lo_p), pctl(stats, hi_p))


# --------------------------------------------------------------------------
# credentials + read-only RPC client
# --------------------------------------------------------------------------

ENV_KEYS = ("ODOO_URL", "ODOO_DB", "ODOO_LOGIN", "ODOO_API_KEY")


def load_env(env_file):
    """Environment first; an optional shell-style env file fills the gaps.
    Nothing is ever written back, and the API key is never printed."""
    env = {k: os.environ.get(k, "") for k in ENV_KEYS}
    if env_file:
        if not os.path.exists(env_file):
            die("--env-file %s does not exist" % env_file)
        try:
            with open(env_file, "r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    line = line.replace("export ", "", 1)
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k in ENV_KEYS and not env.get(k):
                        env[k] = v
        except OSError as exc:
            die("cannot read --env-file %s: %s" % (env_file, exc))
    missing = [k for k in ENV_KEYS if not env.get(k)]
    if missing:
        die("missing credentials: %s\n"
            "       set them in the environment or pass --env-file.\n"
            "       (This script is read-only; a read-scoped API key is enough.)"
            % ", ".join(missing))
    return env


class ReadOnlyViolation(RuntimeError):
    pass


class Odoo:
    """Minimal Odoo external-API client, stdlib only.

    Every call goes through _call(), which refuses any method outside
    READ_ONLY_METHODS. That guard is the enforcement point for the
    'production is read-only' rule -- there is deliberately no escape hatch."""

    def __init__(self, url, db, login, api_key, timeout_retries=4, verbose=False):
        self.url = url.rstrip("/")
        self.db = db
        self.key = api_key
        self.retries = timeout_retries
        self.verbose = verbose
        self.calls = 0
        try:
            common = xmlrpc.client.ServerProxy(self.url + "/xmlrpc/2/common", allow_none=True)
            self.uid = common.authenticate(db, login, api_key, {})
        except Exception as exc:  # network, DNS, TLS, proxy
            die("cannot reach Odoo at %s (%s: %s)\n"
                "       If you are running inside the dev container this is expected:\n"
                "       the egress proxy blocks *.odoo.com. Run this script from a host\n"
                "       that can reach the Odoo instance."
                % (self.url, type(exc).__name__, exc))
        if not self.uid:
            die("authentication failed for db=%s (check ODOO_LOGIN / ODOO_API_KEY)" % db)
        self.models = xmlrpc.client.ServerProxy(self.url + "/xmlrpc/2/object", allow_none=True)

    def _call(self, model, method, args, kwargs=None):
        if method not in READ_ONLY_METHODS:
            raise ReadOnlyViolation(
                "blocked non-read method %r on %s -- this script is read-only" % (method, model))
        kwargs = kwargs or {}
        last = None
        for attempt in range(self.retries):
            try:
                self.calls += 1
                return self.models.execute_kw(self.db, self.uid, self.key,
                                              model, method, args, kwargs)
            except xmlrpc.client.Fault as exc:
                # A Fault is a server-side answer (missing model/field/method).
                # It is meaningful; do not retry it, let the caller downgrade.
                raise
            except (xmlrpc.client.ProtocolError, OSError) as exc:
                last = exc
                if attempt < self.retries - 1:
                    time.sleep(2.0 * (attempt + 1))
                    continue
                raise
        raise last  # pragma: no cover

    # -- thin typed helpers -------------------------------------------------

    def search_read(self, model, domain, fields, limit=None, order=None, offset=0):
        kw = {"fields": fields, "offset": offset}
        if limit:
            kw["limit"] = limit
        if order:
            kw["order"] = order
        return self._call(model, "search_read", [domain], kw) or []

    def search_read_all(self, model, domain, fields, batch=5000, cap=0, label=""):
        """Paged search_read. `cap` > 0 stops early and the caller MUST report
        that the result is truncated (a truncated sum is not an exact sum)."""
        out = []
        offset = 0
        while True:
            page = self.search_read(model, domain, fields, limit=batch,
                                    order="id", offset=offset)
            out.extend(page)
            if self.verbose and label:
                warn("%s: %d rows fetched" % (label, len(out)))
            if len(page) < batch:
                break
            offset += batch
            if cap and len(out) >= cap:
                return out, True
        return out, False

    def search_count(self, model, domain):
        return self._call(model, "search_count", [domain]) or 0

    def read(self, model, ids, fields):
        if not ids:
            return []
        return self._call(model, "read", [list(ids)], {"fields": fields}) or []

    def fields_of(self, model):
        """Field names of a model, or None if the model does not exist here.
        This is how every capability check is done -- nothing is assumed
        installed."""
        try:
            return set((self._call(model, "fields_get", [], {"attributes": ["type"]}) or {}).keys())
        except xmlrpc.client.Fault:
            return None
        except Exception as exc:
            warn("fields_get(%s) failed: %s" % (model, exc))
            return None

    # -- grouped aggregation, with a 3-way fallback -------------------------

    def group_sum(self, model, domain, groupby, sum_field):
        """Return [(group_key, count, sum_of_sum_field), ...].

        Odoo renamed/deprecated the public grouping RPC between 17 and 19, so
        three implementations are tried in order and the first that answers is
        used: formatted_read_group (18/19), read_group (<=18), then a Python
        fold over search_read (always correct, but pulls every row).
        `group_key` is the raw value: an (id, name) pair for many2one, else the
        scalar. A reviewer should check this fallback ordering first if any
        aggregate looks wrong."""
        agg = "%s:sum" % sum_field
        # 1) Odoo 18/19
        try:
            rows = self._call(model, "formatted_read_group",
                              [domain, [groupby], ["__count", agg]]) or []
            return [(r.get(groupby), int(r.get("__count") or 0),
                     float(r.get(agg) or 0.0)) for r in rows], "formatted_read_group"
        except xmlrpc.client.Fault:
            pass
        except Exception as exc:
            warn("formatted_read_group failed on %s: %s" % (model, exc))
        # 2) Odoo <= 18
        try:
            rows = self._call(model, "read_group",
                              [domain, [sum_field], [groupby]], {"lazy": False}) or []
            return [(r.get(groupby), int(r.get("__count") or 0),
                     float(r.get(sum_field) or 0.0)) for r in rows], "read_group"
        except xmlrpc.client.Fault:
            pass
        except Exception as exc:
            warn("read_group failed on %s: %s" % (model, exc))
        # 3) universal fallback
        warn("no grouping RPC available on %s; folding rows client-side "
             "(slower, same result)" % model)
        rows, _ = self.search_read_all(model, domain, [groupby, sum_field])
        acc = defaultdict(lambda: [0, 0.0])
        keys = {}
        for r in rows:
            v = r.get(groupby)
            k = v[0] if isinstance(v, (list, tuple)) and v else (v if v else False)
            keys[k] = v
            acc[k][0] += 1
            acc[k][1] += float(r.get(sum_field) or 0.0)
        return [(keys[k], c, s) for k, (c, s) in acc.items()], "client-side fold"


# --------------------------------------------------------------------------
# window, capabilities, configuration read off the database
# --------------------------------------------------------------------------

def resolve_window(args):
    """Return (utc_start_str, utc_end_str, local_start, local_end, days).

    The window is expressed by the user in LOCAL (Amman) calendar dates but
    Odoo stores date_order in UTC, so the boundaries are shifted by
    --tz-offset. End is EXCLUSIVE. Getting this wrong silently moves ~3 hours
    of trade (a whole evening peak) between windows, so the shift is printed
    in the report header."""
    off = dt.timedelta(hours=args.tz_offset)
    if args.date_from or args.date_to:
        if not (args.date_from and args.date_to):
            die("--from and --to must be given together (or use --days)")
        try:
            l_start = dt.datetime.strptime(args.date_from, "%Y-%m-%d")
            l_end = dt.datetime.strptime(args.date_to, "%Y-%m-%d")
        except ValueError:
            die("--from/--to must be YYYY-MM-DD")
        if l_end <= l_start:
            die("--to must be strictly after --from")
    else:
        now_local = dt.datetime.utcnow() + off
        l_end = dt.datetime(now_local.year, now_local.month, now_local.day)
        l_start = l_end - dt.timedelta(days=args.days)
    days = (l_end - l_start).total_seconds() / 86400.0
    u_start = (l_start - off).strftime("%Y-%m-%d %H:%M:%S")
    u_end = (l_end - off).strftime("%Y-%m-%d %H:%M:%S")
    return u_start, u_end, l_start.strftime("%Y-%m-%d"), l_end.strftime("%Y-%m-%d"), days


def order_domain(u_start, u_end, extra=None):
    dom = [("date_order", ">=", u_start), ("date_order", "<", u_end),
           ("state", "in", SALE_STATES)]
    if extra:
        dom = dom + list(extra)
    return dom


def detect_capabilities(odoo):
    """Ask the database what it actually has. Every downstream section reads
    these flags instead of assuming a module is installed. Nothing here writes
    or installs anything."""
    caps = {}
    po = odoo.fields_of("pos.order")
    if po is None:
        die("model pos.order is not readable -- is POS installed, and does this "
            "user have read access? Nothing can be measured without it.")
    caps["pos_order_fields"] = sorted(po)
    caps["has_branch_id"] = "branch_id" in po            # almond_branch module
    caps["has_config_id"] = "config_id" in po
    pol = odoo.fields_of("pos.order.line") or set()
    caps["has_reward_line_flag"] = "is_reward_line" in pol
    caps["has_reward_id"] = "reward_id" in pol
    caps["has_points_cost"] = "points_cost" in pol
    caps["pos_order_line_ok"] = bool(pol)
    lc = odoo.fields_of("loyalty.card")
    caps["has_loyalty"] = lc is not None
    caps["loyalty_card_fields"] = sorted(lc) if lc else []
    lh = odoo.fields_of("loyalty.history")
    caps["has_loyalty_history"] = lh is not None
    caps["loyalty_history_fields"] = sorted(lh) if lh else []
    caps["has_product_standard_price"] = "standard_price" in (odoo.fields_of("product.product") or set())
    return caps


def read_programs(odoo, caps):
    """Read loyalty.program / rule / reward so the report states WHICH program
    the numbers describe. Also the source of the measured point value below."""
    if not caps["has_loyalty"]:
        return {"status": "UNAVAILABLE", "reason": "loyalty module not installed / not readable"}
    out = {"status": "OK", "programs": [], "rewards": [], "rules": []}
    pfields = odoo.fields_of("loyalty.program") or set()
    want = [f for f in ("id", "name", "program_type", "applies_on", "trigger",
                        "active", "currency_id", "portal_visible", "date_to")
            if f in pfields or f == "id"]
    try:
        out["programs"] = odoo.search_read("loyalty.program", [], want)
    except Exception as exc:
        out["programs_error"] = str(exc)
    rfields = odoo.fields_of("loyalty.rule") or set()
    want_r = [f for f in ("id", "program_id", "reward_point_amount",
                          "reward_point_mode", "reward_point_split",
                          "minimum_amount", "minimum_qty", "mode")
              if f in rfields or f == "id"]
    try:
        out["rules"] = odoo.search_read("loyalty.rule", [], want_r)
    except Exception as exc:
        out["rules_error"] = str(exc)
    wfields = odoo.fields_of("loyalty.reward") or set()
    want_w = [f for f in ("id", "program_id", "description", "reward_type",
                          "required_points", "discount", "discount_mode",
                          "discount_applicability", "discount_max_amount",
                          "reward_product_id", "reward_product_qty",
                          "reward_product_ids")
              if f in wfields or f == "id"]
    try:
        out["rewards"] = odoo.search_read("loyalty.reward", [], want_w)
    except Exception as exc:
        out["rewards_error"] = str(exc)
    return out


def derive_point_value(odoo, programs, cli_value):
    """Determine JOD per point FROM THE DATABASE where possible.

    Odoo encodes it directly:
      discount_mode == 'per_point'  -> `discount` IS currency per point.
      discount_mode == 'per_order'  -> discount / required_points.
      reward_type  == 'product'     -> product list_price / required_points
                                       (an IMPLIED value, listed but not used
                                       for the headline because a free product
                                       is priced at retail, not at cost).
    The owner stated verbally "point = 1 qirsh = 0.01 JOD". That claim is
    VERIFIED or REFUTED here; it is never assumed."""
    res = {"cli_value": cli_value, "observations": [], "value": None,
           "basis": None, "exactness": None}
    rewards = (programs or {}).get("rewards") or []
    per_point = []
    prod_ids = []
    for w in rewards:
        rp = float(w.get("required_points") or 0.0)
        mode = w.get("discount_mode")
        disc = float(w.get("discount") or 0.0)
        rec = {"reward_id": w.get("id"), "description": w.get("description"),
               "reward_type": w.get("reward_type"), "discount_mode": mode,
               "discount": disc, "required_points": rp}
        if w.get("reward_type") == "discount" and mode == "per_point" and disc:
            rec["implied_jod_per_point"] = disc
            per_point.append(disc)
        elif w.get("reward_type") == "discount" and mode == "per_order" and rp:
            rec["implied_jod_per_point"] = disc / rp
            per_point.append(disc / rp)
        elif w.get("reward_type") == "discount" and mode == "percent":
            rec["implied_jod_per_point"] = None
            rec["note"] = "percent discount: point value depends on basket size, not derivable"
        elif w.get("reward_type") == "product" and rp:
            pid = w.get("reward_product_id")
            if isinstance(pid, (list, tuple)) and pid:
                prod_ids.append(pid[0])
                rec["reward_product_id"] = pid[0]
            rec["implied_jod_per_point"] = None
            rec["note"] = "free product: implied retail value filled in below"
        res["observations"].append(rec)
    # fill implied value for product rewards from list_price
    if prod_ids:
        try:
            prods = {p["id"]: p for p in odoo.read("product.product", sorted(set(prod_ids)),
                                                   ["list_price", "standard_price", "display_name"])}
            for rec in res["observations"]:
                pid = rec.get("reward_product_id")
                if pid and pid in prods:
                    rp = rec["required_points"]
                    rec["reward_product"] = prods[pid].get("display_name")
                    rec["reward_product_list_price"] = prods[pid].get("list_price")
                    rec["reward_product_standard_price"] = prods[pid].get("standard_price")
                    if rp:
                        rec["implied_retail_jod_per_point"] = float(prods[pid].get("list_price") or 0.0) / rp
        except Exception as exc:
            warn("could not read reward products: %s" % exc)
    if per_point:
        per_point.sort()
        res["value"] = pctl(per_point, 50)
        res["basis"] = ("median of %d cash-discount reward(s) configured in "
                        "loyalty.reward" % len(per_point))
        res["exactness"] = "EXACT (read from loyalty.reward configuration)"
        res["spread"] = {"min": per_point[0], "max": per_point[-1]}
        res["matches_owner_claim_1_qirsh"] = abs(res["value"] - 0.01) < 1e-9
    else:
        res["value"] = cli_value
        res["basis"] = ("--point-value CLI input; no cash-discount reward with a "
                        "derivable per-point value exists in loyalty.reward")
        res["exactness"] = "ASSUMPTION (not measurable from configuration)"
        res["matches_owner_claim_1_qirsh"] = None
    return res


def branch_labels(odoo, caps):
    """Map the grouping key to a human branch name.

    Preferred key is pos.order.branch_id (the almond_branch module stores it,
    and several POS shops can share one physical branch -- 'Mecca Street' and
    'Mecca Street 2' are ONE branch). If that module is absent the key falls
    back to config_id, which over-counts branches wherever a branch runs more
    than one till; the report says which key was used."""
    if caps["has_branch_id"]:
        return "branch_id", "almond.branch (pos.order.branch_id)", None
    if caps["has_config_id"]:
        return "config_id", ("pos.config (almond_branch module NOT installed -- "
                             "one row per POS SHOP, not per physical branch)"), None
    return None, None, "pos.order has neither branch_id nor config_id; cannot break down per branch"


def member_partner_ids(odoo, caps, program_ids=None):
    """Every res.partner that holds a loyalty.card = the member population.

    'Member' is defined here as CARD HOLDER, not as 'has ever earned'. That
    choice is stated in the report because it moves coverage: an auto-created
    card with zero activity still counts as a member."""
    if not caps["has_loyalty"]:
        return None, {"status": "UNAVAILABLE",
                      "reason": "loyalty.card not readable"}
    dom = []
    if program_ids:
        dom.append(("program_id", "in", list(program_ids)))
    have = set(caps["loyalty_card_fields"])
    fields = [f for f in ("partner_id", "program_id", "points") if f in have] or ["partner_id"]
    points_available = "points" in have
    rows, truncated = odoo.search_read_all("loyalty.card", dom, fields, batch=5000,
                                           label="loyalty.card")
    partners = set()
    total_points = 0.0
    cards_with_partner = 0
    per_program = defaultdict(lambda: {"cards": 0, "points": 0.0, "partners": set()})
    for r in rows:
        p = r.get("partner_id")
        pid = p[0] if isinstance(p, (list, tuple)) and p else None
        pts = float(r.get("points") or 0.0)
        total_points += pts
        prog = r.get("program_id")
        pkey = (prog[0], prog[1]) if isinstance(prog, (list, tuple)) and prog else (0, "(no program)")
        per_program[pkey]["cards"] += 1
        per_program[pkey]["points"] += pts
        if pid:
            partners.add(pid)
            cards_with_partner += 1
            per_program[pkey]["partners"].add(pid)
    meta = {
        "status": "OK",
        "points_field_available": points_available,
        "cards_total": len(rows),
        "cards_with_partner": cards_with_partner,
        "cards_anonymous": len(rows) - cards_with_partner,
        "distinct_member_partners": len(partners),
        # None, never 0.0, when the field does not exist -- a zero balance and an
        # unreadable balance are different facts and must not print the same.
        "outstanding_points_total": (total_points if points_available else None),
        "truncated": truncated,
        "per_program": [{"program_id": k[0], "program": k[1], "cards": v["cards"],
                         "points": v["points"], "partners": len(v["partners"])}
                        for k, v in sorted(per_program.items(), key=lambda kv: -kv[1]["cards"])],
    }
    return partners, meta


# --------------------------------------------------------------------------
# SECTION 1 -- MEMBER COVERAGE, per branch
# --------------------------------------------------------------------------

def section_coverage(odoo, caps, u_start, u_end, members, args):
    """QUESTION: of everything sold in the window, what share -- by ORDER COUNT
    and by VALUE -- carried a partner who holds a loyalty card, per branch?

    METHOD (exact, no sampling):
      total     = read_group(count, sum(amount_total)) over pos.order in window
      identified= same, restricted to partner_id != False
      member    = same, restricted to partner_id in <member set>, evaluated in
                  disjoint chunks of partner ids and summed. Chunks are
                  disjoint and an order has exactly one partner, so the chunk
                  sums add up to the exact total with no double counting.

    HOW TO READ IT: 'identified' minus 'member' is the walk-in-with-a-partner
    gap (invoiced companies, delivery partners) -- it is NOT loyalty reach.
    The member column is the only one the design may use."""
    key, key_desc, err = branch_labels(odoo, caps)
    out = {"exactness": "EXACT",
           "method": ("read_group over pos.order (state in %s) in the window; "
                      "member share computed with disjoint partner-id chunks"
                      % SALE_STATES),
           "grouping_key": key, "grouping_desc": key_desc}
    if err:
        out["status"] = "UNAVAILABLE"
        out["reason"] = err
        return out
    if members is None:
        out["status"] = "UNAVAILABLE"
        out["reason"] = "member set unavailable (loyalty.card not readable)"
        return out

    base = order_domain(u_start, u_end)
    tot_rows, rpc_used = odoo.group_sum("pos.order", base, key, "amount_total")
    out["grouping_rpc"] = rpc_used
    ident_rows, _ = odoo.group_sum("pos.order", base + [("partner_id", "!=", False)],
                                   key, "amount_total")

    mem_count = defaultdict(int)
    mem_value = defaultdict(float)
    n_chunks = 0
    for grp in chunks(sorted(members), args.partner_chunk):
        n_chunks += 1
        rows, _ = odoo.group_sum("pos.order", base + [("partner_id", "in", grp)],
                                 key, "amount_total")
        for gkey, cnt, val in rows:
            k = gkey[0] if isinstance(gkey, (list, tuple)) and gkey else (gkey or 0)
            mem_count[k] += cnt
            mem_value[k] += val
    out["partner_chunks_used"] = n_chunks

    def norm(rows):
        c, v, names = {}, {}, {}
        for gkey, cnt, val in rows:
            if isinstance(gkey, (list, tuple)) and gkey:
                k, nm = gkey[0], gkey[1]
            else:
                k, nm = (gkey or 0), ("(unassigned)" if not gkey else str(gkey))
            c[k] = c.get(k, 0) + cnt
            v[k] = v.get(k, 0.0) + val
            names[k] = nm
        return c, v, names

    tc, tv, names = norm(tot_rows)
    ic, iv, inames = norm(ident_rows)
    names.update({k: n for k, n in inames.items() if k not in names})

    branches = []
    for k in sorted(tc, key=lambda x: -tv.get(x, 0.0)):
        t_c, t_v = tc.get(k, 0), tv.get(k, 0.0)
        branches.append({
            "key": k, "branch": names.get(k, str(k)),
            "orders": t_c, "value_jod": t_v,
            "avg_invoice_jod": (t_v / t_c) if t_c else None,
            "identified_orders": ic.get(k, 0), "identified_value_jod": iv.get(k, 0.0),
            "member_orders": mem_count.get(k, 0), "member_value_jod": mem_value.get(k, 0.0),
            "coverage_by_count": (mem_count.get(k, 0) / t_c) if t_c else None,
            "coverage_by_value": (mem_value.get(k, 0.0) / t_v) if t_v else None,
            "identified_but_not_member_orders": ic.get(k, 0) - mem_count.get(k, 0),
        })
    T_c = sum(b["orders"] for b in branches)
    T_v = sum(b["value_jod"] for b in branches)
    M_c = sum(b["member_orders"] for b in branches)
    M_v = sum(b["member_value_jod"] for b in branches)
    I_c = sum(b["identified_orders"] for b in branches)
    I_v = sum(b["identified_value_jod"] for b in branches)
    out.update({
        "status": "OK",
        "branches": branches,
        "network": {
            "orders": T_c, "value_jod": T_v,
            "avg_invoice_jod": (T_v / T_c) if T_c else None,
            "identified_orders": I_c, "identified_value_jod": I_v,
            "member_orders": M_c, "member_value_jod": M_v,
            "coverage_by_count": (M_c / T_c) if T_c else None,
            "coverage_by_value": (M_v / T_v) if T_v else None,
            "identified_coverage_by_count": (I_c / T_c) if T_c else None,
        },
        "branch_spread": {
            "min_coverage_by_count": min((b["coverage_by_count"] for b in branches
                                          if b["coverage_by_count"] is not None), default=None),
            "max_coverage_by_count": max((b["coverage_by_count"] for b in branches
                                          if b["coverage_by_count"] is not None), default=None),
        },
        "caveats": [
            "MEMBER = holds a loyalty.card. A card auto-created at the till with no "
            "activity still counts, so this is an UPPER bound on engaged members.",
            "Coverage BY VALUE is the number the economics need; coverage BY COUNT is "
            "the number cashier behaviour drives. They differ whenever members buy "
            "bigger baskets -- if they do, quoting the count figure understates "
            "programme cost.",
            "Talabat / Careem volume (~23% of payment value per the brief) will appear "
            "here as either a single aggregator partner or as unidentified; check the "
            "identified-but-not-member column before treating it as walk-in.",
            "Refunds are negative-value orders included in the value sums, so value is "
            "NET. Count is gross (a refund counts as an order).",
            "If %s was used as the grouping key, rows are POS SHOPS not physical "
            "branches." % (key_desc or "?"),
        ],
    })
    return out


# --------------------------------------------------------------------------
# SECTION 2 -- MEMBER SPEND DISTRIBUTION + TIER THRESHOLD CALIBRATION
# --------------------------------------------------------------------------

# The design's stated target tier shape.
TARGET_SHAPE = {"base": (0.60, 0.75), "middle": (0.20, 0.30), "top": (0.03, 0.08)}

# Threshold sets already proposed elsewhere, scored against measured data so the
# contested points are settled with numbers instead of opinion.
PROPOSED_THRESHOLDS = [
    {"label": "PROPOSAL.ar.md (90-day rolling)", "middle": 90.0, "top": 225.0,
     "note": "brief S2: Silver >=90 JOD, Gold >=225 JOD per 90 days"},
    {"label": "repo config (12-month rolling)", "middle": 100.0, "top": 300.0,
     "note": "packages/shared/src/loyalty/constants.ts Bean/Silver/Gold/Black "
             "0/100/300/750 -- NOTE these are 12-month thresholds being scored "
             "against a shorter window here, so they will look harder than they are"},
]


def section_spend(odoo, caps, u_start, u_end, members, args):
    """QUESTION: how is spend distributed across members in the window, and
    which JOD thresholds would produce the target tier shape?

    METHOD (exact for the distribution): read_group over pos.order grouped by
    partner_id, restricted to member partners in disjoint chunks. One row per
    member with >=1 order. Percentiles are the type-7 (linear interpolation)
    definition so they are reproducible outside this script.

    TWO BASES ARE REPORTED and they are not interchangeable:
      ACTIVE  = members with >=1 order in the window.
      ALL     = every card holder, inactives entered at 0 JOD.
    Tier thresholds calibrated on ACTIVE describe the shape of the tier table a
    customer sees; calibrated on ALL they describe the share of the whole base.
    Quoting one and meaning the other is the most likely way to mis-set Gold."""
    out = {"exactness": "EXACT (distribution) / DERIVED (thresholds)",
           "method": ("per-member sum of pos.order.amount_total over the window "
                      "via grouped aggregation on partner_id; type-7 percentiles")}
    if members is None:
        out["status"] = "UNAVAILABLE"
        out["reason"] = "member set unavailable"
        return out
    base = order_domain(u_start, u_end)
    spend = {}
    visits = {}
    for grp in chunks(sorted(members), args.partner_chunk):
        rows, _ = odoo.group_sum("pos.order", base + [("partner_id", "in", grp)],
                                 "partner_id", "amount_total")
        for gkey, cnt, val in rows:
            if not (isinstance(gkey, (list, tuple)) and gkey):
                continue
            pid = gkey[0]
            spend[pid] = spend.get(pid, 0.0) + val
            visits[pid] = visits.get(pid, 0) + cnt
    active = sorted(v for v in spend.values())
    n_active = len(active)
    n_all = len(members)
    all_basis = sorted(list(spend.values()) + [0.0] * (n_all - n_active)) if n_all >= n_active else active

    def describe(vals, label):
        if not vals:
            return {"basis": label, "n": 0}
        d = {"basis": label, "n": len(vals),
             "total_jod": sum(vals), "mean_jod": mean(vals),
             "min_jod": vals[0], "max_jod": vals[-1]}
        for p in (25, 50, 70, 75, 80, 90, 92, 95, 97, 99):
            d["p%d_jod" % p] = pctl(vals, p)
        return d

    out["active_members"] = describe(active, "ACTIVE members (>=1 order in window)")
    out["all_cardholders"] = describe(all_basis, "ALL card holders (inactives at 0 JOD)")
    out["visits"] = {
        "n": len(visits),
        "mean_visits": mean(visits.values()) if visits else None,
        "p50_visits": pctl(sorted(visits.values()), 50) if visits else None,
        "p90_visits": pctl(sorted(visits.values()), 90) if visits else None,
    }
    out["inactive_cardholders"] = n_all - n_active
    out["inactive_share"] = ((n_all - n_active) / n_all) if n_all else None

    basis_vals = active if args.tier_basis == "active" else all_basis
    out["tier_basis_used"] = args.tier_basis
    out["tier_calibration"] = calibrate_tiers(basis_vals, args)
    out["proposed_thresholds_scored"] = score_thresholds(basis_vals, PROPOSED_THRESHOLDS)
    out["caveats"] = [
        "Spend here is pos.order.amount_total (tax-inclusive gross). If tiers are "
        "meant to run on net-of-tax spend every threshold shifts by the tax rate -- "
        "and the tax rate itself is unresolved in the brief (8% vs 16%).",
        "Only POS spend is counted. Talabat/Careem and any non-POS channel are "
        "absent, so a customer's true spend may exceed what is measured here.",
        "The window length drives the thresholds directly. A threshold calibrated on "
        "%0.0f days is meaningless quoted against a 12-month rolling rule." % args.days
        if not (args.date_from or args.date_to) else
        "The window length drives the thresholds directly; keep the rolling-window "
        "length in the design identical to the window measured here.",
        "Ties matter: menu prices cluster, so many members sit on identical spend "
        "totals. The REALISED shape at each rounded threshold is printed alongside "
        "the ideal one -- use the realised column.",
    ]
    out["status"] = "OK"
    return out


def calibrate_tiers(vals, args):
    """Print the exact JOD thresholds that WOULD produce the target shape.

    For a top-tier share t, the threshold is the (100-t)th percentile. For a
    base share b, the middle threshold is the b-th percentile. Every candidate
    is then VERIFIED by counting members at and above the threshold, both at
    the exact percentile value and at the operationally rounded value, because
    ties at round menu prices can move the realised shape by several points."""
    if not vals:
        return {"status": "UNAVAILABLE", "reason": "no member spend rows"}
    n = len(vals)
    rows = []
    for base_share in (0.60, 0.65, 0.70, 0.75):
        for top_share in (0.03, 0.05, 0.08):
            mid_share = 1.0 - base_share - top_share
            if mid_share < TARGET_SHAPE["middle"][0] - 1e-9 or mid_share > TARGET_SHAPE["middle"][1] + 1e-9:
                continue
            t_mid = pctl(vals, 100.0 * base_share)
            t_top = pctl(vals, 100.0 * (1.0 - top_share))
            r_mid = round_to(t_mid, args.round_to)
            r_top = round_to(t_top, args.round_to)
            rows.append({
                "target": {"base": base_share, "middle": mid_share, "top": top_share},
                "exact_threshold_middle_jod": t_mid,
                "exact_threshold_top_jod": t_top,
                "rounded_threshold_middle_jod": r_mid,
                "rounded_threshold_top_jod": r_top,
                "realised_at_exact": realised_shape(vals, t_mid, t_top),
                "realised_at_rounded": realised_shape(vals, r_mid, r_top),
            })
    return {"status": "OK", "n_members": n, "rounding_jod": args.round_to,
            "candidates": rows,
            "note": ("Thresholds are 'spend >= threshold in the window'. Read the "
                     "realised_at_rounded column: that is the shape the business "
                     "would actually get.")}


def round_to(x, step):
    if x is None or not step:
        return x
    return round(round(x / step) * step, 3)


def realised_shape(vals, t_mid, t_top):
    n = len(vals)
    if not n or t_mid is None or t_top is None:
        return None
    n_top = sum(1 for v in vals if v >= t_top)
    n_mid = sum(1 for v in vals if t_mid <= v < t_top)
    n_base = n - n_top - n_mid
    return {"base_share": n_base / n, "middle_share": n_mid / n, "top_share": n_top / n,
            "base_n": n_base, "middle_n": n_mid, "top_n": n_top,
            "in_target": (TARGET_SHAPE["base"][0] <= n_base / n <= TARGET_SHAPE["base"][1]
                          and TARGET_SHAPE["middle"][0] <= n_mid / n <= TARGET_SHAPE["middle"][1]
                          and TARGET_SHAPE["top"][0] <= n_top / n <= TARGET_SHAPE["top"][1])}


def score_thresholds(vals, proposals):
    """What shape do the ALREADY-PROPOSED thresholds actually produce here?
    This is the direct test of the brief's contested point: 'Gold threshold is
    far too easy for a coffee culture'."""
    out = []
    for p in proposals:
        sh = realised_shape(vals, p["middle"], p["top"])
        out.append({"label": p["label"], "middle_jod": p["middle"], "top_jod": p["top"],
                    "note": p.get("note"), "realised": sh})
    return out


# --------------------------------------------------------------------------
# SECTION 3/4 -- REDEMPTION RATE, OUTSTANDING BALANCE, LIABILITY
# --------------------------------------------------------------------------

def total_sum(odoo, model, domain, fields):
    """Ungrouped count + sums, with the same 3-way RPC fallback as group_sum.
    Returns (count, {field: sum}, rpc_name)."""
    aggs = ["__count"] + ["%s:sum" % f for f in fields]
    try:
        rows = odoo._call(model, "formatted_read_group", [domain, [], aggs]) or []
        if rows:
            r = rows[0]
            return (int(r.get("__count") or 0),
                    {f: float(r.get("%s:sum" % f) or 0.0) for f in fields},
                    "formatted_read_group")
        return 0, {f: 0.0 for f in fields}, "formatted_read_group"
    except xmlrpc.client.Fault:
        pass
    except Exception as exc:
        warn("formatted_read_group(%s) failed: %s" % (model, exc))
    try:
        rows = odoo._call(model, "read_group", [domain, list(fields), []], {"lazy": False}) or []
        if rows:
            r = rows[0]
            return (int(r.get("__count") or 0),
                    {f: float(r.get(f) or 0.0) for f in fields}, "read_group")
        return 0, {f: 0.0 for f in fields}, "read_group"
    except xmlrpc.client.Fault:
        pass
    except Exception as exc:
        warn("read_group(%s) failed: %s" % (model, exc))
    rows, _ = odoo.search_read_all(model, domain, list(fields))
    return (len(rows), {f: sum(float(r.get(f) or 0.0) for r in rows) for f in fields},
            "client-side fold")


def section_redemption(odoo, caps, u_start, u_end, card_meta, point_value, args):
    """QUESTION: what fraction of issued points is actually being redeemed, and
    how many points are sitting outstanding?

    METHOD: loyalty.history carries one row per point movement with `issued`
    and `used` (both positive floats). Redemption rate = sum(used)/sum(issued)
    over rows CREATED in the window.

    HOW TO READ IT: this is a FLOW ratio over a window, not a cohort ratio.
    Points redeemed in the window were largely issued BEFORE it, so in a
    growing programme this ratio understates the eventual redemption rate of a
    cohort, and in a shrinking one it overstates it. The cohort number needs a
    per-card earn-to-burn trace, which is out of scope for a Phase-0 gate --
    use this as a bound and say so."""
    out = {"exactness": "EXACT (sums) / ESTIMATE (as a cohort rate)",
           "method": "sum(loyalty.history.used) / sum(loyalty.history.issued) "
                     "over rows with create_date inside the window"}
    if not caps["has_loyalty_history"]:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("loyalty.history is not readable on this database. "
                         "Without it no redemption rate can be measured; the POS "
                         "reward-line count in the redemption-mix section is the "
                         "only remaining redemption signal.")
        return out
    lf = set(caps["loyalty_history_fields"])
    if not {"issued", "used"} <= lf:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("loyalty.history exists but lacks issued/used fields "
                         "(found: %s)" % ", ".join(sorted(lf)[:20]))
        return out
    date_field = "create_date" if "create_date" in lf else None
    if not date_field:
        out["status"] = "UNAVAILABLE"
        out["reason"] = "loyalty.history has no create_date to window on"
        return out
    dom = [(date_field, ">=", u_start), (date_field, "<", u_end)]
    n, sums, rpc = total_sum(odoo, "loyalty.history", dom, ["issued", "used"])
    issued = sums.get("issued", 0.0)
    used = sums.get("used", 0.0)
    n_all, sums_all, _ = total_sum(odoo, "loyalty.history", [], ["issued", "used"])
    outstanding_pts = (card_meta or {}).get("outstanding_points_total")
    out.update({
        "status": "OK",
        "rpc_used": rpc,
        "window": {"history_rows": n, "points_issued": issued, "points_used": used,
                   "redemption_rate": (used / issued) if issued else None,
                   "points_issued_jod": issued * point_value if point_value else None,
                   "points_used_jod": used * point_value if point_value else None},
        "lifetime": {"history_rows": n_all,
                     "points_issued": sums_all.get("issued", 0.0),
                     "points_used": sums_all.get("used", 0.0),
                     "redemption_rate": ((sums_all.get("used", 0.0) / sums_all.get("issued", 0.0))
                                         if sums_all.get("issued") else None)},
        "outstanding": {"points": outstanding_pts,
                        "jod": (outstanding_pts * point_value)
                               if (outstanding_pts is not None and point_value) else None,
                        "source": "sum of loyalty.card.points across all cards"},
        "caveats": [
            "Flow ratio, not a cohort ratio (see method). Compare the window rate "
            "against the lifetime rate printed beside it: a large gap means the "
            "programme is still filling up and the window rate is the low bound.",
            "Expired points may be recorded as neither issued nor used depending on "
            "how expiry is implemented; if lifetime issued - used differs materially "
            "from the outstanding card balance, expiry/adjustment rows are missing "
            "from this ratio. That reconciliation is printed below.",
            "Points -> JOD uses the point value stated in the header. If that value "
            "is an ASSUMPTION rather than read from loyalty.reward, every JOD figure "
            "in this section scales linearly with it.",
        ],
    })
    # Reconciliation: does (lifetime issued - lifetime used) match card balances?
    if outstanding_pts is not None and sums_all.get("issued") is not None:
        implied = sums_all.get("issued", 0.0) - sums_all.get("used", 0.0)
        out["reconciliation"] = {
            "lifetime_issued_minus_used": implied,
            "sum_of_card_points": outstanding_pts,
            "difference": implied - outstanding_pts,
            "difference_share": ((implied - outstanding_pts) / implied) if implied else None,
            "reading": ("A POSITIVE gap means points left the cards without a "
                        "'used' row -- expiry, manual adjustment or card deletion; "
                        "that is unmeasured leakage and the redemption rate above "
                        "understates the true burn. A NEGATIVE gap means cards hold "
                        "more points than the history explains -- points were "
                        "granted without an 'issued' row (import, migration or a "
                        "direct write), so the issued base is understated and the "
                        "redemption rate above is overstated. Either way the "
                        "ledger and the balances disagree by this much and the "
                        "reason must be found before any liability number is "
                        "signed off."),
        }
    return out


def section_liability(odoo, u_start, u_end, card_meta, point_value, pv_meta, args):
    """QUESTION: how big is the outstanding point liability against one month of
    sales?

    METHOD: liability_JOD = sum(loyalty.card.points) x point value. One month of
    sales is MEASURED as the trailing 30 days ending at the window end (not
    annual/12, so seasonality is not smoothed away). Both the gross liability
    and a breakage-adjusted range are printed."""
    out = {"exactness": "DERIVED (exact point balance x stated point value)",
           "method": "sum(loyalty.card.points) x point value, over trailing-30-day "
                     "measured POS sales"}
    pts = (card_meta or {}).get("outstanding_points_total")
    if pts is None:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("loyalty.card has no readable `points` field, so the "
                         "outstanding balance is unknown. It is NOT zero -- do not "
                         "report a zero liability.")
        return out
    if not point_value:
        out["status"] = "UNAVAILABLE"
        out["reason"] = "no point value available; liability cannot be expressed in JOD"
        return out
    end_dt = dt.datetime.strptime(u_end, "%Y-%m-%d %H:%M:%S")
    m_start = (end_dt - dt.timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
    n30, s30, _ = total_sum(odoo, "pos.order", order_domain(m_start, u_end), ["amount_total"])
    month_sales = s30.get("amount_total", 0.0)
    liab = pts * point_value if point_value else None
    out.update({
        "status": "OK",
        "outstanding_points": pts,
        "point_value_jod": point_value,
        "point_value_exactness": pv_meta.get("exactness"),
        "liability_jod": liab,
        "month_sales_jod": month_sales,
        "month_sales_orders": n30,
        "month_window": {"from_utc": m_start, "to_utc": u_end, "days": 30},
        "liability_share_of_month_sales": (liab / month_sales) if (liab and month_sales) else None,
        "caveats": [
            "This is the GROSS liability: every outstanding point valued as if it "
            "will be redeemed. Real liability is gross x (1 - breakage). Breakage "
            "cannot be measured until a full expiry cycle has run; the redemption "
            "rate in the section above is the best available proxy and the range "
            "below brackets it.",
            "Points held on cards whose tier never expires (defect D5 in the "
            "implementation brief: Gold/Black never expire) are PERMANENT liability. "
            "Split the balance by expiry policy before quoting a single number.",
            "One month of sales is the trailing 30 days of POS only. Adding "
            "Talabat/Careem revenue to the denominator would shrink this ratio "
            "without shrinking the liability -- do not do that.",
        ],
    })
    if liab and month_sales:
        rr = args.breakage_scenarios
        out["breakage_scenarios"] = [
            {"assumed_redemption_of_outstanding": r,
             "expected_cost_jod": liab * r,
             "share_of_month_sales": (liab * r) / month_sales}
            for r in rr]
        out["breakage_note"] = ("Scenarios, not measurements: each row assumes that "
                                "share of outstanding points is eventually redeemed.")
    return out


# --------------------------------------------------------------------------
# shared POS-line machinery (used by k, time-to-first-reward and mix)
# --------------------------------------------------------------------------

def line_price_field(caps, odoo):
    """POS line value field. price_subtotal_incl is tax-inclusive and is the
    right one to compare against amount_total; fall back if it is absent."""
    pol = odoo.fields_of("pos.order.line") or set()
    for f in ("price_subtotal_incl", "price_subtotal", "price_unit"):
        if f in pol:
            return f, pol
    return None, pol


_REWARD_LINE_CACHE = {}


def fetch_reward_lines(odoo, caps, price_field, u_start, u_end, args):
    """Every POS reward line settled in the window. This is the ONLY
    order-level evidence of a redemption that also exposes the basket, which
    is why k is computed from here and not from loyalty.history.

    Cached per window: the k section and the redemption-mix section both need
    it and it is the single most expensive query in the script."""
    ck = (u_start, u_end)
    if ck in _REWARD_LINE_CACHE:
        return _REWARD_LINE_CACHE[ck]
    if not caps["has_reward_line_flag"]:
        res = (None, "pos.order.line has no is_reward_line field -- the POS "
                     "loyalty bridge is not installed, so redemptions cannot be "
                     "tied to baskets")
        _REWARD_LINE_CACHE[ck] = res
        return res
    dom = [("is_reward_line", "=", True),
           ("order_id.date_order", ">=", u_start),
           ("order_id.date_order", "<", u_end),
           ("order_id.state", "in", SALE_STATES)]
    fields = ["order_id", "product_id", "qty", price_field]
    if caps.get("has_points_cost"):
        fields.append("points_cost")
    rows, truncated = odoo.search_read_all("pos.order.line", dom, fields,
                                           batch=args.batch, label="reward lines")
    if truncated:
        warn("reward-line fetch truncated")
    _REWARD_LINE_CACHE[ck] = (rows, None)
    return rows, None


def product_info(odoo, product_ids):
    """list_price (retail), standard_price (COGS) and category for a set of
    products. standard_price is the measured cost that feeds cost-per-reward;
    products with standard_price == 0 are flagged, because an unmaintained cost
    field silently makes rewards look free."""
    info = {}
    if not product_ids:
        return info
    for grp in chunks(sorted(set(product_ids)), 500):
        try:
            for p in odoo.read("product.product", grp,
                               ["display_name", "list_price", "standard_price", "categ_id"]):
                cat = p.get("categ_id")
                info[p["id"]] = {
                    "name": p.get("display_name"),
                    "list_price": float(p.get("list_price") or 0.0),
                    "standard_price": float(p.get("standard_price") or 0.0),
                    "categ_id": cat[0] if isinstance(cat, (list, tuple)) and cat else None,
                    "categ_name": cat[1] if isinstance(cat, (list, tuple)) and cat else None,
                }
        except Exception as exc:
            warn("product read failed for a chunk: %s" % exc)
    return info


def fetch_baskets(odoo, order_ids, price_field, args):
    """For each order id: paid basket (non-reward lines) and reward value.

    paid_basket deliberately EXCLUDES reward lines for BOTH the redemption
    visit and the comparison visits, so the two sides of the k comparison are
    measured the same way. reward_value is the absolute value of the reward
    lines; a free-product reward posts at price 0, so those fall back to the
    product's list price (retail), which is what a substituted purchase would
    have been worth."""
    baskets = {}
    zero_priced = defaultdict(float)   # order_id -> qty of zero-priced reward units
    zero_products = defaultdict(list)  # order_id -> [(product_id, qty)]
    for grp in chunks(sorted(order_ids), args.order_chunk):
        fields = ["order_id", "product_id", "qty", price_field, "is_reward_line"]
        try:
            rows, _ = odoo.search_read_all("pos.order.line", [("order_id", "in", grp)],
                                           fields, batch=args.batch)
        except Exception as exc:
            warn("line fetch failed for an order chunk: %s" % exc)
            continue
        for r in rows:
            oid = r["order_id"][0] if isinstance(r.get("order_id"), (list, tuple)) else r.get("order_id")
            b = baskets.setdefault(oid, {"paid": 0.0, "reward_raw": 0.0,
                                         "reward_units": 0.0, "n_lines": 0,
                                         "n_reward_lines": 0})
            val = float(r.get(price_field) or 0.0)
            b["n_lines"] += 1
            if r.get("is_reward_line"):
                b["n_reward_lines"] += 1
                b["reward_raw"] += val
                qty = float(r.get("qty") or 0.0)
                b["reward_units"] += qty
                if abs(val) < 0.001:
                    pid = r["product_id"][0] if isinstance(r.get("product_id"), (list, tuple)) else None
                    if pid:
                        zero_products[oid].append((pid, qty))
            else:
                b["paid"] += val
    # retail fallback for zero-priced (free product) reward lines
    pids = [pid for lst in zero_products.values() for pid, _ in lst]
    pinfo = product_info(odoo, pids) if pids else {}
    for oid, lst in zero_products.items():
        extra = sum(pinfo.get(pid, {}).get("list_price", 0.0) * qty for pid, qty in lst)
        baskets[oid]["reward_retail_fallback"] = extra
    for oid, b in baskets.items():
        b["reward_value"] = abs(b["reward_raw"]) + b.get("reward_retail_fallback", 0.0)
    return baskets


# --------------------------------------------------------------------------
# SECTION 5 -- SUBSTITUTION FACTOR k   (the most sensitive input in the design)
# --------------------------------------------------------------------------

K_ESTIMATOR_DOC = (
    "ESTIMATOR. For every redemption visit i by member p at time t:\n"
    "    B_paid(i)  = value of the NON-reward lines actually paid for in visit i\n"
    "    B_trail(i) = mean B_paid over p's previous up-to-8 visits before t\n"
    "    R(i)       = retail value of the reward given in visit i\n"
    "  If the reward were purely INCREMENTAL (they would not otherwise have\n"
    "  bought it) the paid basket is unchanged:   B_paid ~= B_trail.\n"
    "  If it were purely SUBSTITUTIVE (it replaced something they were buying\n"
    "  anyway) the paid basket falls by the reward: B_paid ~= B_trail - R.\n"
    "  Hence   k_i = (B_trail(i) - B_paid(i)) / R(i),  with k=0 fully\n"
    "  incremental and k=1 fully substitutive.\n"
    "  HEADLINE ESTIMATOR is the value-weighted ratio of sums,\n"
    "    k_hat = SUM_i (B_trail - B_paid) / SUM_i R,\n"
    "  because programme cost is a money-weighted quantity and the ratio of\n"
    "  sums is far more stable than the mean of per-visit ratios (whose\n"
    "  denominators are small)."
)

K_BIAS_DOC = [
    "UPWARD (towards more substitution, i.e. towards a MORE expensive verdict): "
    "regression to the mean. Members redeem after a run of good visits, so "
    "B_trail sits above their true counterfactual and (B_trail - B_paid) is "
    "inflated. This is the largest single bias.",
    "UPWARD: self-selection of the reward. People redeem for the thing they "
    "wanted, which is by construction the substitutive case; the incremental "
    "cases (a reward that tempts a new purchase) are under-represented among "
    "redemptions of a self-chosen catalogue.",
    "DOWNWARD (towards less substitution): if prior visits that themselves "
    "contained rewards are left in the trailing window, their paid baskets are "
    "already depressed, pulling B_trail down and k with it. --exclude-prior-"
    "redemptions (default on) removes them at the cost of sample size.",
    "DOWNWARD: unmeasured channels. Spend moved to Talabat/Careem is invisible "
    "here, so a member who shifted channel looks like a shrinking basket only "
    "if they also redeemed in POS.",
    "SELECTION: redemptions are dropped when fewer than --min-prior earlier "
    "visits exist, which keeps frequent customers and drops occasional ones. "
    "The dropped share is reported; if it is large, k describes regulars only.",
    "NOT CAUSAL. This is a within-person pre/post comparison with no control "
    "group. Only the proposal's 10% holdout can identify k without these "
    "biases. Treat the printed range as a planning bracket, and note the net "
    "direction is UPWARD, which makes it CONSERVATIVE for budgeting: it "
    "overstates cannibalisation, hence overstates programme cost.",
]


def section_k(odoo, caps, u_start, u_end, args):
    out = {"exactness": "ESTIMATE", "estimator": K_ESTIMATOR_DOC,
           "bias": K_BIAS_DOC,
           "method": "within-person pre/post over the trailing 8 visits; "
                     "value-weighted ratio-of-sums with a percentile bootstrap CI"}
    price_field, pol = line_price_field(caps, odoo)
    if not price_field:
        out["status"] = "UNAVAILABLE"
        out["reason"] = "pos.order.line has no usable price field"
        return out
    rows, err = fetch_reward_lines(odoo, caps, price_field, u_start, u_end, args)
    if err:
        out["status"] = "UNAVAILABLE"
        out["reason"] = err
        return out
    red_order_ids = sorted({(r["order_id"][0] if isinstance(r.get("order_id"), (list, tuple))
                             else r.get("order_id")) for r in rows})
    out["redemption_orders_found"] = len(red_order_ids)
    if not red_order_ids:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("no POS reward lines in the window -- either nobody "
                         "redeemed, or redemptions are not posted as reward lines. "
                         "k cannot be estimated and MUST NOT be assumed.")
        return out

    # order header for the redemption visits
    red_orders = {}
    for grp in chunks(red_order_ids, args.order_chunk):
        for o in odoo.read("pos.order", grp, ["partner_id", "date_order", "amount_total"]):
            pid = o["partner_id"][0] if isinstance(o.get("partner_id"), (list, tuple)) else None
            if not pid:
                continue  # anonymous redemption: no trailing history exists
            red_orders[o["id"]] = {"partner_id": pid, "date_order": o["date_order"],
                                   "amount_total": float(o.get("amount_total") or 0.0)}
    out["redemptions_with_partner"] = len(red_orders)
    out["redemptions_anonymous_dropped"] = len(red_order_ids) - len(red_orders)

    # sampling guard (declared, seeded, reproducible)
    sampled = sorted(red_orders)
    if args.max_k_redemptions and len(sampled) > args.max_k_redemptions:
        rng = random.Random(args.seed)
        sampled = sorted(rng.sample(sampled, args.max_k_redemptions))
        out["sampling"] = {"sampled": len(sampled), "population": len(red_orders),
                           "seed": args.seed,
                           "note": "uniform random subsample; the bootstrap CI below "
                                   "already reflects this sample size"}
    else:
        out["sampling"] = {"sampled": len(sampled), "population": len(red_orders),
                           "note": "no subsampling"}

    partners = sorted({red_orders[o]["partner_id"] for o in sampled})
    look_start = (dt.datetime.strptime(u_start, "%Y-%m-%d %H:%M:%S")
                  - dt.timedelta(days=args.lookback_days)).strftime("%Y-%m-%d %H:%M:%S")
    hist = defaultdict(list)
    for grp in chunks(partners, args.partner_chunk):
        try:
            hrows, _ = odoo.search_read_all(
                "pos.order",
                order_domain(look_start, u_end, [("partner_id", "in", grp)]),
                ["partner_id", "date_order"], batch=args.batch)
        except Exception as exc:
            warn("history fetch failed for a partner chunk: %s" % exc)
            continue
        for h in hrows:
            pid = h["partner_id"][0] if isinstance(h.get("partner_id"), (list, tuple)) else None
            if pid:
                hist[pid].append((h["date_order"], h["id"]))
    for pid in hist:
        hist[pid].sort()

    # which orders need basket detail: the redemptions + their prior visits
    need = set(sampled)
    prior_map = {}
    for oid in sampled:
        info = red_orders[oid]
        prev = [i for (d, i) in hist.get(info["partner_id"], []) if d < info["date_order"]]
        prior_map[oid] = prev[-args.trailing_visits:] if prev else []
        need.update(prior_map[oid])
    baskets = fetch_baskets(odoo, need, price_field, args)

    pairs = []
    per = []
    dropped = defaultdict(int)
    for oid in sampled:
        b = baskets.get(oid)
        if not b:
            dropped["no_basket_lines"] += 1
            continue
        R = b.get("reward_value") or 0.0
        if R <= args.min_reward_value:
            dropped["reward_value_not_derivable"] += 1
            continue
        prev = prior_map.get(oid) or []
        if args.exclude_prior_redemptions:
            prev = [i for i in prev
                    if (baskets.get(i) or {}).get("n_reward_lines", 0) == 0]
        prev_paid = [baskets[i]["paid"] for i in prev if i in baskets]
        if len(prev_paid) < args.min_prior:
            dropped["insufficient_prior_visits"] += 1
            continue
        btrail = mean(prev_paid)
        bpaid = b["paid"]
        pairs.append((btrail - bpaid, R))
        per.append({"order_id": oid, "k": (btrail - bpaid) / R, "R": R,
                    "b_trail": btrail, "b_paid": bpaid,
                    "n_prior": len(prev_paid),
                    "prior_sd": stdev(prev_paid)})
    out["dropped"] = dict(dropped)
    out["usable_redemptions"] = len(pairs)

    if len(pairs) < args.k_min_sample:
        out["status"] = "INSUFFICIENT"
        out["reason"] = ("only %d usable redemptions (minimum %d). k is NOT "
                         "reportable. Do not substitute a benchmark value: run "
                         "the window longer, or launch with the holdout group and "
                         "measure k properly."
                         % (len(pairs), args.k_min_sample))
        return out

    k_hat = ratio_of_sums(pairs)
    lo, hi = bootstrap_ci(pairs, args.bootstrap, args.seed)
    ks = sorted(p["k"] for p in per)
    ks_clipped = sorted(min(1.0, max(0.0, k)) for k in ks)
    noise = [ (p["prior_sd"] / p["R"]) for p in per if p["prior_sd"] and p["R"] ]
    noise.sort()
    ns = pctl(noise, 50) if noise else None

    out.update({
        "status": "OK",
        "k_point_estimate_do_not_quote_alone": k_hat,
        "k_ci95": {"low": lo, "high": hi},
        "k_reported_range": {
            "raw_low": round(math.floor((lo if lo is not None else k_hat) * 20) / 20.0, 3),
            "raw_high": round(math.ceil((hi if hi is not None else k_hat) * 20) / 20.0, 3),
            "low": max(0.0, round(math.floor((lo if lo is not None else k_hat) * 20) / 20.0, 3)),
            "high": min(1.0, round(math.ceil((hi if hi is not None else k_hat) * 20) / 20.0, 3)),
            "clipped_below_zero": (lo is not None and lo < 0),
            "clipped_above_one": (hi is not None and hi > 1),
            "note": "CI widened outward to the nearest 0.05, then clipped to [0,1] "
                    "for the planning range. This is the range to carry into the "
                    "economics; quoting a single k from this data is not supportable.",
            "clipping_note": ("The raw interval extends OUTSIDE [0,1]. Below 0 means "
                              "redeemers' paid baskets did not fall at all (the "
                              "reward looks incremental, or even complementary); "
                              "above 1 means they fell by MORE than the reward is "
                              "worth (the reward is displacing more than itself, or "
                              "the trailing mean is inflated). Both are real signals "
                              "-- read raw_low/raw_high, not just the clipped range."),
        },
        "robust": {"median_k": pctl(ks, 50), "p25_k": pctl(ks, 25), "p75_k": pctl(ks, 75),
                   "median_k_clipped": pctl(ks_clipped, 50),
                   "share_k_below_0": sum(1 for k in ks if k < 0) / len(ks),
                   "share_k_above_1": sum(1 for k in ks if k > 1) / len(ks)},
        "resolvability": {
            "median_prior_basket_sd_over_reward_value": ns,
            "reading": ("Signal-to-noise check. The reward is worth R JOD but a "
                        "member's basket already varies by this multiple of R from "
                        "visit to visit. Above ~2 the per-visit comparison cannot "
                        "resolve k at all and only the aggregate ratio (with its CI) "
                        "means anything; above ~4, even that is thin -- say so in the "
                        "design and gate on the holdout instead."),
            "verdict": ("UNRESOLVABLE at visit level" if (ns or 0) > 4 else
                        "NOISY -- aggregate only" if (ns or 0) > 2 else
                        "acceptable"),
        },
        "parameters": {"trailing_visits": args.trailing_visits,
                       "min_prior": args.min_prior,
                       "exclude_prior_redemptions": args.exclude_prior_redemptions,
                       "lookback_days": args.lookback_days,
                       "bootstrap_resamples": args.bootstrap, "seed": args.seed},
        "caveats": [
            "The CI covers SAMPLING error only. The biases listed above are NOT in "
            "it and are larger than it; the true uncertainty band is wider than the "
            "printed CI on the upside.",
            "k is reported as a range on purpose. The proposal's economics used a "
            "single k=0.7; re-run those economics at both ends of this range and "
            "report the spread in programme cost, not a point number.",
        ],
    })
    if args.k_examples:
        per.sort(key=lambda p: -p["R"])
        out["examples"] = per[:args.k_examples]
    return out


# --------------------------------------------------------------------------
# SECTION 6 -- TIME TO FIRST REWARD (in visits)
# --------------------------------------------------------------------------

def section_time_to_first_reward(odoo, caps, u_start, u_end, members, args):
    """QUESTION: how many visits does a member make between their first earn
    and their first redemption? The proposal's central idea -- a first rung at
    100 points -- lives or dies on this number.

    METHOD: uniform seeded sample of --max-ttfr-members card holders. For each,
    every POS visit in the trailing --history-days is read, and the visits that
    carry a reward line are marked. 'Visits to first reward' counts the first
    visit through to and including the redeeming visit.

    HOW TO READ IT: the distribution over REDEEMERS is biased DOWNWARD, because
    members who have not redeemed yet are right-censored and excluded. The
    censored share is printed next to it and is the more important number: if
    most members never reach a reward, the redeemer median is describing a
    small, fast minority."""
    out = {"exactness": "ESTIMATE (uniform sample, right-censored)",
           "method": "seeded uniform sample of card holders; POS visit sequence "
                     "over the trailing history window; first visit carrying a "
                     "reward line ends the count"}
    if members is None:
        out["status"] = "UNAVAILABLE"
        out["reason"] = "member set unavailable"
        return out
    if not caps["has_reward_line_flag"]:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("pos.order.line.is_reward_line missing -- redemption "
                         "visits cannot be identified")
        return out
    end_dt = dt.datetime.strptime(u_end, "%Y-%m-%d %H:%M:%S")
    h_start = (end_dt - dt.timedelta(days=args.history_days)).strftime("%Y-%m-%d %H:%M:%S")

    rng = random.Random(args.seed)
    pool = sorted(members)
    sample = pool if len(pool) <= args.max_ttfr_members else sorted(
        rng.sample(pool, args.max_ttfr_members))
    out["sample"] = {"sampled_members": len(sample), "member_population": len(pool),
                     "seed": args.seed, "history_days": args.history_days,
                     "history_from_utc": h_start, "history_to_utc": u_end}

    visits = defaultdict(list)   # partner -> [(date, order_id)]
    for grp in chunks(sample, args.partner_chunk):
        try:
            rows, _ = odoo.search_read_all(
                "pos.order", order_domain(h_start, u_end, [("partner_id", "in", grp)]),
                ["partner_id", "date_order"], batch=args.batch)
        except Exception as exc:
            warn("ttfr history fetch failed for a chunk: %s" % exc)
            continue
        for r in rows:
            pid = r["partner_id"][0] if isinstance(r.get("partner_id"), (list, tuple)) else None
            if pid:
                visits[pid].append((r["date_order"], r["id"]))
    for pid in visits:
        visits[pid].sort()

    all_order_ids = [oid for lst in visits.values() for _, oid in lst]
    reward_orders = set()
    for grp in chunks(all_order_ids, args.order_chunk):
        try:
            rows, _ = odoo.search_read_all(
                "pos.order.line",
                [("is_reward_line", "=", True), ("order_id", "in", grp)],
                ["order_id"], batch=args.batch)
        except Exception as exc:
            warn("ttfr reward-line fetch failed for a chunk: %s" % exc)
            continue
        for r in rows:
            oid = r["order_id"][0] if isinstance(r.get("order_id"), (list, tuple)) else r.get("order_id")
            reward_orders.add(oid)

    redeemer_visits = []
    censored_visits = []
    left_truncation_risk = 0
    trunc_edge = (dt.datetime.strptime(h_start, "%Y-%m-%d %H:%M:%S")
                  + dt.timedelta(days=args.truncation_margin_days)).strftime("%Y-%m-%d %H:%M:%S")
    for pid, seq in visits.items():
        if not seq:
            continue
        if seq[0][0] <= trunc_edge:
            left_truncation_risk += 1
        idx = None
        for i, (_, oid) in enumerate(seq):
            if oid in reward_orders:
                idx = i
                break
        if idx is None:
            censored_visits.append(len(seq))
        else:
            redeemer_visits.append(idx + 1)

    n_active = len(visits)
    n_red = len(redeemer_visits)
    rv = sorted(redeemer_visits)
    cv = sorted(censored_visits)
    out.update({
        "status": "OK",
        "sampled_members_with_visits": n_active,
        "sampled_members_no_visits_in_history": len(sample) - n_active,
        "redeemers": n_red,
        "censored_never_redeemed": len(cv),
        "censored_share_of_active": (len(cv) / n_active) if n_active else None,
        "visits_to_first_reward_redeemers_only": ({
            "n": n_red, "min": rv[0], "p25": pctl(rv, 25), "p50": pctl(rv, 50),
            "p75": pctl(rv, 75), "p90": pctl(rv, 90), "max": rv[-1], "mean": mean(rv),
            "share_redeeming_on_first_visit": sum(1 for v in rv if v == 1) / n_red,
        } if n_red else None),
        "visits_so_far_censored_members_lower_bound": ({
            "n": len(cv), "p50": pctl(cv, 50), "p90": pctl(cv, 90), "max": cv[-1],
        } if cv else None),
        "left_truncation_risk_members": left_truncation_risk,
        "left_truncation_share": (left_truncation_risk / n_active) if n_active else None,
        "caveats": [
            "RIGHT-CENSORING: members who have not redeemed are excluded from the "
            "redeemer distribution, which therefore understates the true time to "
            "first reward. Read censored_share_of_active first.",
            "LEFT-TRUNCATION: members whose first visit predates the history window "
            "start have their earlier visits invisible, so their count is too low. "
            "left_truncation_share is the fraction at risk (first visit within "
            "%d days of the window start)." % args.truncation_margin_days,
            "'First earn' is proxied by the first identified POS visit in the "
            "history window. If earning ever happens without a POS purchase "
            "(sign-up bonus, app registration), the true first earn is earlier and "
            "these counts are too low.",
            "Sampling error: with n=%d sampled members, a reported share of ~50%% "
            "carries roughly +/-%s at 95%% confidence." %
            (len(sample), pct(1.96 * math.sqrt(0.25 / max(1, len(sample))), 1)),
        ],
    })
    return out


# --------------------------------------------------------------------------
# SECTION 7 -- REDEMPTION MIX by product category, and cost per reward
# --------------------------------------------------------------------------

def load_category_map(path):
    if not path:
        return dict(DEFAULT_CATEGORY_MAP), "built-in default keyword map"
    try:
        with open(path, "r", encoding="utf-8") as fh:
            m = json.load(fh)
        if not isinstance(m, dict):
            raise ValueError("category map must be a JSON object of bucket -> [keywords]")
        return m, "custom map from %s" % path
    except Exception as exc:
        warn("could not load --category-map %s (%s); using the built-in map" % (path, exc))
        return dict(DEFAULT_CATEGORY_MAP), "built-in default keyword map (custom map failed to load)"


def bucket_for(cat_name, cmap):
    if not cat_name:
        return "unknown"
    low = str(cat_name).lower()
    for bucket, words in cmap.items():
        for w in words:
            if str(w).lower() in low:
                return bucket
    return "other"


def section_mix(odoo, caps, u_start, u_end, args):
    """QUESTION: what are members actually redeeming FOR, and what does one
    reward cost in JOD?

    METHOD: every reward line in the window, its product's category bucketed by
    keyword, and its cost taken from product.product.standard_price (the
    measured COGS field). Retail value is list_price. Both are reported per
    bucket so cost-per-reward-JOD can be computed per category rather than as
    one blended number.

    HOW TO READ IT: standard_price is only as good as the cost maintenance in
    Odoo. The share of reward units whose product carries standard_price == 0
    is printed; if it is large, the cost column is an under-count and the
    retail column is the safer planning basis."""
    out = {"exactness": "EXACT (counts and retail) / DERIVED (cost, depends on "
                        "standard_price maintenance)",
           "method": "pos.order.line where is_reward_line, joined to "
                     "product.product for categ_id / list_price / standard_price"}
    price_field, _ = line_price_field(caps, odoo)
    if not price_field:
        out["status"] = "UNAVAILABLE"
        out["reason"] = "pos.order.line has no usable price field"
        return out
    rows, err = fetch_reward_lines(odoo, caps, price_field, u_start, u_end, args)
    if err:
        out["status"] = "UNAVAILABLE"
        out["reason"] = err
        return out
    if not rows:
        out["status"] = "UNAVAILABLE"
        out["reason"] = "no reward lines in the window"
        return out
    cmap, cmap_src = load_category_map(args.category_map)
    out["category_map_source"] = cmap_src
    pids = [r["product_id"][0] for r in rows
            if isinstance(r.get("product_id"), (list, tuple)) and r.get("product_id")]
    pinfo = product_info(odoo, pids)

    agg = defaultdict(lambda: {"lines": 0, "units": 0.0, "posted_value_jod": 0.0,
                               "retail_value_jod": 0.0, "cogs_jod": 0.0,
                               "units_missing_cost": 0.0, "products": set()})
    orders = set()
    for r in rows:
        oid = r["order_id"][0] if isinstance(r.get("order_id"), (list, tuple)) else r.get("order_id")
        orders.add(oid)
        pid = r["product_id"][0] if isinstance(r.get("product_id"), (list, tuple)) and r.get("product_id") else None
        pi = pinfo.get(pid, {})
        b = bucket_for(pi.get("categ_name"), cmap)
        qty = float(r.get("qty") or 0.0)
        a = agg[b]
        a["lines"] += 1
        a["units"] += qty
        a["posted_value_jod"] += abs(float(r.get(price_field) or 0.0))
        a["retail_value_jod"] += float(pi.get("list_price") or 0.0) * qty
        sp = float(pi.get("standard_price") or 0.0)
        a["cogs_jod"] += sp * qty
        if sp <= 0:
            a["units_missing_cost"] += qty
        if pid:
            a["products"].add(pid)

    buckets = []
    tot_units = sum(a["units"] for a in agg.values()) or 1.0
    tot_retail = sum(a["retail_value_jod"] for a in agg.values())
    tot_cogs = sum(a["cogs_jod"] for a in agg.values())
    tot_missing = sum(a["units_missing_cost"] for a in agg.values())
    for b, a in sorted(agg.items(), key=lambda kv: -kv[1]["units"]):
        buckets.append({
            "bucket": b, "reward_lines": a["lines"], "units": a["units"],
            "unit_share": a["units"] / tot_units,
            "posted_value_jod": a["posted_value_jod"],
            "retail_value_jod": a["retail_value_jod"],
            "cogs_jod": a["cogs_jod"],
            "retail_per_unit_jod": (a["retail_value_jod"] / a["units"]) if a["units"] else None,
            "cogs_per_unit_jod": (a["cogs_jod"] / a["units"]) if a["units"] else None,
            "distinct_products": len(a["products"]),
            "units_missing_standard_price": a["units_missing_cost"],
        })
    out.update({
        "status": "OK",
        "redemption_orders": len(orders),
        "reward_lines": len(rows),
        "buckets": buckets,
        "totals": {
            "units": tot_units, "retail_value_jod": tot_retail, "cogs_jod": tot_cogs,
            "retail_per_reward_order_jod": (tot_retail / len(orders)) if orders else None,
            "cogs_per_reward_order_jod": (tot_cogs / len(orders)) if orders else None,
            "units_missing_standard_price_share": (tot_missing / tot_units) if tot_units else None,
        },
        "caveats": [
            "Bucketing is keyword matching on product.category.complete_name. Any "
            "category that matches nothing lands in 'other'/'unknown'; if those "
            "buckets are large the map needs fixing before the mix is quoted "
            "(--category-map takes a JSON override).",
            "'posted_value_jod' is what the POS actually recorded on the reward "
            "line (0 for a free product, the discount for a cash-style reward). "
            "'retail_value_jod' is list_price x qty and is the right basis for "
            "revenue displacement; 'cogs_jod' is standard_price x qty and is the "
            "right basis for out-of-pocket cost. They answer different questions.",
            "cost-per-reward-JOD from this table is a MIX-WEIGHTED average of what "
            "members chose to redeem in this window. It will move when the reward "
            "catalogue changes, so it is not a constant to hardcode in the design.",
        ],
    })
    return out


# --------------------------------------------------------------------------
# human report
# --------------------------------------------------------------------------

def hr(title=""):
    if title:
        print("\n" + "=" * 78)
        print(title)
        print("=" * 78)
    else:
        print("-" * 78)


def show_caveats(sec):
    for c in sec.get("caveats", []) or []:
        print("    - %s" % c)


def unavailable(name, sec):
    print("\n%s: %s" % (name, sec.get("status")))
    print("    reason: %s" % sec.get("reason", "?"))
    print("    -> This gate number is NOT available. Do not substitute a benchmark "
          "or an assumed value in the design; mark it OPEN.")


def render(report):
    m = report["meta"]
    hr("ALMOND LOYALTY -- PHASE-0 MEASUREMENT GATE (read-only)")
    print("database        : %s" % m["db"])
    print("host            : %s" % m["url"])
    print("generated (UTC) : %s   script v%s" % (m["generated_utc"], m["script_version"]))
    print("window (local)  : %s -> %s  (%0.1f days, end exclusive)"
          % (m["window_local_from"], m["window_local_to"], m["window_days"]))
    print("window (UTC)    : %s -> %s   [tz offset %+0.1fh applied]"
          % (m["window_utc_from"], m["window_utc_to"], m["tz_offset_hours"]))
    print("order states    : %s" % ", ".join(SALE_STATES))
    print("rpc calls       : %d" % m["rpc_calls"])
    print("\nEXACTNESS KEY  EXACT = counted in the DB | DERIVED = arithmetic on EXACT")
    print("               ESTIMATE = statistical, CI printed | ASSUMPTION = input "
          "not readable from the DB")

    # ---- configuration actually found -----------------------------------
    pv = report["point_value"]
    hr("0. PROGRAM CONFIGURATION AS FOUND (context for every number below)")
    progs = report["programs"]
    if progs.get("status") != "OK":
        print("  loyalty configuration: %s (%s)" % (progs.get("status"), progs.get("reason")))
    else:
        print("  loyalty.program rows: %d" % len(progs.get("programs") or []))
        for p in (progs.get("programs") or [])[:12]:
            print("    #%-5s %-38s type=%-16s active=%s"
                  % (p.get("id"), str(p.get("name"))[:38],
                     p.get("program_type"), p.get("active")))
        print("  loyalty.reward rows: %d   loyalty.rule rows: %d"
              % (len(progs.get("rewards") or []), len(progs.get("rules") or [])))
    print("\n  POINT VALUE USED: %s JOD per point" % money(pv.get("value")))
    print("    basis      : %s" % pv.get("basis"))
    print("    exactness  : %s" % pv.get("exactness"))
    if pv.get("matches_owner_claim_1_qirsh") is True:
        print("    owner claim: CONFIRMED -- configuration agrees that 1 point = 1 qirsh (0.01 JOD)")
    elif pv.get("matches_owner_claim_1_qirsh") is False:
        print("    owner claim: REFUTED -- configuration says %s JOD/point, NOT 0.01. "
              "Every JOD figure below uses the configured value."
              % money(pv.get("value")))
    else:
        print("    owner claim: UNVERIFIED -- nothing in loyalty.reward pins the point "
              "value, so the '1 point = 1 qirsh' claim remains an assumption.")
    cm = report.get("cards") or {}
    if cm.get("status") == "OK":
        print("\n  cards: %d total (%d attached to a partner, %d anonymous) -> %d distinct members"
              % (cm["cards_total"], cm["cards_with_partner"], cm["cards_anonymous"],
                 cm["distinct_member_partners"]))
        print("  outstanding points on cards: %s" % money(cm["outstanding_points_total"]))

    # ---- 1 coverage ------------------------------------------------------
    sec = report["sections"].get("coverage") or {}
    hr("1. MEMBER COVERAGE, PER BRANCH   [%s]" % sec.get("exactness", "?"))
    if sec.get("status") != "OK":
        unavailable("coverage", sec)
    else:
        print("  method: %s" % sec["method"])
        print("  branch key: %s (%s)" % (sec.get("grouping_key"), sec.get("grouping_desc")))
        print()
        print("  %-26s %9s %13s %8s %9s %9s" %
              ("BRANCH", "ORDERS", "VALUE JOD", "AVG INV", "COV#", "COV JOD"))
        for b in sec["branches"]:
            print("  %-26s %9d %13s %8s %9s %9s"
                  % (str(b["branch"])[:26], b["orders"], money(b["value_jod"]),
                     money(b["avg_invoice_jod"]) if b["avg_invoice_jod"] else "-",
                     pct(b["coverage_by_count"]), pct(b["coverage_by_value"])))
        n = sec["network"]
        print("  " + "-" * 74)
        print("  %-26s %9d %13s %8s %9s %9s"
              % ("NETWORK", n["orders"], money(n["value_jod"]),
                 money(n["avg_invoice_jod"]) if n["avg_invoice_jod"] else "-",
                 pct(n["coverage_by_count"]), pct(n["coverage_by_value"])))
        print("\n  identified (any partner) : %s of orders" % pct(n["identified_coverage_by_count"]))
        print("  member (holds a card)    : %s of orders / %s of value"
              % (pct(n["coverage_by_count"]), pct(n["coverage_by_value"])))
        sp = sec["branch_spread"]
        if sp.get("min_coverage_by_count") is not None:
            print("  per-branch spread by count: %s .. %s  <- if this spread is wide, a "
                  "single network coverage\n     figure is not a usable planning input; "
                  "the design must be sized on the worst branch."
                  % (pct(sp["min_coverage_by_count"]), pct(sp["max_coverage_by_count"])))
        print("\n  caveats:")
        show_caveats(sec)

    # ---- 2 spend + tiers -------------------------------------------------
    sec = report["sections"].get("spend") or {}
    hr("2. MEMBER SPEND DISTRIBUTION AND TIER CALIBRATION   [%s]" % sec.get("exactness", "?"))
    if sec.get("status") != "OK":
        unavailable("spend", sec)
    else:
        print("  method: %s" % sec["method"])
        for key in ("active_members", "all_cardholders"):
            d = sec[key]
            if not d.get("n"):
                continue
            print("\n  %s   n=%d  total=%s JOD  mean=%s JOD"
                  % (d["basis"], d["n"], money(d["total_jod"]), money(d["mean_jod"])))
            print("    p50=%s  p70=%s  p90=%s  p95=%s  p97=%s  max=%s"
                  % (money(d["p50_jod"]), money(d["p70_jod"]), money(d["p90_jod"]),
                     money(d["p95_jod"]), money(d["p97_jod"]), money(d["max_jod"])))
        print("\n  inactive card holders in window: %d (%s of all cards)"
              % (sec["inactive_cardholders"], pct(sec["inactive_share"])))
        cal = sec.get("tier_calibration") or {}
        print("\n  TIER THRESHOLDS THAT WOULD PRODUCE THE TARGET SHAPE")
        print("  basis: %s members | rounding: %s JOD | target base %d-%d%%, "
              "middle %d-%d%%, top %d-%d%%"
              % (sec["tier_basis_used"], cal.get("rounding_jod"),
                 TARGET_SHAPE["base"][0] * 100, TARGET_SHAPE["base"][1] * 100,
                 TARGET_SHAPE["middle"][0] * 100, TARGET_SHAPE["middle"][1] * 100,
                 TARGET_SHAPE["top"][0] * 100, TARGET_SHAPE["top"][1] * 100))
        if cal.get("status") != "OK":
            print("    UNAVAILABLE: %s" % cal.get("reason"))
        else:
            print("\n  %-22s %11s %11s | %-28s" %
                  ("TARGET base/mid/top", "MIDDLE JOD", "TOP JOD", "REALISED at rounded"))
            for c in cal["candidates"]:
                t = c["target"]
                r = c["realised_at_rounded"] or {}
                print("  %-22s %11s %11s | %5s / %5s / %5s %s"
                      % ("%d/%d/%d%%" % (t["base"] * 100, round(t["middle"] * 100), t["top"] * 100),
                         money(c["rounded_threshold_middle_jod"]),
                         money(c["rounded_threshold_top_jod"]),
                         pct(r.get("base_share"), 0), pct(r.get("middle_share"), 0),
                         pct(r.get("top_share"), 0),
                         "OK" if r.get("in_target") else ""))
            print("\n    Read the RIGHT-HAND column: that is the shape the business would "
                  "actually get\n    at the rounded threshold. Where it differs from the "
                  "target, ties at round menu\n    prices are the cause.")
        print("\n  THRESHOLDS ALREADY PROPOSED, SCORED ON THIS DATA")
        for p in sec.get("proposed_thresholds_scored") or []:
            r = p.get("realised") or {}
            print("    %-34s mid=%s top=%s -> base %s / middle %s / TOP %s"
                  % (p["label"][:34], money(p["middle_jod"]), money(p["top_jod"]),
                     pct(r.get("base_share"), 0), pct(r.get("middle_share"), 0),
                     pct(r.get("top_share"), 0)))
            if p.get("note"):
                print("      note: %s" % p["note"])
        print("\n  caveats:")
        show_caveats(sec)

    # ---- 3 redemption ----------------------------------------------------
    sec = report["sections"].get("redemption") or {}
    hr("3. REDEMPTION RATE AND OUTSTANDING BALANCE   [%s]" % sec.get("exactness", "?"))
    if sec.get("status") != "OK":
        unavailable("redemption", sec)
    else:
        print("  method: %s" % sec["method"])
        w = sec["window"]
        l = sec["lifetime"]
        print("\n  window   : issued %s pts | used %s pts | rate %s"
              % (money(w["points_issued"]), money(w["points_used"]),
                 pct(w["redemption_rate"]) if w["redemption_rate"] is not None else "n/a"))
        print("             issued %s JOD | used %s JOD"
              % (money(w["points_issued_jod"]), money(w["points_used_jod"])))
        print("  lifetime : issued %s pts | used %s pts | rate %s"
              % (money(l["points_issued"]), money(l["points_used"]),
                 pct(l["redemption_rate"]) if l["redemption_rate"] is not None else "n/a"))
        o = sec["outstanding"]
        print("  outstanding: %s pts = %s JOD  (%s)"
              % (money(o["points"]), money(o["jod"]), o["source"]))
        rec = sec.get("reconciliation")
        if rec:
            print("\n  reconciliation: lifetime issued-used = %s pts vs card balances %s pts "
                  "-> gap %s (%s)"
                  % (money(rec["lifetime_issued_minus_used"]), money(rec["sum_of_card_points"]),
                     money(rec["difference"]),
                     pct(rec["difference_share"]) if rec["difference_share"] is not None else "n/a"))
            print("    %s" % rec["reading"])
        print("\n  caveats:")
        show_caveats(sec)

    # ---- 4 liability -----------------------------------------------------
    sec = report["sections"].get("liability") or {}
    hr("4. LIABILITY AGAINST ONE MONTH OF SALES   [%s]" % sec.get("exactness", "?"))
    if sec.get("status") != "OK":
        unavailable("liability", sec)
    else:
        print("  method: %s" % sec["method"])
        print("\n  outstanding points      : %s" % money(sec["outstanding_points"]))
        print("  point value             : %s JOD  [%s]"
              % (money(sec["point_value_jod"]), sec["point_value_exactness"]))
        print("  GROSS LIABILITY         : %s JOD" % money(sec["liability_jod"]))
        print("  measured month of sales : %s JOD over %d orders (trailing 30 days)"
              % (money(sec["month_sales_jod"]), sec["month_sales_orders"]))
        print("  LIABILITY / MONTH SALES : %s"
              % pct(sec["liability_share_of_month_sales"]))
        for s in sec.get("breakage_scenarios") or []:
            print("    if %s of outstanding points are eventually redeemed -> "
                  "%s JOD (%s of a month)"
                  % (pct(s["assumed_redemption_of_outstanding"], 0),
                     money(s["expected_cost_jod"]), pct(s["share_of_month_sales"])))
        if sec.get("breakage_note"):
            print("    %s" % sec["breakage_note"])
        print("\n  caveats:")
        show_caveats(sec)

    # ---- 5 k -------------------------------------------------------------
    sec = report["sections"].get("k") or {}
    hr("5. SUBSTITUTION FACTOR k   [%s]" % sec.get("exactness", "?"))
    print(sec.get("estimator", ""))
    if sec.get("status") not in ("OK",):
        unavailable("k", sec)
        print("\n  BIAS AND LIMITS OF THE ESTIMATOR (they apply whenever it does run):")
        for b in sec.get("bias", []):
            print("    - %s" % b)
    else:
        s = sec["sampling"]
        print("\n  redemption orders in window : %d (%d anonymous, dropped)"
              % (sec["redemption_orders_found"], sec["redemptions_anonymous_dropped"]))
        print("  analysed                    : %d of %d (%s)"
              % (s["sampled"], s["population"], s.get("note")))
        print("  usable after history filter : %d   dropped: %s"
              % (sec["usable_redemptions"], sec.get("dropped")))
        r = sec["k_reported_range"]
        print("\n  >>> k = %s .. %s   (REPORT THIS RANGE, NOT A SINGLE NUMBER)"
              % (money(r["low"]), money(r["high"])))
        if r.get("clipped_below_zero") or r.get("clipped_above_one"):
            print("      raw interval before clipping: %s .. %s"
                  % (money(r["raw_low"]), money(r["raw_high"])))
            print("      %s" % r["clipping_note"])
        print("      point estimate %s, bootstrap 95%% CI [%s, %s] over %d resamples"
              % (money(sec["k_point_estimate_do_not_quote_alone"]),
                 money((sec["k_ci95"] or {}).get("low")),
                 money((sec["k_ci95"] or {}).get("high")),
                 sec["parameters"]["bootstrap_resamples"]))
        rb = sec["robust"]
        print("      robust check: median k=%s (clipped %s), IQR %s..%s, "
              "%s of visits below 0 and %s above 1"
              % (money(rb["median_k"]), money(rb["median_k_clipped"]),
                 money(rb["p25_k"]), money(rb["p75_k"]),
                 pct(rb["share_k_below_0"]), pct(rb["share_k_above_1"])))
        rs = sec["resolvability"]
        print("\n  RESOLVABILITY: basket noise / reward value = %s -> %s"
              % (money(rs["median_prior_basket_sd_over_reward_value"]), rs["verdict"]))
        print("    %s" % rs["reading"])
        print("\n  BIAS (direction matters more than the CI):")
        for b in sec.get("bias", []):
            print("    - %s" % b)
        print("\n  caveats:")
        show_caveats(sec)

    # ---- 6 time to first reward -----------------------------------------
    sec = report["sections"].get("ttfr") or {}
    hr("6. TIME TO FIRST REWARD (visits)   [%s]" % sec.get("exactness", "?"))
    if sec.get("status") != "OK":
        unavailable("ttfr", sec)
    else:
        print("  method: %s" % sec["method"])
        print("\n  sampled members: %d of %d (seed %d, history %d days)"
              % (sec["sample"]["sampled_members"], sec["sample"]["member_population"],
                 sec["sample"]["seed"], sec["sample"]["history_days"]))
        print("  with >=1 visit : %d   redeemers: %d   never redeemed: %d (%s)"
              % (sec["sampled_members_with_visits"], sec["redeemers"],
                 sec["censored_never_redeemed"], pct(sec["censored_share_of_active"])))
        d = sec.get("visits_to_first_reward_redeemers_only")
        if d:
            print("\n  visits to first reward (REDEEMERS ONLY -- biased low):")
            print("    min=%d p25=%s p50=%s p75=%s p90=%s max=%d mean=%s"
                  % (d["min"], money(d["p25"]), money(d["p50"]), money(d["p75"]),
                     money(d["p90"]), d["max"], money(d["mean"])))
            print("    redeemed on their very first visit: %s"
                  % pct(d["share_redeeming_on_first_visit"]))
        c = sec.get("visits_so_far_censored_members_lower_bound")
        if c:
            print("  visits so far by members who have NEVER redeemed (lower bound): "
                  "p50=%s p90=%s max=%d" % (money(c["p50"]), money(c["p90"]), c["max"]))
        print("\n  caveats:")
        show_caveats(sec)

    # ---- 7 mix -----------------------------------------------------------
    sec = report["sections"].get("mix") or {}
    hr("7. REDEMPTION MIX BY CATEGORY (feeds cost-per-reward-JOD)   [%s]"
       % sec.get("exactness", "?"))
    if sec.get("status") != "OK":
        unavailable("mix", sec)
    else:
        print("  method: %s" % sec["method"])
        print("  category map: %s" % sec["category_map_source"])
        print("\n  %-12s %8s %9s %7s %13s %13s %11s %11s"
              % ("BUCKET", "LINES", "UNITS", "SHARE", "RETAIL JOD", "COGS JOD",
                 "RETAIL/UNIT", "COGS/UNIT"))
        for b in sec["buckets"]:
            print("  %-12s %8d %9s %7s %13s %13s %11s %11s"
                  % (b["bucket"][:12], b["reward_lines"], money(b["units"]),
                     pct(b["unit_share"], 0), money(b["retail_value_jod"]),
                     money(b["cogs_jod"]), money(b["retail_per_unit_jod"]),
                     money(b["cogs_per_unit_jod"])))
        t = sec["totals"]
        print("  " + "-" * 74)
        print("  redemption orders: %d | retail per redeeming order: %s JOD | "
              "COGS per redeeming order: %s JOD"
              % (sec["redemption_orders"], money(t["retail_per_reward_order_jod"]),
                 money(t["cogs_per_reward_order_jod"])))
        print("  reward units whose product has standard_price = 0: %s "
              "<- cost column is an UNDER-count by at least this share"
              % pct(t["units_missing_standard_price_share"]))
        print("\n  caveats:")
        show_caveats(sec)

    # ---- closing ---------------------------------------------------------
    hr("GATE SUMMARY")
    avail = [k for k, v in report["sections"].items() if (v or {}).get("status") == "OK"]
    missing = [k for k, v in report["sections"].items() if (v or {}).get("status") != "OK"]
    print("  measured : %s" % (", ".join(sorted(avail)) or "(none)"))
    print("  OPEN     : %s" % (", ".join(sorted(missing)) or "(none)"))
    if missing:
        print("\n  The proposal's gate says nothing is built before these exist. Every "
              "item on the\n  OPEN line must be marked OPEN in the design document -- "
              "not filled with a\n  benchmark, an average or an assumption.")
    print("\n  This run was READ-ONLY: %d RPC calls, all on the read whitelist %s."
          % (report["meta"]["rpc_calls"], sorted(READ_ONLY_METHODS)[:4] + ["..."]))
    print("  Re-run with --json to get these numbers in a pasteable form.\n")


# --------------------------------------------------------------------------
# CLI + main
# --------------------------------------------------------------------------

ALL_SECTIONS = ["coverage", "spend", "redemption", "liability", "k", "ttfr", "mix"]


def build_parser():
    p = argparse.ArgumentParser(
        prog="loyalty_measure.py",
        description="Almond Phase-0 loyalty measurement gate (READ-ONLY Odoo 19 XML-RPC).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Read-only by construction: every RPC method is checked against a "
               "whitelist before it is sent. No production write approval is needed "
               "or accepted.")
    w = p.add_argument_group("window")
    w.add_argument("--days", type=int, default=90,
                   help="rolling window length in days, ending today (default: 90)")
    w.add_argument("--from", dest="date_from", metavar="YYYY-MM-DD",
                   help="explicit window start (local date, inclusive)")
    w.add_argument("--to", dest="date_to", metavar="YYYY-MM-DD",
                   help="explicit window end (local date, EXCLUSIVE)")
    w.add_argument("--tz-offset", type=float, default=DEFAULT_TZ_OFFSET_HOURS,
                   help="local UTC offset in hours used to convert the window "
                        "(default: %+0.1f, Jordan permanent UTC+3)" % DEFAULT_TZ_OFFSET_HOURS)

    o = p.add_argument_group("output")
    o.add_argument("--json", action="store_true",
                   help="emit machine-readable JSON on stdout instead of the report")
    o.add_argument("--only", default="",
                   help="comma-separated subset of sections to run: %s"
                        % ",".join(ALL_SECTIONS))
    o.add_argument("--verbose", action="store_true", help="progress notes on stderr")

    c = p.add_argument_group("connection")
    c.add_argument("--env-file", help="shell-style file supplying ODOO_URL/DB/LOGIN/API_KEY "
                                      "for any variable absent from the environment")

    t = p.add_argument_group("tier calibration")
    t.add_argument("--tier-basis", choices=("active", "all"), default="active",
                   help="calibrate thresholds over ACTIVE members (>=1 order in the "
                        "window) or over ALL card holders (inactives at 0 JOD). "
                        "Default: active")
    t.add_argument("--round-to", type=float, default=5.0,
                   help="round candidate thresholds to this JOD step (default: 5)")

    v = p.add_argument_group("point value / liability")
    v.add_argument("--point-value", type=float, default=0.01,
                   help="JOD per point, used ONLY if the value cannot be derived "
                        "from loyalty.reward (default: 0.01 = 1 qirsh, the owner's "
                        "unverified verbal claim)")
    v.add_argument("--breakage-scenarios", type=float, nargs="+",
                   default=[0.3, 0.5, 0.7, 1.0],
                   help="shares of outstanding points assumed eventually redeemed "
                        "(default: 0.3 0.5 0.7 1.0)")

    k = p.add_argument_group("substitution factor k")
    k.add_argument("--trailing-visits", type=int, default=8,
                   help="visits in the trailing comparison window (default: 8, as "
                        "specified in the proposal)")
    k.add_argument("--min-prior", type=int, default=4,
                   help="minimum prior visits required to use a redemption "
                        "(default: 4). Raising it cuts bias and sample size together")
    k.add_argument("--exclude-prior-redemptions", dest="exclude_prior_redemptions",
                   action="store_true", default=True,
                   help="drop prior visits that themselves contained a reward (default on)")
    k.add_argument("--include-prior-redemptions", dest="exclude_prior_redemptions",
                   action="store_false",
                   help="keep them (biases k downward; see the bias notes)")
    k.add_argument("--lookback-days", type=int, default=180,
                   help="how far before the window to look for prior visits (default: 180)")
    k.add_argument("--max-k-redemptions", type=int, default=1500,
                   help="cap on redemptions analysed; a seeded uniform subsample is "
                        "taken above it (default: 1500, 0 = no cap)")
    k.add_argument("--k-min-sample", type=int, default=100,
                   help="below this many usable redemptions k is refused, not "
                        "reported (default: 100)")
    k.add_argument("--min-reward-value", type=float, default=0.05,
                   help="ignore rewards worth less than this in JOD; their ratio "
                        "denominator is too small to be meaningful (default: 0.05)")
    k.add_argument("--bootstrap", type=int, default=2000,
                   help="bootstrap resamples for the k CI (default: 2000)")
    k.add_argument("--k-examples", type=int, default=0,
                   help="include N worked per-redemption rows in the JSON for audit")

    f = p.add_argument_group("time to first reward / mix")
    f.add_argument("--history-days", type=int, default=365,
                   help="history window for the visits-to-first-reward walk (default: 365)")
    f.add_argument("--max-ttfr-members", type=int, default=2000,
                   help="seeded uniform sample size of members (default: 2000)")
    f.add_argument("--truncation-margin-days", type=int, default=14,
                   help="a member whose first observed visit falls within this many "
                        "days of the history start is flagged as possibly "
                        "left-truncated (default: 14)")
    f.add_argument("--category-map", help="JSON file overriding the redemption-mix "
                                          "category keyword map")

    x = p.add_argument_group("tuning")
    x.add_argument("--batch", type=int, default=5000, help="search_read page size")
    x.add_argument("--partner-chunk", type=int, default=500,
                   help="partner ids per domain chunk (default: 500)")
    x.add_argument("--order-chunk", type=int, default=500,
                   help="order ids per domain chunk (default: 500)")
    x.add_argument("--seed", type=int, default=12345,
                   help="RNG seed for every sample and bootstrap, so runs are "
                        "reproducible (default: 12345)")
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    wanted = [s.strip() for s in args.only.split(",") if s.strip()] or list(ALL_SECTIONS)
    bad = [s for s in wanted if s not in ALL_SECTIONS]
    if bad:
        die("unknown section(s) %s; valid: %s" % (", ".join(bad), ", ".join(ALL_SECTIONS)))

    # Resolve the window BEFORE opening a connection, so a bad --from/--to is
    # reported instantly instead of after an authentication round-trip.
    u_start, u_end, l_start, l_end, days = resolve_window(args)
    args.days = days

    env = load_env(args.env_file)
    odoo = Odoo(env["ODOO_URL"], env["ODOO_DB"], env["ODOO_LOGIN"], env["ODOO_API_KEY"],
                verbose=args.verbose)

    caps = detect_capabilities(odoo)
    programs = read_programs(odoo, caps)
    pv = derive_point_value(odoo, programs if programs.get("status") == "OK" else {},
                            args.point_value)
    members, card_meta = member_partner_ids(odoo, caps)

    report = {
        "meta": {
            "script": os.path.basename(__file__),
            "script_version": SCRIPT_VERSION,
            "generated_utc": dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "url": env["ODOO_URL"], "db": env["ODOO_DB"],
            "window_local_from": l_start, "window_local_to": l_end,
            "window_utc_from": u_start, "window_utc_to": u_end,
            "window_days": days, "tz_offset_hours": args.tz_offset,
            "order_states": SALE_STATES,
            "read_only": True,
            "sections_requested": wanted,
            "rpc_calls": 0,
        },
        "capabilities": caps,
        "programs": programs,
        "point_value": pv,
        "cards": card_meta,
        "sections": {},
    }
    point_value = pv.get("value")

    runners = {
        "coverage": lambda: section_coverage(odoo, caps, u_start, u_end, members, args),
        "spend": lambda: section_spend(odoo, caps, u_start, u_end, members, args),
        "redemption": lambda: section_redemption(odoo, caps, u_start, u_end,
                                                 card_meta, point_value, args),
        "liability": lambda: section_liability(odoo, u_start, u_end, card_meta,
                                               point_value, pv, args),
        "k": lambda: section_k(odoo, caps, u_start, u_end, args),
        "ttfr": lambda: section_time_to_first_reward(odoo, caps, u_start, u_end,
                                                     members, args),
        "mix": lambda: section_mix(odoo, caps, u_start, u_end, args),
    }
    for name in ALL_SECTIONS:
        if name not in wanted:
            continue
        if args.verbose:
            warn("running section: %s" % name)
        try:
            report["sections"][name] = runners[name]()
        except ReadOnlyViolation as exc:
            # Should be impossible; if it ever fires it is a bug worth shouting about.
            die("READ-ONLY GUARD TRIPPED in section %s: %s" % (name, exc))
        except xmlrpc.client.Fault as exc:
            report["sections"][name] = {
                "status": "ERROR",
                "reason": "Odoo refused a query: %s" % str(exc).splitlines()[0][:300],
                "hint": "usually a missing model/field or an access-rights limit on "
                        "the API user; the other sections are unaffected"}
        except Exception as exc:
            report["sections"][name] = {
                "status": "ERROR",
                "reason": "%s: %s" % (type(exc).__name__, exc),
                "hint": "unexpected; re-run with --verbose and --only %s" % name}

    report["meta"]["rpc_calls"] = odoo.calls
    if args.json:
        json.dump(report, sys.stdout, ensure_ascii=False, indent=2, default=str)
        sys.stdout.write("\n")
    else:
        render(report)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except KeyboardInterrupt:
        print("\ninterrupted -- nothing was written, this script is read-only",
              file=sys.stderr)
        sys.exit(130)
