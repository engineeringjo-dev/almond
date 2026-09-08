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
                         partner who holds a POINTS-programme loyalty.card,
                         PER BRANCH. Every coverage assumption hangs on this.
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
  7. REDEMPTION MIX    — reward lines resolved through loyalty.reward to the
                        REAL rewarded product, bucketed by product category,
                        with the measured COGS that feeds cost-per-reward-JOD.

THE THREE THINGS THAT MAKE THIS SCRIPT DIFFERENT FROM A NAIVE ONE
  a) loyalty.card / loyalty.reward / loyalty.history are SHARED tables. Coupons,
     promotions, gift cards and eWallets all live in them. Every query here is
     restricted to the POINTS programme (program_type == 'loyalty') by explicit
     program id. Gift-card and eWallet balances are CURRENCY, not points, and
     are reported as their own liability line -- never folded into a point total.
  b) A POS reward is posted by Odoo as a NEGATIVE extra line; the rewarded
     product stays in the basket at FULL price. The k estimator uses the order's
     real cash total (all lines, reward lines included). Using only the
     non-reward lines makes measured k = true k - 1. See K_ESTIMATOR_DOC.
  c) A reward line's product_id is the reward's own technical discount product
     (a service with list_price 0), NOT the rewarded item. Section 7 resolves
     the real product through pos.order.line.reward_id -> loyalty.reward.

HARD RULES OBEYED HERE
  - READ-ONLY. The RPC wrapper hard-blocks every method that is not on a
    read whitelist; there is no code path that writes, and no production-write
    approval token is accepted or needed.
  - stdlib only (xmlrpc.client). No pip install. Runs anywhere with network
    access to the Odoo host -- it will NOT run from the dev container, whose
    egress proxy blocks *.odoo.com.
  - Credentials from the environment (or --env-file), never hardcoded.
  - Every RPC carries a socket timeout (--timeout) so a stalled connection
    fails and is retried instead of hanging the run for ever, and every section
    announces itself on stderr so a slow run is distinguishable from a hung one.
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
  PARTIAL    - a row cap (--max-rows) was hit; the number is a lower bound and
               must not be quoted as EXACT.

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
                                                        # (the rest print NOT RUN,
                                                        #  never a false OPEN)

EXIT CODES
  0 report produced (possibly with UNAVAILABLE sections)
  2 could not connect / authenticate / no usable POS data  (nothing printed as fact)
"""

from __future__ import annotations

import argparse
import datetime as dt
import http.client
import json
import math
import os
import random
import sys
import time
import xmlrpc.client
from collections import defaultdict

SCRIPT_VERSION = "1.1.0"

# POS order states that represent real, settled sales. 'draft' and 'cancel' are
# excluded. Refunds are negative-amount_total orders in these same states: they
# stay in the VALUE sums (so value is net) but they are dropped from every
# VISIT SEQUENCE and from every basket comparison, because a refund is not a
# visit and its negative basket destroys the k estimator. Their count and value
# are reported separately in sections 1, 2, 5, 6 and 7.
SALE_STATES = ["paid", "done", "invoiced"]

# The only program_type whose loyalty.card.points are POINTS. Every other type
# shares the same tables: 'coupons', 'promotion', 'promo_code', 'buy_x_get_y'
# and 'next_order_coupons' issue cards that are not memberships, and
# 'gift_card' / 'ewallet' hold a CURRENCY balance in the same `points` column.
POINTS_PROGRAM_TYPE = "loyalty"
PAYMENT_PROGRAM_TYPES = ("gift_card", "ewallet")

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


def note(msg: str) -> None:
    """Unconditional progress note on stderr. NOT gated on --verbose: a full run
    issues thousands of rows over a home link and prints nothing until the end,
    so without this a stall and slow progress look identical."""
    print("  . %s" % msg, file=sys.stderr)


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
    `sorted_vals` MUST already be sorted ascending. p is 0..100.

    NOTE: this is used for DISTRIBUTIONS only. It is deliberately NOT used to
    reconcile disagreeing CONFIGURATION values (see derive_point_value): an
    interpolated median of two configured rates is a rate no reward uses."""
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


def m2o_id(v):
    """id out of an Odoo many2one value ([id, name] or False)."""
    if isinstance(v, (list, tuple)) and v:
        return v[0]
    return v if v else None


def m2o_name(v, fallback=""):
    if isinstance(v, (list, tuple)) and len(v) > 1:
        return v[1]
    return fallback


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


class _TimeoutTransport(xmlrpc.client.Transport):
    """http transport that puts a real socket timeout on every connection.

    Without this the socket timeout is None (block for ever): a server that
    accepts the request and then stops sending raises neither ProtocolError nor
    OSError, so the retry loop below can never fire for the failure mode that
    actually happens on a laptop over a home link."""

    def __init__(self, timeout, *a, **kw):
        xmlrpc.client.Transport.__init__(self, *a, **kw)
        self._timeout = timeout

    def make_connection(self, host):
        conn = xmlrpc.client.Transport.make_connection(self, host)
        conn.timeout = self._timeout
        return conn


class _TimeoutSafeTransport(xmlrpc.client.SafeTransport):
    """Same, for https (which is what the hosted Odoo uses)."""

    def __init__(self, timeout, *a, **kw):
        xmlrpc.client.SafeTransport.__init__(self, *a, **kw)
        self._timeout = timeout

    def make_connection(self, host):
        conn = xmlrpc.client.SafeTransport.make_connection(self, host)
        conn.timeout = self._timeout
        return conn


def _proxy(url, timeout):
    tr = (_TimeoutSafeTransport(timeout) if url.lower().startswith("https")
          else _TimeoutTransport(timeout))
    return xmlrpc.client.ServerProxy(url, allow_none=True, transport=tr)


class Odoo:
    """Minimal Odoo external-API client, stdlib only.

    Every call goes through _call(), which refuses any method outside
    READ_ONLY_METHODS. That guard is the enforcement point for the
    'production is read-only' rule -- there is deliberately no escape hatch.

    Every call also carries context active_test=False. loyalty.program,
    loyalty.rule, loyalty.reward, loyalty.card and product.product all define
    `active`, and the default active_test=True would silently hide an archived
    predecessor programme whose cards still hold points -- understating the
    liability by an unstated amount, and making the report's `active` column
    structurally incapable of ever printing False. Sections that must not mix
    the two split active from archived themselves."""

    def __init__(self, url, db, login, api_key, timeout=120.0,
                 timeout_retries=4, verbose=False):
        self.url = url.rstrip("/")
        self.db = db
        self.key = api_key
        self.retries = timeout_retries
        self.timeout = timeout
        self.verbose = verbose
        self.calls = 0
        self.ctx = {"active_test": False}   # see archived programs/rewards/cards too
        # winning grouping RPC per model, so the dead probes are paid once, not
        # once per call (a full run makes hundreds of grouped calls).
        self._group_method = {}
        note("connecting to %s (timeout %.0fs) ..." % (self.url, timeout))
        try:
            common = _proxy(self.url + "/xmlrpc/2/common", timeout)
            self.uid = common.authenticate(db, login, api_key, {})
        except Exception as exc:  # network, DNS, TLS, proxy, timeout
            die("cannot reach Odoo at %s (%s: %s)\n"
                "       If you are running inside the dev container this is expected:\n"
                "       the egress proxy blocks *.odoo.com. Run this script from a host\n"
                "       that can reach the Odoo instance."
                % (self.url, type(exc).__name__, exc))
        if not self.uid:
            die("authentication failed for db=%s (check ODOO_LOGIN / ODOO_API_KEY)" % db)
        self.models = _proxy(self.url + "/xmlrpc/2/object", timeout)
        note("authenticated as uid %s on db %s" % (self.uid, db))

    def _call(self, model, method, args, kwargs=None):
        if method not in READ_ONLY_METHODS:
            raise ReadOnlyViolation(
                "blocked non-read method %r on %s -- this script is read-only" % (method, model))
        kwargs = dict(kwargs or {})
        kwargs.setdefault("context", dict(self.ctx))
        last = None
        for attempt in range(self.retries):
            try:
                self.calls += 1
                return self.models.execute_kw(self.db, self.uid, self.key,
                                              model, method, args, kwargs)
            except xmlrpc.client.Fault:
                # A Fault is a server-side answer (missing model/field/method).
                # It is meaningful; do not retry it, let the caller downgrade.
                raise
            except (xmlrpc.client.ProtocolError, OSError,
                    http.client.HTTPException) as exc:
                # socket.timeout IS an OSError, and now that a timeout is set it
                # can actually be raised -- a stalled RPC becomes a retry.
                last = exc
                if attempt < self.retries - 1:
                    warn("%s.%s failed (%s: %s); retrying %d/%d"
                         % (model, method, type(exc).__name__, exc,
                            attempt + 2, self.retries))
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
        that the result is truncated (a truncated sum is not an exact sum).
        Every call site passes a cap (--max-rows): an unbounded client-side fold
        over pos.order or loyalty.history would materialise the whole table."""
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
                warn("%s: row cap %d hit; result is TRUNCATED" % (label or model, cap))
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

    def group_sum(self, model, domain, groupbys, sum_field, cap=0, page=10000):
        """Return ([(keys_tuple, count, sum_of_sum_field), ...], rpc_name, truncated).

        `groupbys` is a LIST of field names; keys_tuple has one entry per
        groupby, raw (an (id, name) pair for many2one, else the scalar). Two
        groupbys is how per-branch member coverage is obtained in ONE query
        instead of one query per 500-partner chunk.

        Odoo renamed/deprecated the public grouping RPC between 17 and 19, so
        three implementations are tried in order and the first that answers is
        used: formatted_read_group (18/19), read_group (<=18), then a Python
        fold over search_read. The WINNER IS MEMOISED PER MODEL, so a build
        where the first is unavailable pays one wasted round-trip, not one per
        call. A reviewer should check this fallback ordering first if any
        aggregate looks wrong."""
        groupbys = list(groupbys)
        agg = "%s:sum" % sum_field
        chosen = self._group_method.get(model)

        def _fmt():
            rows = []
            off = 0
            while True:
                got = self._call(model, "formatted_read_group",
                                 [domain, groupbys, ["__count", agg]],
                                 {"offset": off, "limit": page}) or []
                rows.extend(got)
                if len(got) < page:
                    return rows, False
                off += page
                if cap and len(rows) >= cap:
                    warn("%s: group cap %d hit; grouped result is TRUNCATED" % (model, cap))
                    return rows, True

        def _legacy():
            rows = []
            off = 0
            while True:
                got = self._call(model, "read_group",
                                 [domain, [sum_field], groupbys],
                                 {"lazy": False, "offset": off, "limit": page}) or []
                rows.extend(got)
                if len(got) < page:
                    return rows, False
                off += page
                if cap and len(rows) >= cap:
                    warn("%s: group cap %d hit; grouped result is TRUNCATED" % (model, cap))
                    return rows, True

        if chosen in (None, "formatted_read_group"):
            try:
                rows, trunc = _fmt()
                self._group_method[model] = "formatted_read_group"
                return ([(tuple(r.get(g) for g in groupbys),
                          int(r.get("__count") or 0),
                          float(r.get(agg) or 0.0)) for r in rows],
                        "formatted_read_group", trunc)
            except xmlrpc.client.Fault:
                pass
            except Exception as exc:
                warn("formatted_read_group failed on %s: %s" % (model, exc))
        if chosen in (None, "formatted_read_group", "read_group"):
            try:
                rows, trunc = _legacy()
                self._group_method[model] = "read_group"
                return ([(tuple(r.get(g) for g in groupbys),
                          int(r.get("__count") or 0),
                          float(r.get(sum_field) or 0.0)) for r in rows],
                        "read_group", trunc)
            except xmlrpc.client.Fault:
                pass
            except Exception as exc:
                warn("read_group failed on %s: %s" % (model, exc))
        # 3) universal fallback -- correct, but it pulls every row, so it is
        #    capped and the caller downgrades the section to PARTIAL.
        if self._group_method.get(model) != "client-side fold":
            warn("no grouping RPC available on %s; folding rows client-side "
                 "(slower, same result, capped at %s rows)" % (model, cap or "no cap"))
        self._group_method[model] = "client-side fold"
        rows, trunc = self.search_read_all(model, domain, groupbys + [sum_field],
                                           cap=cap, label="%s fold" % model)
        acc = defaultdict(lambda: [0, 0.0])
        keys = {}
        for r in rows:
            raw = tuple(r.get(g) for g in groupbys)
            k = tuple(m2o_id(v) if isinstance(v, (list, tuple)) else (v if v else False)
                      for v in raw)
            keys[k] = raw
            acc[k][0] += 1
            acc[k][1] += float(r.get(sum_field) or 0.0)
        return ([(keys[k], c, s) for k, (c, s) in acc.items()],
                "client-side fold", trunc)


def total_sum(odoo, model, domain, fields, cap=0):
    """Ungrouped count + sums, with the same memoised 3-way RPC fallback as
    group_sum. Returns (count, {field: sum}, rpc_name, truncated)."""
    # group_sum with an empty groupby list is not universally supported, so the
    # ungrouped case is done directly here, sharing group_sum's per-model memo.
    chosen = odoo._group_method.get(model)
    aggs = ["__count"] + ["%s:sum" % f for f in fields]
    if chosen in (None, "formatted_read_group"):
        try:
            rows = odoo._call(model, "formatted_read_group", [domain, [], aggs]) or []
            odoo._group_method[model] = "formatted_read_group"
            if rows:
                r = rows[0]
                return (int(r.get("__count") or 0),
                        {f: float(r.get("%s:sum" % f) or 0.0) for f in fields},
                        "formatted_read_group", False)
            return 0, {f: 0.0 for f in fields}, "formatted_read_group", False
        except xmlrpc.client.Fault:
            pass
        except Exception as exc:
            warn("formatted_read_group(%s) failed: %s" % (model, exc))
    if chosen in (None, "formatted_read_group", "read_group"):
        try:
            rows = odoo._call(model, "read_group", [domain, list(fields), []],
                              {"lazy": False}) or []
            odoo._group_method[model] = "read_group"
            if rows:
                r = rows[0]
                return (int(r.get("__count") or 0),
                        {f: float(r.get(f) or 0.0) for f in fields}, "read_group", False)
            return 0, {f: 0.0 for f in fields}, "read_group", False
        except xmlrpc.client.Fault:
            pass
        except Exception as exc:
            warn("read_group(%s) failed: %s" % (model, exc))
    odoo._group_method[model] = "client-side fold"
    rows, trunc = odoo.search_read_all(model, domain, list(fields), cap=cap,
                                        label="%s fold" % model)
    return (len(rows), {f: sum(float(r.get(f) or 0.0) for r in rows) for f in fields},
            "client-side fold", trunc)


# --------------------------------------------------------------------------
# window, capabilities, configuration read off the database
# --------------------------------------------------------------------------

def resolve_window(args):
    """Return (utc_start_str, utc_end_str, local_start, local_end, days).

    The window is expressed by the user in LOCAL (Amman) calendar dates but
    Odoo stores date_order in UTC, so the boundaries are shifted by
    --tz-offset. End is EXCLUSIVE. Getting this wrong silently moves ~3 hours
    of trade (a whole evening peak) between windows, so the shift is printed
    in the report header.

    BOTH forms are validated. An empty window (--days 0, --days -30) used to
    run to completion and print 'no data', which reads as a thin database
    rather than as a bad argument."""
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
        if args.days < 1:
            die("--days must be at least 1 (got %d); a zero or negative window "
                "matches no orders at all and would print as 'no data'." % args.days)
        now_local = dt.datetime.utcnow() + off
        l_end = dt.datetime(now_local.year, now_local.month, now_local.day)
        l_start = l_end - dt.timedelta(days=args.days)
    days = (l_end - l_start).total_seconds() / 86400.0
    u_start = (l_start - off).strftime("%Y-%m-%d %H:%M:%S")
    u_end = (l_end - off).strftime("%Y-%m-%d %H:%M:%S")
    if not u_start < u_end:
        die("the resolved window is empty (%s -> %s); nothing can be measured"
            % (u_start, u_end))
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
    the numbers describe.

    ALL program types are read (the tables are shared), and every row is tagged
    with its program_type so downstream code can restrict itself to the points
    programme instead of pooling a gift card in with a loyalty reward. The
    client context carries active_test=False, so archived rows appear too and
    the `active` column can actually print False."""
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
    ptype = {p["id"]: p.get("program_type") for p in out["programs"]}
    pactive = {p["id"]: bool(p.get("active", True)) for p in out["programs"]}
    pname = {p["id"]: p.get("name") for p in out["programs"]}
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
                          "reward_product_ids", "active")
              if f in wfields or f == "id"]
    try:
        out["rewards"] = odoo.search_read("loyalty.reward", [], want_w)
    except Exception as exc:
        out["rewards_error"] = str(exc)
    # tag every reward/rule with the program_type + active flag of its program
    for coll in ("rewards", "rules"):
        for r in out.get(coll) or []:
            pid = m2o_id(r.get("program_id"))
            r["_program_type"] = ptype.get(pid)
            r["_program_active"] = pactive.get(pid, True)
            r["_program_name"] = pname.get(pid)
    out["program_types_present"] = sorted(
        {p.get("program_type") for p in out["programs"] if p.get("program_type")})
    out["archived_programs"] = [p for p in out["programs"] if not p.get("active", True)]
    return out


def resolve_programs(programs, args):
    """Decide WHICH programs the measurement is about.

    Everything in this script that touches loyalty.card, loyalty.history or a
    POS reward line is restricted to these ids. loyalty.card is the backing
    table for EVERY program_type -- coupons, promotions, promo codes,
    buy_x_get_y, next_order_coupons, gift cards and eWallets all issue rows in
    it -- and with a coupons programme running at Almond's invoice volume the
    coupon rows outnumber the memberships outright. An unfiltered read would
    make 'member' mostly not a member, and would add gift-card CURRENCY
    balances to a point total.

    Refuses rather than guesses: if no points programme can be identified,
    every section that needs one prints UNAVAILABLE."""
    res = {"status": "UNAVAILABLE", "reason": None, "points_program_ids": [],
           "points_programs": [], "payment_program_ids": [], "payment_programs": [],
           "other_program_ids": []}
    if (programs or {}).get("status") != "OK":
        res["reason"] = (programs or {}).get("reason") or "loyalty configuration not readable"
        return res
    rows = programs.get("programs") or []
    if not rows:
        res["reason"] = "loyalty.program is empty; there is no programme to measure"
        return res
    pts = [p for p in rows if p.get("program_type") == POINTS_PROGRAM_TYPE]
    active_pts = [p for p in pts if p.get("active", True)]
    res["payment_programs"] = [p for p in rows if p.get("program_type") in PAYMENT_PROGRAM_TYPES]
    res["payment_program_ids"] = [p["id"] for p in res["payment_programs"]]
    res["other_program_ids"] = [p["id"] for p in rows
                                if p.get("program_type") not in
                                (POINTS_PROGRAM_TYPE,) + PAYMENT_PROGRAM_TYPES]
    if args.program_ids:
        chosen = [p for p in rows if p["id"] in set(args.program_ids)]
        bad = [i for i in args.program_ids if i not in {p["id"] for p in rows}]
        if bad:
            die("--program-id %s does not exist in loyalty.program" % bad)
        wrong = [p for p in chosen if p.get("program_type") != POINTS_PROGRAM_TYPE]
        if wrong:
            die("--program-id names a non-points programme (%s); this script measures "
                "a points programme, and mixing types is exactly the defect it guards "
                "against" % ", ".join("%s=%s" % (p["id"], p.get("program_type")) for p in wrong))
        res.update({"status": "OK", "points_programs": chosen,
                    "points_program_ids": [p["id"] for p in chosen],
                    "selection": "explicit --program-id"})
        return res
    if not pts:
        res["reason"] = ("no loyalty.program of program_type='loyalty' exists. The "
                         "programs present are: %s. There is no points programme to "
                         "measure -- do NOT read the coupon/gift-card tables as if "
                         "there were." % (", ".join(programs.get("program_types_present") or []) or "none"))
        return res
    use = active_pts or pts
    res.update({"status": "OK", "points_programs": use,
                "points_program_ids": [p["id"] for p in use],
                "selection": ("all ACTIVE program_type='loyalty' programs"
                              if active_pts else
                              "no ACTIVE points programme exists; using the ARCHIVED "
                              "one(s) so their outstanding balances are not hidden")})
    if len(use) > 1:
        res["multi_program_warning"] = (
            "%d points programmes are in scope. Each has its OWN point value and its "
            "own liability; a single blended headline figure would be meaningless. "
            "Per-programme card and point counts are printed, and the point value is "
            "reported per programme. Narrow the run with --program-id <id>."
            % len(use))
    return res


def derive_point_value(odoo, programs, pctx, cli_value):
    """Determine JOD per point FROM THE DATABASE where possible.

    Odoo encodes it directly:
      discount_mode == 'per_point'  -> `discount` IS currency per point.
      discount_mode == 'per_order'  -> discount / required_points.
      reward_type  == 'product'     -> product list_price / required_points
                                       (an IMPLIED value, listed but not used
                                       for the headline because a free product
                                       is priced at retail, not at cost).

    TWO RULES, both learned the hard way:

    1. ONLY the points programme's rewards are considered. Odoo's stock
       gift-card and eWallet program templates each ship a reward of exactly
       the shape the per_point branch matches -- reward_type='discount',
       discount_mode='per_point', discount=1 -- because for those program types
       a 'point' IS a currency unit (portal_point_name is the currency symbol).
       Pooling one of those with the loyalty programme's 0.01 and taking a
       median produces 0.505 JOD/point: a 50x error that then multiplies
       straight into the gross liability, and makes the report 'REFUTE' an
       owner claim that is in fact true.

    2. DISTINCT values are reported, never a median. An interpolated median of
       two configured rates (0.01, 0.02 -> 0.015) is a rate no reward on the
       database actually uses. If the surviving rates disagree the point value
       is AMBIGUOUS: value is None, every JOD figure downstream prints
       UNAVAILABLE, and the disagreeing rows are listed so a human can settle
       it. That is the honest answer; a fabricated midpoint is not.

    The owner stated verbally "point = 1 qirsh = 0.01 JOD". That claim is
    VERIFIED or REFUTED here; it is never assumed."""
    res = {"cli_value": cli_value, "observations": [], "value": None,
           "basis": None, "exactness": None, "ambiguous": False,
           "distinct_per_point_jod": [], "payment_program_rewards": [],
           "scope": None, "matches_owner_claim_1_qirsh": None}
    all_rewards = (programs or {}).get("rewards") or []
    pts_ids = set((pctx or {}).get("points_program_ids") or [])

    # gift-card / eWallet rewards are kept, clearly labelled, and excluded
    for w in all_rewards:
        if w.get("_program_type") in PAYMENT_PROGRAM_TYPES:
            res["payment_program_rewards"].append({
                "reward_id": w.get("id"), "program": w.get("_program_name"),
                "program_type": w.get("_program_type"),
                "description": w.get("description"),
                "discount_mode": w.get("discount_mode"),
                "discount": w.get("discount"),
                "note": ("payment programme: its 'point' is a CURRENCY unit, not a "
                         "loyalty point. Excluded from the point value on purpose."),
            })

    if not pts_ids:
        res["value"] = None
        res["basis"] = ((pctx or {}).get("reason")
                        or "no points programme identified, so no reward can price a point")
        res["exactness"] = "UNAVAILABLE (no points programme)"
        res["scope"] = "none"
        return res

    rewards = [w for w in all_rewards if m2o_id(w.get("program_id")) in pts_ids]
    # Headline uses ACTIVE rewards only: an archived reward priced a point in a
    # programme that is no longer selling it.
    active_rewards = [w for w in rewards if w.get("active", True)]
    res["scope"] = ("rewards of loyalty.program id(s) %s, program_type='%s'"
                    % (sorted(pts_ids), POINTS_PROGRAM_TYPE))
    res["rewards_in_scope"] = len(rewards)
    res["archived_rewards_in_scope"] = len(rewards) - len(active_rewards)

    per_point = []          # [(value, reward_id, description)]
    prod_ids = []
    for w in rewards:
        rp = float(w.get("required_points") or 0.0)
        mode = w.get("discount_mode")
        disc = float(w.get("discount") or 0.0)
        is_active = bool(w.get("active", True))
        rec = {"reward_id": w.get("id"), "description": w.get("description"),
               "program": w.get("_program_name"), "reward_active": is_active,
               "reward_type": w.get("reward_type"), "discount_mode": mode,
               "discount": disc, "required_points": rp}
        if w.get("reward_type") == "discount" and mode == "per_point" and disc:
            rec["implied_jod_per_point"] = disc
            if is_active:
                per_point.append((disc, w.get("id"), w.get("description")))
        elif w.get("reward_type") == "discount" and mode == "per_order" and rp:
            rec["implied_jod_per_point"] = disc / rp
            if is_active:
                per_point.append((disc / rp, w.get("id"), w.get("description")))
        elif w.get("reward_type") == "discount" and mode == "percent":
            rec["implied_jod_per_point"] = None
            rec["note"] = "percent discount: point value depends on basket size, not derivable"
        elif w.get("reward_type") == "product" and rp:
            pid = m2o_id(w.get("reward_product_id"))
            if pid:
                prod_ids.append(pid)
                rec["reward_product_id"] = pid
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

    # distinct rates, each carrying the row that produced it
    by_val = defaultdict(list)
    for v, rid, desc in per_point:
        by_val[round(float(v), 6)].append({"reward_id": rid, "description": desc})
    res["distinct_per_point_jod"] = [
        {"jod_per_point": v, "from_rewards": src}
        for v, src in sorted(by_val.items())]

    if len(by_val) == 1:
        val = next(iter(by_val))
        res["value"] = val
        res["basis"] = ("every cash-discount reward of the points programme prices a "
                        "point at the same rate (%d reward row(s) in loyalty.reward)"
                        % len(per_point))
        res["exactness"] = "EXACT (read from loyalty.reward configuration)"
        res["spread"] = {"min": val, "max": val}
        res["matches_owner_claim_1_qirsh"] = abs(val - 0.01) < 1e-9
    elif len(by_val) > 1:
        vals = sorted(by_val)
        res["value"] = None
        res["ambiguous"] = True
        res["basis"] = ("%d DIFFERENT per-point rates are configured on the points "
                        "programme (%s JOD/point). No single value is correct, and a "
                        "median of them is a rate no reward uses, so none is emitted."
                        % (len(vals), ", ".join(money(v) for v in vals)))
        res["exactness"] = "AMBIGUOUS (configuration disagrees with itself)"
        res["spread"] = {"min": vals[0], "max": vals[-1]}
        res["matches_owner_claim_1_qirsh"] = None
        res["action_required"] = ("Settle which reward is the real redemption rate "
                                  "(or split the programme) before any JOD figure in "
                                  "sections 3 and 4 can be produced.")
    else:
        res["value"] = None
        res["basis"] = ("no ACTIVE cash-discount reward with a derivable per-point "
                        "value exists on the points programme, so configuration does "
                        "not price a point. --point-value (%s) is available as an "
                        "explicit override but is NOT applied silently."
                        % money(cli_value))
        res["exactness"] = "UNAVAILABLE (not measurable from configuration)"
        res["matches_owner_claim_1_qirsh"] = None
        if cli_value and cli_value > 0:
            res["cli_override_available"] = True
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


def member_partner_ids(odoo, caps, pctx, args):
    """Every res.partner holding a card of the POINTS programme = the members.

    'Member' is defined here as CARD HOLDER OF THE POINTS PROGRAMME, not as
    'has ever earned'. That choice is stated in the report because it moves
    coverage: an auto-created card with zero activity still counts as a member.

    What it deliberately is NOT: a holder of any loyalty.card row. That table
    backs every program_type, so an unfiltered read counts everyone who was
    ever handed a coupon or a gift card as a member, and sums gift-card and
    eWallet CURRENCY balances into the point total.

    Gift-card / eWallet balances ARE read -- they are a real liability -- but
    they are returned as their own currency line and never added to points."""
    if not caps["has_loyalty"]:
        return None, {"status": "UNAVAILABLE",
                      "reason": "loyalty.card not readable"}
    if (pctx or {}).get("status") != "OK" or not pctx.get("points_program_ids"):
        return None, {"status": "UNAVAILABLE",
                      "reason": ("cannot identify the points programme, so 'member' "
                                 "cannot be defined: %s"
                                 % ((pctx or {}).get("reason") or "unknown"))}
    have = set(caps["loyalty_card_fields"])
    fields = [f for f in ("partner_id", "program_id", "points", "active") if f in have] \
        or ["partner_id"]
    points_available = "points" in have
    active_available = "active" in have

    dom = [("program_id", "in", list(pctx["points_program_ids"]))]
    note("reading loyalty.card for the points programme (program_id in %s) ..."
         % pctx["points_program_ids"])
    rows, truncated = odoo.search_read_all("loyalty.card", dom, fields, batch=args.batch,
                                           cap=args.max_rows, label="loyalty.card (points)")
    partners = set()
    total_points = 0.0
    archived_points = 0.0
    archived_cards = 0
    cards_with_partner = 0
    per_program = defaultdict(lambda: {"cards": 0, "points": 0.0, "partners": set()})
    for r in rows:
        pid = m2o_id(r.get("partner_id"))
        pts = float(r.get("points") or 0.0)
        total_points += pts
        is_active = bool(r.get("active", True)) if active_available else True
        if not is_active:
            archived_cards += 1
            archived_points += pts
        prog = r.get("program_id")
        pkey = (m2o_id(prog) or 0, m2o_name(prog, "(no program)"))
        per_program[pkey]["cards"] += 1
        per_program[pkey]["points"] += pts
        if pid:
            partners.add(pid)
            cards_with_partner += 1
            per_program[pkey]["partners"].add(pid)

    # payment programmes: a SEPARATE, CURRENCY-denominated liability
    pay = {"status": "SKIPPED", "programs": [], "balance_currency_total": None}
    if pctx.get("payment_program_ids"):
        try:
            prows, ptrunc = odoo.search_read_all(
                "loyalty.card", [("program_id", "in", list(pctx["payment_program_ids"]))],
                fields, batch=args.batch, cap=args.max_rows, label="loyalty.card (payment)")
            agg = defaultdict(lambda: {"cards": 0, "balance": 0.0})
            for r in prows:
                prog = r.get("program_id")
                k = (m2o_id(prog) or 0, m2o_name(prog, "(no program)"))
                agg[k]["cards"] += 1
                agg[k]["balance"] += float(r.get("points") or 0.0)
            pay = {
                "status": "OK", "truncated": ptrunc,
                "cards": len(prows),
                "balance_currency_total": sum(v["balance"] for v in agg.values()),
                "programs": [{"program_id": k[0], "program": k[1], "cards": v["cards"],
                              "balance_currency": v["balance"]}
                             for k, v in sorted(agg.items(), key=lambda kv: -kv[1]["balance"])],
                "note": ("gift_card / ewallet: loyalty.card.points holds a MONEY balance "
                         "for these program types (portal_point_name is the currency "
                         "symbol). This is a real liability in JOD at 1:1 -- it is NOT "
                         "multiplied by a point value, and it is NOT part of the point "
                         "totals above."),
            }
        except Exception as exc:
            pay = {"status": "ERROR", "reason": str(exc), "programs": [],
                   "balance_currency_total": None}

    meta = {
        "status": "OK",
        "scope": ("loyalty.card rows of program_id in %s (program_type='%s') ONLY"
                  % (pctx["points_program_ids"], POINTS_PROGRAM_TYPE)),
        "points_field_available": points_available,
        "cards_total": len(rows),
        "cards_with_partner": cards_with_partner,
        "cards_anonymous": len(rows) - cards_with_partner,
        "cards_archived": archived_cards if active_available else None,
        "distinct_member_partners": len(partners),
        # None, never 0.0, when the field does not exist -- a zero balance and an
        # unreadable balance are different facts and must not print the same.
        "outstanding_points_total": (total_points if points_available else None),
        "outstanding_points_on_archived_cards": (archived_points if
                                                 (points_available and active_available) else None),
        "outstanding_points_share_archived": ((archived_points / total_points)
                                              if (points_available and active_available
                                                  and total_points) else None),
        "truncated": truncated,
        "per_program": [{"program_id": k[0], "program": k[1], "cards": v["cards"],
                         "points": v["points"], "partners": len(v["partners"])}
                        for k, v in sorted(per_program.items(), key=lambda kv: -kv[1]["cards"])],
        "payment_programs": pay,
        "excluded_program_types_note": (
            "Coupon / promotion / promo-code / buy-x-get-y / next-order-coupon cards "
            "are NOT counted here. They are not memberships, and at Almond's invoice "
            "volume they would outnumber the real members."),
    }
    if truncated:
        meta["status"] = "PARTIAL"
        meta["reason"] = ("loyalty.card read hit the --max-rows cap (%d); the member "
                          "count and the point total are LOWER BOUNDS." % args.max_rows)
    return partners, meta


# --------------------------------------------------------------------------
# SECTION 1 -- MEMBER COVERAGE, per branch
# --------------------------------------------------------------------------

def section_coverage(odoo, caps, u_start, u_end, members, args):
    """QUESTION: of everything sold in the window, what share -- by ORDER COUNT
    and by VALUE -- carried a partner who holds a POINTS-programme loyalty
    card, per branch?

    METHOD (exact, no sampling), TWO grouped queries for the whole network:
      totals    = group(count, sum(amount_total)) by branch over pos.order
      by-partner= group(count, sum(amount_total)) by (branch, partner_id) over
                  the same domain restricted to partner_id != False. The member
                  share is that result intersected with the member set in
                  Python. An order has exactly one partner, so the partner
                  groups partition the identified orders exactly.

    This replaces the old one-grouped-RPC-per-500-partners loop, which cost
    hundreds of round-trips and scaled with the card table rather than with the
    order table.

    HOW TO READ IT: 'identified' minus 'member' is the walk-in-with-a-partner
    gap (invoiced companies, delivery partners) -- it is NOT loyalty reach.
    The member column is the only one the design may use."""
    key, key_desc, err = branch_labels(odoo, caps)
    out = {"exactness": "EXACT",
           "method": ("grouped aggregation over pos.order (state in %s) in the "
                      "window: one query by branch, one by (branch, partner_id) "
                      "intersected with the points-programme member set"
                      % SALE_STATES),
           "grouping_key": key, "grouping_desc": key_desc}
    if err:
        out["status"] = "UNAVAILABLE"
        out["reason"] = err
        return out
    if members is None:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("member set unavailable (see the card/programme block in the "
                         "header); coverage over an unfiltered card table would not be "
                         "coverage of the points programme")
        return out

    base = order_domain(u_start, u_end)
    tot_rows, rpc_used, trunc_a = odoo.group_sum("pos.order", base, [key],
                                                 "amount_total", cap=args.max_rows)
    out["grouping_rpc"] = rpc_used
    note("coverage: %d branch group(s); reading per-partner groups ..." % len(tot_rows))
    ident_rows, _, trunc_b = odoo.group_sum(
        "pos.order", base + [("partner_id", "!=", False)], [key, "partner_id"],
        "amount_total", cap=args.max_rows)

    # refunds: negative-amount_total orders. They stay in the value sums (value
    # is net) but they are NOT visits, so their count is reported separately.
    ref_n, ref_s, _, _ = total_sum(odoo, "pos.order",
                                   base + [("amount_total", "<", 0)],
                                   ["amount_total"], cap=args.max_rows)

    tc, tv, names = {}, {}, {}
    for keys, cnt, val in tot_rows:
        k = m2o_id(keys[0]) if isinstance(keys[0], (list, tuple)) else (keys[0] or 0)
        tc[k] = tc.get(k, 0) + cnt
        tv[k] = tv.get(k, 0.0) + val
        names.setdefault(k, m2o_name(keys[0], "(unassigned)" if not keys[0] else str(keys[0])))

    ic, iv = defaultdict(int), defaultdict(float)
    mem_count, mem_value = defaultdict(int), defaultdict(float)
    member_set = set(members)
    for keys, cnt, val in ident_rows:
        bkey, pkey = keys[0], keys[1]
        k = m2o_id(bkey) if isinstance(bkey, (list, tuple)) else (bkey or 0)
        names.setdefault(k, m2o_name(bkey, "(unassigned)" if not bkey else str(bkey)))
        ic[k] += cnt
        iv[k] += val
        pid = m2o_id(pkey) if isinstance(pkey, (list, tuple)) else pkey
        if pid and pid in member_set:
            mem_count[k] += cnt
            mem_value[k] += val
    out["partner_groups_read"] = len(ident_rows)

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
        "refunds": {"orders": ref_n, "value_jod": ref_s.get("amount_total", 0.0),
                    "share_of_orders": (ref_n / T_c) if T_c else None,
                    "note": ("negative-amount_total pos.order rows in the same states. "
                             "They are INSIDE the value sums (value is net) and inside "
                             "the order counts (a refund is a document, not a visit). "
                             "Sections 2, 5, 6 and 7 drop them from visit sequences.")},
        "branch_spread": {
            "min_coverage_by_count": min((b["coverage_by_count"] for b in branches
                                          if b["coverage_by_count"] is not None), default=None),
            "max_coverage_by_count": max((b["coverage_by_count"] for b in branches
                                          if b["coverage_by_count"] is not None), default=None),
        },
        "caveats": [
            "MEMBER = holds a card of the POINTS programme (program_type='loyalty'). "
            "Coupon, promotion and gift-card holders are excluded on purpose: they "
            "share the loyalty.card table but they are not memberships.",
            "A card auto-created at the till with no activity still counts, so this "
            "is an UPPER bound on engaged members.",
            "Coverage BY VALUE is the number the economics need; coverage BY COUNT is "
            "the number cashier behaviour drives. They differ whenever members buy "
            "bigger baskets -- if they do, quoting the count figure understates "
            "programme cost.",
            "Talabat / Careem volume (~23% of payment value per the brief) will appear "
            "here as either a single aggregator partner or as unidentified; check the "
            "identified-but-not-member column before treating it as walk-in.",
            "Refunds are negative-value orders included in the value sums, so value is "
            "NET. Count is gross (a refund counts as an order). Their count is printed "
            "above so 'orders' is never mistaken for 'visits'.",
            "If %s was used as the grouping key, rows are POS SHOPS not physical "
            "branches." % (key_desc or "?"),
        ],
    })
    if trunc_a or trunc_b:
        out["exactness"] = "PARTIAL (row cap hit)"
        out["truncated"] = True
        out["caveats"].insert(0, "The --max-rows cap (%d) was hit while grouping; every "
                                 "figure in this section is a LOWER BOUND and must not "
                                 "be quoted as EXACT. Raise --max-rows and re-run."
                                 % args.max_rows)
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

    METHOD (exact for the distribution): ONE grouped aggregation over pos.order
    by partner_id across the whole window, intersected with the member set in
    Python. One row per partner with >=1 order. Percentiles are the type-7
    (linear interpolation) definition so they are reproducible outside this
    script.

    TWO BASES ARE REPORTED and they are not interchangeable:
      ACTIVE  = members with >=1 order in the window.
      ALL     = every points-programme card holder, inactives entered at 0 JOD.
    Tier thresholds calibrated on ACTIVE describe the shape of the tier table a
    customer sees; calibrated on ALL they describe the share of the whole base.
    Quoting one and meaning the other is the most likely way to mis-set Gold."""
    out = {"exactness": "EXACT (distribution) / DERIVED (thresholds)",
           "method": ("per-member sum of pos.order.amount_total over the window "
                      "via ONE grouped aggregation on partner_id, intersected "
                      "with the points-programme member set; type-7 percentiles")}
    if members is None:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("member set unavailable; a distribution over an unfiltered "
                         "card table would describe coupon holders, not members")
        return out
    base = order_domain(u_start, u_end)
    note("spend: reading per-partner order groups ...")
    rows, rpc, trunc = odoo.group_sum("pos.order", base + [("partner_id", "!=", False)],
                                      ["partner_id"], "amount_total", cap=args.max_rows)
    out["grouping_rpc"] = rpc
    member_set = set(members)
    spend, visits = {}, {}
    for keys, cnt, val in rows:
        pid = m2o_id(keys[0]) if isinstance(keys[0], (list, tuple)) else keys[0]
        if not pid or pid not in member_set:
            continue
        spend[pid] = spend.get(pid, 0.0) + val
        visits[pid] = visits.get(pid, 0) + cnt

    # refunds among members, so 'visits' above is never read as 'trips to a shop'
    ref_rows, _, _ = odoo.group_sum(
        "pos.order", base + [("partner_id", "!=", False), ("amount_total", "<", 0)],
        ["partner_id"], "amount_total", cap=args.max_rows)
    ref_orders, ref_value, ref_members = 0, 0.0, 0
    for keys, cnt, val in ref_rows:
        pid = m2o_id(keys[0]) if isinstance(keys[0], (list, tuple)) else keys[0]
        if pid and pid in member_set:
            ref_orders += cnt
            ref_value += val
            ref_members += 1

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
    out["all_cardholders"] = describe(all_basis, "ALL points-programme card holders (inactives at 0 JOD)")
    out["visits"] = {
        "n": len(visits),
        "mean_visits": mean(visits.values()) if visits else None,
        "p50_visits": pctl(sorted(visits.values()), 50) if visits else None,
        "p90_visits": pctl(sorted(visits.values()), 90) if visits else None,
        "note": ("'visits' counts pos.order documents, refunds included. %d refund "
                 "document(s) worth %s JOD across %d member(s) are inside these counts."
                 % (ref_orders, money(ref_value), ref_members)),
    }
    out["member_refunds"] = {"orders": ref_orders, "value_jod": ref_value,
                             "members_with_a_refund": ref_members}
    out["inactive_cardholders"] = n_all - n_active
    out["inactive_share"] = ((n_all - n_active) / n_all) if n_all else None

    basis_vals = active if args.tier_basis == "active" else all_basis
    out["tier_basis_used"] = args.tier_basis
    out["tier_calibration"] = calibrate_tiers(basis_vals, args)
    out["proposed_thresholds_scored"] = score_thresholds(basis_vals, PROPOSED_THRESHOLDS)
    out["caveats"] = [
        "The population is POINTS-programme card holders only. Scoring tier "
        "thresholds against a population inflated with coupon or gift-card holders "
        "would push every threshold down and make Gold look harder than it is.",
        "Spend here is pos.order.amount_total (tax-inclusive gross). If tiers are "
        "meant to run on net-of-tax spend every threshold shifts by the tax rate -- "
        "and the tax rate itself is unresolved in the brief (8% vs 16%).",
        "Only POS spend is counted. Talabat/Careem and any non-POS channel are "
        "absent, so a customer's true spend may exceed what is measured here.",
        "Refund documents are inside both the spend sums (netting them down) and the "
        "visit counts. member_refunds prints how many there are.",
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
    if trunc:
        out["exactness"] = "PARTIAL (row cap hit)"
        out["truncated"] = True
        out["caveats"].insert(0, "The --max-rows cap (%d) was hit while grouping by "
                                 "partner; the distribution is INCOMPLETE and the "
                                 "thresholds derived from it are not usable. Raise "
                                 "--max-rows and re-run." % args.max_rows)
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

def section_redemption(odoo, caps, u_start, u_end, pctx, card_meta, point_value, pv, args):
    """QUESTION: what fraction of issued points is actually being redeemed, and
    how many points are sitting outstanding?

    METHOD: loyalty.history carries one row per point movement with `issued`
    and `used` (both positive floats). Redemption rate = sum(used)/sum(issued)
    over rows CREATED in the window, RESTRICTED to cards of the points
    programme. That restriction is not optional: loyalty.history is described
    in Odoo as "History for Loyalty cards and Ewallets", so an unfiltered sum
    counts a gift-card top-up as point issuance and a gift-card spend as a
    redemption, in currency units, inside a point ratio.

    HOW TO READ IT: this is a FLOW ratio over a window, not a cohort ratio.
    Points redeemed in the window were largely issued BEFORE it, so in a
    growing programme this ratio understates the eventual redemption rate of a
    cohort, and in a shrinking one it overstates it. The cohort number needs a
    per-card earn-to-burn trace, which is out of scope for a Phase-0 gate --
    use this as a bound and say so."""
    out = {"exactness": "EXACT (sums) / ESTIMATE (as a cohort rate)",
           "method": "sum(loyalty.history.used) / sum(loyalty.history.issued) "
                     "over rows with create_date inside the window, restricted "
                     "to cards of the points programme"}
    if not caps["has_loyalty_history"]:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("loyalty.history is not readable on this database. "
                         "Without it no redemption rate can be measured; the POS "
                         "reward-line count in the redemption-mix section is the "
                         "only remaining redemption signal.")
        return out
    if (pctx or {}).get("status") != "OK":
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("no points programme identified (%s), so the ledger cannot be "
                         "restricted to point movements"
                         % ((pctx or {}).get("reason") or "unknown"))
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
    if "card_id" not in lf:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("loyalty.history has no card_id, so its rows cannot be tied "
                         "to a programme. An unfiltered sum would blend gift-card and "
                         "eWallet money movements into the point ledger; this script "
                         "refuses to print that ratio rather than print a wrong one.")
        return out

    # card_id.program_id is a fully-stored path (loyalty.card.program_id is a
    # real many2one), so this domain does not depend on a related field being
    # searchable.
    prog_dom = [("card_id.program_id", "in", list(pctx["points_program_ids"]))]
    dom = prog_dom + [(date_field, ">=", u_start), (date_field, "<", u_end)]
    note("redemption: summing loyalty.history for the points programme ...")
    n, sums, rpc, tr_w = total_sum(odoo, "loyalty.history", dom, ["issued", "used"],
                                   cap=args.max_rows)
    issued = sums.get("issued", 0.0)
    used = sums.get("used", 0.0)
    n_all, sums_all, _, tr_l = total_sum(odoo, "loyalty.history", prog_dom,
                                         ["issued", "used"], cap=args.max_rows)
    outstanding_pts = (card_meta or {}).get("outstanding_points_total")
    pay = ((card_meta or {}).get("payment_programs") or {})
    out.update({
        "status": "OK",
        "rpc_used": rpc,
        "scope": "loyalty.history rows whose card belongs to program_id in %s"
                 % pctx["points_program_ids"],
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
                        "source": ("sum of loyalty.card.points over cards of the points "
                                   "programme only")},
        "payment_program_balances_currency": pay.get("balance_currency_total"),
        "caveats": [
            "Flow ratio, not a cohort ratio (see method). Compare the window rate "
            "against the lifetime rate printed beside it: a large gap means the "
            "programme is still filling up and the window rate is the low bound.",
            "Gift-card and eWallet movements are EXCLUDED. Their outstanding balance "
            "is printed as a separate currency line -- it is a real liability, but it "
            "is money, not points, and must never be multiplied by a point value.",
            "Expired points may be recorded as neither issued nor used depending on "
            "how expiry is implemented; if lifetime issued - used differs materially "
            "from the outstanding card balance, expiry/adjustment rows are missing "
            "from this ratio. That reconciliation is printed below.",
            "Points -> JOD uses the point value stated in the header. If that value "
            "is AMBIGUOUS or an ASSUMPTION rather than read from loyalty.reward, the "
            "JOD columns here print n/a rather than a number built on a guess.",
        ],
    })
    if point_value is None:
        out["caveats"].insert(0, "POINT VALUE UNAVAILABLE (%s): the point columns are "
                                 "exact, the JOD columns are not printed."
                                 % (pv or {}).get("exactness"))
    if tr_w or tr_l:
        out["exactness"] = "PARTIAL (row cap hit)"
        out["truncated"] = True
        out["caveats"].insert(0, "The --max-rows cap (%d) was hit while folding "
                                 "loyalty.history client-side; these sums are LOWER "
                                 "BOUNDS, not exact." % args.max_rows)
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
                        "signed off. Both sides are now restricted to the same "
                        "programme, so a programme mismatch is no longer a "
                        "candidate explanation for the gap."),
        }
    return out


def section_liability(odoo, u_start, u_end, card_meta, point_value, pv_meta, args):
    """QUESTION: how big is the outstanding point liability against one month of
    sales?

    METHOD: liability_JOD = sum(loyalty.card.points over POINTS-programme cards)
    x point value. Gift-card and eWallet balances are shown as their own line in
    JOD at 1:1 -- they are money already and are not multiplied by anything. One
    month of sales is MEASURED as the trailing 30 days ending at the window end
    (not annual/12, so seasonality is not smoothed away). Both the gross
    liability and a breakage-adjusted range are printed."""
    out = {"exactness": "DERIVED (exact point balance x configured point value)",
           "method": "sum(loyalty.card.points) over points-programme cards x point "
                     "value, over trailing-30-day measured POS sales"}
    pts = (card_meta or {}).get("outstanding_points_total")
    if pts is None:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("loyalty.card has no readable `points` field, or the points "
                         "programme could not be identified, so the outstanding "
                         "balance is unknown. It is NOT zero -- do not report a zero "
                         "liability.")
        return out
    if not point_value:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("no unambiguous point value is available (%s), so the point "
                         "balance cannot be expressed in JOD. The balance itself is "
                         "%s points -- carry that forward, not a JOD figure built on "
                         "a guessed rate."
                         % (pv_meta.get("exactness"), money(pts)))
        out["outstanding_points"] = pts
        return out
    end_dt = dt.datetime.strptime(u_end, "%Y-%m-%d %H:%M:%S")
    m_start = (end_dt - dt.timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
    n30, s30, _, _ = total_sum(odoo, "pos.order", order_domain(m_start, u_end),
                               ["amount_total"], cap=args.max_rows)
    month_sales = s30.get("amount_total", 0.0)
    liab = pts * point_value if point_value else None
    pay = ((card_meta or {}).get("payment_programs") or {})
    pay_bal = pay.get("balance_currency_total")
    out.update({
        "status": "OK",
        "outstanding_points": pts,
        "outstanding_points_on_archived_cards":
            (card_meta or {}).get("outstanding_points_on_archived_cards"),
        "point_value_jod": point_value,
        "point_value_exactness": pv_meta.get("exactness"),
        "liability_jod": liab,
        "payment_program_liability_jod": pay_bal,
        "payment_program_detail": pay.get("programs"),
        "total_loyalty_table_liability_jod": (liab + pay_bal) if (liab is not None and pay_bal is not None) else None,
        "month_sales_jod": month_sales,
        "month_sales_orders": n30,
        "month_window": {"from_utc": m_start, "to_utc": u_end, "days": 30},
        "liability_share_of_month_sales": (liab / month_sales) if (liab and month_sales) else None,
        "caveats": [
            "The point liability counts POINTS-programme cards only. Gift-card and "
            "eWallet balances are printed on their own line in JOD at 1:1; adding "
            "them to the point count and multiplying the sum by a point value would "
            "value a 50 JOD gift card at 0.50 JOD.",
            "This is the GROSS liability: every outstanding point valued as if it "
            "will be redeemed. Real liability is gross x (1 - breakage). Breakage "
            "cannot be measured until a full expiry cycle has run; the redemption "
            "rate in the section above is the best available proxy and the range "
            "below brackets it.",
            "Archived cards are INCLUDED (the client runs with active_test=False). "
            "The share sitting on archived cards is printed: archiving a card does "
            "not extinguish the points, and hiding them would understate this number.",
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


def reward_line_domain(pctx, u_start, u_end):
    """is_reward_line alone is NOT a loyalty redemption.

    Paying with a gift card or an eWallet in Odoo POS posts a line with
    is_reward_line=True and the same shape as a loyalty discount --
    _getRewardLineValuesDiscount special-cases exactly those two program types.
    Such a line's value is the amount TENDERED (commonly 5-50 JOD against a
    ~1 JOD loyalty reward), and because the k estimator is a value-weighted
    ratio of sums, a handful of them can dominate k outright while the usable-
    redemption count still looks healthy.

    reward_id.program_id is a fully-stored path (pos.order.line.reward_id ->
    loyalty.reward.program_id), so this filter does not depend on a related
    field being searchable."""
    return [("is_reward_line", "=", True),
            ("reward_id.program_id", "in", list(pctx["points_program_ids"])),
            ("order_id.date_order", ">=", u_start),
            ("order_id.date_order", "<", u_end),
            ("order_id.state", "in", SALE_STATES)]


def fetch_reward_lines(odoo, caps, pctx, price_field, u_start, u_end, args):
    """Every POINTS-PROGRAMME POS reward line settled in the window. This is the
    ONLY order-level evidence of a redemption that also exposes the basket,
    which is why k is computed from here and not from loyalty.history.

    Returns (rows, error, meta). Cached per window: the k section and the
    redemption-mix section both need it and it is the single most expensive
    query in the script."""
    ck = (u_start, u_end)
    if ck in _REWARD_LINE_CACHE:
        return _REWARD_LINE_CACHE[ck]
    if not caps["has_reward_line_flag"]:
        res = (None, "pos.order.line has no is_reward_line field -- the POS "
                     "loyalty bridge is not installed, so redemptions cannot be "
                     "tied to baskets", {})
        _REWARD_LINE_CACHE[ck] = res
        return res
    if not caps.get("has_reward_id"):
        res = (None, "pos.order.line has no reward_id field, so a loyalty redemption "
                     "cannot be told apart from a gift-card or eWallet tender (both "
                     "post is_reward_line=True). Measuring k or the redemption mix "
                     "off an unfiltered is_reward_line domain would silently mix "
                     "5-50 JOD tenders into ~1 JOD rewards, so this is reported as "
                     "UNAVAILABLE rather than estimated.", {})
        _REWARD_LINE_CACHE[ck] = res
        return res
    if (pctx or {}).get("status") != "OK":
        res = (None, "no points programme identified (%s), so reward lines cannot be "
                     "restricted to it" % ((pctx or {}).get("reason") or "unknown"), {})
        _REWARD_LINE_CACHE[ck] = res
        return res

    dom = reward_line_domain(pctx, u_start, u_end)
    fields = ["order_id", "product_id", "qty", price_field, "reward_id"]
    if caps.get("has_points_cost"):
        fields.append("points_cost")
    note("reading points-programme reward lines in the window ...")
    rows, truncated = odoo.search_read_all("pos.order.line", dom, fields,
                                           batch=args.batch, cap=args.max_rows,
                                           label="reward lines")
    meta = {"truncated": truncated, "rows": len(rows)}
    if truncated:
        warn("reward-line fetch truncated at --max-rows=%d" % args.max_rows)
    # How much is being EXCLUDED, so a reviewer can see the volume rather than
    # take the filter on trust.
    win = [("is_reward_line", "=", True),
           ("order_id.date_order", ">=", u_start),
           ("order_id.date_order", "<", u_end),
           ("order_id.state", "in", SALE_STATES)]
    try:
        meta["all_reward_lines_in_window"] = odoo.search_count("pos.order.line", win)
        if pctx.get("payment_program_ids"):
            meta["payment_program_tender_lines_excluded"] = odoo.search_count(
                "pos.order.line",
                win + [("reward_id.program_id", "in", list(pctx["payment_program_ids"]))])
        meta["other_program_reward_lines_excluded"] = odoo.search_count(
            "pos.order.line",
            win + [("reward_id.program_id", "not in", list(pctx["points_program_ids"]))])
        meta["reward_lines_without_reward_id"] = odoo.search_count(
            "pos.order.line", win + [("reward_id", "=", False)])
    except Exception as exc:
        meta["exclusion_counts_error"] = str(exc)
    _REWARD_LINE_CACHE[ck] = (rows, None, meta)
    return rows, None, meta


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
                    "categ_id": m2o_id(cat),
                    "categ_name": m2o_name(cat, None),
                }
        except Exception as exc:
            warn("product read failed for a chunk: %s" % exc)
    return info


def read_order_headers(odoo, order_ids, args):
    """partner_id / date_order / amount_total for a set of orders.
    amount_total is what identifies a refund (< 0)."""
    out = {}
    for grp in chunks(sorted(set(order_ids)), args.order_chunk):
        try:
            for o in odoo.read("pos.order", grp,
                               ["partner_id", "date_order", "amount_total"]):
                out[o["id"]] = {"partner_id": m2o_id(o.get("partner_id")),
                                "date_order": o.get("date_order"),
                                "amount_total": float(o.get("amount_total") or 0.0)}
        except Exception as exc:
            warn("order header read failed for a chunk: %s" % exc)
    return out


def fetch_baskets(odoo, order_ids, price_field, args):
    """For each order id: what the customer actually PAID, and what the reward
    was worth.

    HOW ODOO POSTS A REWARD (this is the whole reason this function exists).
    A free-product reward does NOT zero-price the rewarded item.
    `_getRewardLineValuesProduct` returns ONE extra line whose product is the
    reward's own `discount_line_product_id`, whose price_unit is NEGATIVE
    (-retail), whose qty is the free quantity and whose is_reward_line is True.
    The rewarded product itself stays in the order as an ordinary, FULL-PRICE,
    non-reward line -- `_computeUnclaimedFreeProductQty` counts it from the
    ordinary order lines, so it must. A discount reward posts the same way.

    Therefore:
      cash              = sum over ALL lines, reward lines included. This is the
                          money that changed hands, and it equals amount_total.
      paid_excl_reward  = sum over non-reward lines. This is NOT what was paid;
                          it is the pre-reward basket, kept only as a diagnostic.
      reward_value      = |sum of the reward lines| = the retail value the
                          reward displaced (tax-inclusive, same basis as
                          amount_total).
    There is no zero-priced reward line to fall back on, so there is no
    list_price fallback here: the negative line already carries retail."""
    baskets = {}
    for grp in chunks(sorted(order_ids), args.order_chunk):
        fields = ["order_id", "product_id", "qty", price_field, "is_reward_line"]
        try:
            rows, trunc = odoo.search_read_all("pos.order.line", [("order_id", "in", grp)],
                                               fields, batch=args.batch, cap=args.max_rows)
            if trunc:
                warn("basket line fetch truncated at --max-rows for an order chunk")
        except Exception as exc:
            warn("line fetch failed for an order chunk: %s" % exc)
            continue
        for r in rows:
            oid = m2o_id(r.get("order_id"))
            b = baskets.setdefault(oid, {"cash": 0.0, "paid_excl_reward": 0.0,
                                         "reward_raw": 0.0, "reward_units": 0.0,
                                         "n_lines": 0, "n_reward_lines": 0})
            val = float(r.get(price_field) or 0.0)
            b["n_lines"] += 1
            b["cash"] += val
            if r.get("is_reward_line"):
                b["n_reward_lines"] += 1
                b["reward_raw"] += val
                b["reward_units"] += float(r.get("qty") or 0.0)
            else:
                b["paid_excl_reward"] += val
    for b in baskets.values():
        b["reward_value"] = abs(b["reward_raw"])
    return baskets


# --------------------------------------------------------------------------
# SECTION 5 -- SUBSTITUTION FACTOR k   (the most sensitive input in the design)
# --------------------------------------------------------------------------

K_ESTIMATOR_DOC = (
    "HOW ODOO ACTUALLY POSTS A REWARD (get this wrong and k is off by exactly 1)\n"
    "  Odoo 19 POS does NOT price a rewarded product at 0. It leaves the rewarded\n"
    "  item in the basket as an ordinary FULL-PRICE, non-reward line and adds ONE\n"
    "  extra line: product = the reward's own discount_line_product_id, price =\n"
    "  MINUS the retail value, qty = the free quantity, is_reward_line = True.\n"
    "  A discount reward posts the same way. So the sum of the NON-reward lines is\n"
    "  the basket BEFORE the reward, not the money the customer handed over.\n"
    "  Using it as B_paid makes a fully-substitutive redemption measure k = 0 and\n"
    "  a fully-incremental one measure k = -1: measured k = true k - 1, which would\n"
    "  report a free-drinks programme as 'fully incremental' and clip the planning\n"
    "  range to 0.00..0.00.\n"
    "\n"
    "ESTIMATOR. For every redemption visit i by member p at time t:\n"
    "    B_paid(i)  = the CASH TOTAL of visit i = sum of ALL lines, reward lines\n"
    "                 (which are negative) included. Equals pos.order.amount_total.\n"
    "    B_trail(i) = mean B_paid over p's previous up-to-8 NON-REFUND visits\n"
    "                 before t. Those visits carry no reward lines (default), so\n"
    "                 their cash total is simply their basket -- the two sides are\n"
    "                 measured on the same basis.\n"
    "    R(i)       = |sum of the reward lines| = the retail value displaced,\n"
    "                 tax-inclusive, same basis as amount_total.\n"
    "  If the reward were purely INCREMENTAL (they would not otherwise have\n"
    "  bought it) the cash paid is unchanged:      B_paid ~= B_trail.\n"
    "  If it were purely SUBSTITUTIVE (it replaced something they were buying\n"
    "  anyway) the cash paid falls by the reward:  B_paid ~= B_trail - R.\n"
    "  Hence   k_i = (B_trail(i) - B_paid(i)) / R(i),  with k=0 fully\n"
    "  incremental and k=1 fully substitutive.\n"
    "\n"
    "  CHECK IT ON THE TWO LIMITING CASES (both use the real Odoo posting):\n"
    "    substitutive: usual drink 2.000 + reward line -2.000 -> cash 0.000,\n"
    "                  B_trail 2.000 -> k = (2.000 - 0.000)/2.000 = 1.  correct.\n"
    "    incremental : usual drink 2.000 + free pastry 1.000 + reward -1.000 ->\n"
    "                  cash 2.000, B_trail 2.000 -> k = 0/1.000 = 0.  correct.\n"
    "\n"
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
    "contained rewards are left in the trailing window, their cash totals are "
    "already depressed, pulling B_trail down and k with it. --exclude-prior-"
    "redemptions (default on) removes them at the cost of sample size.",
    "DOWNWARD: unmeasured channels. Spend moved to Talabat/Careem is invisible "
    "here, so a member who shifted channel looks like a shrinking basket only "
    "if they also redeemed in POS.",
    "REMOVED, not corrected: POS REFUNDS. A refund is a pos.order in the same "
    "states with a negative amount_total. Left in the trailing window it drags "
    "B_trail towards (and past) zero -- at a 7.16 JOD average basket, 4 priors "
    "and a 1 JOD reward one refund moves that observation by about -3.6, "
    "against a quantity whose meaningful range is [0,1]. Refund documents are "
    "dropped from every visit sequence here and counted in `dropped`.",
    "SELECTION: redemptions are dropped when fewer than --min-prior earlier "
    "non-refund visits exist, which keeps frequent customers and drops "
    "occasional ones. The dropped share is reported; if it is large, k "
    "describes regulars only.",
    "EXCLUDED at source: gift-card and eWallet tenders also post "
    "is_reward_line=True. They are filtered out by reward_id.program_id; the "
    "count excluded is printed, because a handful of 5-50 JOD tenders would "
    "dominate a value-weighted ratio built on ~1 JOD rewards.",
    "NOT CAUSAL. This is a within-person pre/post comparison with no control "
    "group. Only the proposal's 10% holdout can identify k without these "
    "biases. Treat the printed range as a planning bracket, and note the net "
    "direction is UPWARD, which makes it CONSERVATIVE for budgeting: it "
    "overstates cannibalisation, hence overstates programme cost.",
]


def section_k(odoo, caps, u_start, u_end, pctx, args):
    out = {"exactness": "ESTIMATE", "estimator": K_ESTIMATOR_DOC,
           "bias": K_BIAS_DOC,
           "method": "within-person pre/post over the trailing 8 non-refund visits; "
                     "B_paid is the order cash total (reward lines included); "
                     "value-weighted ratio-of-sums with a percentile bootstrap CI"}
    price_field, pol = line_price_field(caps, odoo)
    if not price_field:
        out["status"] = "UNAVAILABLE"
        out["reason"] = "pos.order.line has no usable price field"
        return out
    rows, err, rl_meta = fetch_reward_lines(odoo, caps, pctx, price_field,
                                            u_start, u_end, args)
    if err:
        out["status"] = "UNAVAILABLE"
        out["reason"] = err
        return out
    out["reward_line_scope"] = rl_meta
    red_order_ids = sorted({m2o_id(r.get("order_id")) for r in rows if r.get("order_id")})
    out["redemption_orders_found"] = len(red_order_ids)
    if not red_order_ids:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("no POINTS-programme POS reward lines in the window -- either "
                         "nobody redeemed, or redemptions are not posted as reward "
                         "lines. k cannot be estimated and MUST NOT be assumed.")
        return out

    # order header for the redemption visits
    hdr = read_order_headers(odoo, red_order_ids, args)
    red_orders = {}
    anon = 0
    refunded_redemptions = 0
    for oid, h in hdr.items():
        if not h["partner_id"]:
            anon += 1
            continue  # anonymous redemption: no trailing history exists
        # A refund DOCUMENT (amount_total < 0) is not a redemption visit.
        # NOTE the threshold is < 0, not <= 0: with B_paid corrected to the cash
        # total, a FULLY SUBSTITUTIVE redemption legitimately totals exactly
        # 0.000, and dropping it would delete precisely the observations that
        # carry k = 1. (Resolution of the conflict between "drop amount_total
        # <= 0 visits" and the corrected cash basis: refunds are strictly
        # negative, so < 0 removes them without removing k = 1.)
        if h["amount_total"] < 0:
            refunded_redemptions += 1
            continue
        red_orders[oid] = h
    out["redemptions_with_partner"] = len(red_orders)
    out["redemptions_anonymous_dropped"] = anon
    out["redemptions_refund_documents_dropped"] = refunded_redemptions

    if not red_orders:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("every redemption order in the window is anonymous or a refund "
                         "document; no trailing history exists to compare against.")
        return out

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
    note("k: reading trailing history for %d partner(s) ..." % len(partners))
    hist = defaultdict(list)
    refund_visits_dropped = 0
    for grp in chunks(partners, args.partner_chunk):
        try:
            hrows, _ = odoo.search_read_all(
                "pos.order",
                order_domain(look_start, u_end, [("partner_id", "in", grp)]),
                ["partner_id", "date_order", "amount_total"], batch=args.batch,
                cap=args.max_rows)
        except Exception as exc:
            warn("history fetch failed for a partner chunk: %s" % exc)
            continue
        for h in hrows:
            pid = m2o_id(h.get("partner_id"))
            if not pid:
                continue
            if float(h.get("amount_total") or 0.0) < 0:
                refund_visits_dropped += 1
                continue          # a refund is a document, not a visit
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
    note("k: reading basket lines for %d order(s) ..." % len(need))
    baskets = fetch_baskets(odoo, need, price_field, args)

    pairs = []
    per = []
    dropped = defaultdict(int)
    dropped["refund_visits_removed_from_history"] = refund_visits_dropped
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
        prev_paid = [baskets[i]["cash"] for i in prev if i in baskets]
        if len(prev_paid) < args.min_prior:
            dropped["insufficient_prior_visits"] += 1
            continue
        btrail = mean(prev_paid)
        bpaid = b["cash"]
        pairs.append((btrail - bpaid, R))
        per.append({"order_id": oid, "k": (btrail - bpaid) / R, "R": R,
                    "b_trail": btrail, "b_paid": bpaid,
                    "b_paid_excl_reward_lines": b["paid_excl_reward"],
                    "n_prior": len(prev_paid),
                    "prior_sd": stdev(prev_paid)})
    out["dropped"] = dict(dropped)
    out["usable_redemptions"] = len(pairs)

    # max(2, ...) is a floor, not a preference: below 2 observations the
    # estimator, the bootstrap and the share statistics below all divide by an
    # empty sample and raise, which would surface as an interpreter message
    # where a measurement should be.
    min_needed = max(2, args.k_min_sample)
    if len(pairs) < min_needed:
        out["status"] = "INSUFFICIENT"
        out["reason"] = ("only %d usable redemptions (minimum %d). k is NOT "
                         "reportable. Do not substitute a benchmark value: run "
                         "the window longer, or launch with the holdout group and "
                         "measure k properly."
                         % (len(pairs), min_needed))
        return out

    k_hat = ratio_of_sums(pairs)
    lo, hi = bootstrap_ci(pairs, args.bootstrap, args.seed)
    ks = sorted(p["k"] for p in per)
    ks_clipped = sorted(min(1.0, max(0.0, k)) for k in ks)
    noise = [(p["prior_sd"] / p["R"]) for p in per if p["prior_sd"] and p["R"]]
    noise.sort()
    ns = pctl(noise, 50) if noise else None
    anchor_lo = lo if lo is not None else k_hat
    anchor_hi = hi if hi is not None else k_hat

    out.update({
        "status": "OK",
        "k_point_estimate_do_not_quote_alone": k_hat,
        "k_ci95": {"low": lo, "high": hi},
        "k_reported_range": {
            "raw_low": round(math.floor(anchor_lo * 20) / 20.0, 3),
            "raw_high": round(math.ceil(anchor_hi * 20) / 20.0, 3),
            "low": max(0.0, round(math.floor(anchor_lo * 20) / 20.0, 3)),
            "high": min(1.0, round(math.ceil(anchor_hi * 20) / 20.0, 3)),
            "clipped_below_zero": (anchor_lo < 0),
            "clipped_above_one": (anchor_hi > 1),
            "note": "CI widened outward to the nearest 0.05, then clipped to [0,1] "
                    "for the planning range. This is the range to carry into the "
                    "economics; quoting a single k from this data is not supportable.",
            "clipping_note": ("The raw interval extends OUTSIDE [0,1]. Below 0 means "
                              "redeemers' cash totals did not fall at all (the "
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
                       "bootstrap_resamples": args.bootstrap, "seed": args.seed,
                       "min_usable_redemptions": min_needed},
        "caveats": [
            "B_paid is the ORDER CASH TOTAL, not the sum of the non-reward lines. "
            "See the estimator block: Odoo posts the reward as a negative line and "
            "leaves the rewarded product at full price, so the non-reward sum is the "
            "pre-reward basket and using it would shift every k down by exactly 1.",
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

def section_time_to_first_reward(odoo, caps, u_start, u_end, pctx, members, args):
    """QUESTION: how many visits does a member make between their first earn
    and their first redemption? The proposal's central idea -- a first rung at
    100 points -- lives or dies on this number.

    METHOD: uniform seeded sample of --max-ttfr-members points-programme card
    holders. For each, every non-refund POS visit in the trailing
    --history-days is read, and the visits that carry a POINTS-PROGRAMME reward
    line are marked. 'Visits to first reward' counts the first visit through to
    and including the redeeming visit.

    HOW TO READ IT: the distribution over REDEEMERS is biased DOWNWARD, because
    members who have not redeemed yet are right-censored and excluded. The
    censored share is printed next to it and is the more important number: if
    most members never reach a reward, the redeemer median is describing a
    small, fast minority. Percentiles are REFUSED below --ttfr-min-redeemers,
    for the same reason section 5 refuses k below --k-min-sample."""
    out = {"exactness": "ESTIMATE (uniform sample, right-censored)",
           "method": "seeded uniform sample of points-programme card holders; POS "
                     "visit sequence over the trailing history window, refund "
                     "documents removed; first visit carrying a points-programme "
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
    if not caps.get("has_reward_id"):
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("pos.order.line has no reward_id, so a loyalty redemption "
                         "cannot be told apart from a gift-card or eWallet tender "
                         "(both post is_reward_line=True). A 'first reward' counted "
                         "off an unfiltered flag would often be a gift-card payment.")
        return out
    if (pctx or {}).get("status") != "OK":
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("no points programme identified (%s)"
                         % ((pctx or {}).get("reason") or "unknown"))
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

    note("ttfr: reading visit history for %d sampled member(s) ..." % len(sample))
    visits = defaultdict(list)   # partner -> [(date, order_id)]
    refund_visits_dropped = 0
    for grp in chunks(sample, args.partner_chunk):
        try:
            rows, _ = odoo.search_read_all(
                "pos.order", order_domain(h_start, u_end, [("partner_id", "in", grp)]),
                ["partner_id", "date_order", "amount_total"], batch=args.batch,
                cap=args.max_rows)
        except Exception as exc:
            warn("ttfr history fetch failed for a chunk: %s" % exc)
            continue
        for r in rows:
            pid = m2o_id(r.get("partner_id"))
            if not pid:
                continue
            if float(r.get("amount_total") or 0.0) < 0:
                refund_visits_dropped += 1
                continue          # a refund document is not a visit
            visits[pid].append((r["date_order"], r["id"]))
    for pid in visits:
        visits[pid].sort()
    out["refund_documents_dropped_from_sequences"] = refund_visits_dropped

    all_order_ids = [oid for lst in visits.values() for _, oid in lst]
    note("ttfr: marking redeeming visits over %d order(s) ..." % len(all_order_ids))
    reward_orders = set()
    for grp in chunks(all_order_ids, args.order_chunk):
        try:
            rows, _ = odoo.search_read_all(
                "pos.order.line",
                [("is_reward_line", "=", True),
                 ("reward_id.program_id", "in", list(pctx["points_program_ids"])),
                 ("order_id", "in", grp)],
                ["order_id"], batch=args.batch, cap=args.max_rows)
        except Exception as exc:
            warn("ttfr reward-line fetch failed for a chunk: %s" % exc)
            continue
        for r in rows:
            oid = m2o_id(r.get("order_id"))
            if oid:
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
    enough = n_red >= args.ttfr_min_redeemers
    out.update({
        "status": "OK",
        "sampled_members_with_visits": n_active,
        "sampled_members_no_visits_in_history": len(sample) - n_active,
        "redeemers": n_red,
        "min_redeemers_required": args.ttfr_min_redeemers,
        "censored_never_redeemed": len(cv),
        "censored_share_of_active": (len(cv) / n_active) if n_active else None,
        "share_redeeming_on_first_visit": ((sum(1 for v in rv if v == 1) / n_red)
                                           if n_red else None),
        # Percentiles over a handful of redeemers are noise dressed as a
        # distribution, and this is the statistic the design's 100-point first
        # rung is set from, so it is refused rather than printed with a caveat.
        "visits_to_first_reward_redeemers_only": ({
            "n": n_red, "min": rv[0], "p25": pctl(rv, 25), "p50": pctl(rv, 50),
            "p75": pctl(rv, 75), "p90": pctl(rv, 90), "max": rv[-1], "mean": mean(rv),
            "share_redeeming_on_first_visit": sum(1 for v in rv if v == 1) / n_red,
        } if (n_red and enough) else None),
        "percentiles_refused_reason": (None if enough else
                                       ("only %d redeemer(s) in the sample (minimum "
                                        "%d). The visits-to-first-reward percentiles "
                                        "are NOT reportable. Do not substitute a "
                                        "benchmark value: widen --history-days, raise "
                                        "--max-ttfr-members, or gate the first rung on "
                                        "the holdout instead. The redeemer count and "
                                        "the censored share above ARE measured and can "
                                        "be used."
                                        % (n_red, args.ttfr_min_redeemers))),
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
            "Refund documents (amount_total < 0) are removed from the visit "
            "sequences: %d were dropped. A refund is not a trip to a shop and would "
            "inflate every count." % refund_visits_dropped,
            "SAMPLING ERROR is driven by the REDEEMER count, not the sample size. "
            "With %d redeemer(s), a reported share of ~50%% inside that group carries "
            "roughly +/-%s at 95%% confidence. The censored share, which is measured "
            "over all %d active sampled members, carries roughly +/-%s."
            % (n_red, pct(1.96 * math.sqrt(0.25 / max(1, n_red)), 1),
               n_active, pct(1.96 * math.sqrt(0.25 / max(1, n_active)), 1)),
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


def read_reward_defs(odoo, reward_ids):
    """loyalty.reward rows for the rewards actually redeemed, keyed by id.

    This is the join that makes section 7 mean anything. A POS reward line's
    product_id is NOT the rewarded item: it is the reward's own
    discount_line_product_id, which `_get_discount_product_values()` creates as
    {'type': 'service', 'sale_ok': False, 'lst_price': 0} with no meaningful
    category and no cost. Bucketing on it puts 100% of rewards in
    'other'/'unknown' with retail 0 and COGS 0. The real product is
    reward_product_id (or a single-entry reward_product_ids) on the reward."""
    defs = {}
    if not reward_ids:
        return defs
    fields = ["description", "reward_type", "discount_mode", "discount",
              "required_points", "reward_product_id", "reward_product_ids",
              "reward_product_qty", "program_id"]
    for grp in chunks(sorted(set(reward_ids)), 500):
        try:
            for w in odoo.read("loyalty.reward", grp, fields):
                defs[w["id"]] = w
        except Exception as exc:
            warn("loyalty.reward read failed for a chunk: %s" % exc)
    return defs


def section_mix(odoo, caps, u_start, u_end, pctx, args):
    """QUESTION: what are members actually redeeming FOR, and what does one
    reward cost in JOD?

    METHOD: every points-programme reward line in the window, joined through
    pos.order.line.reward_id -> loyalty.reward -> reward_product_id to the REAL
    rewarded product, whose category is bucketed by keyword and whose cost is
    product.product.standard_price.

    THE RETAIL COLUMN IS THE POSTED LINE VALUE, |price_subtotal_incl|, not
    product.template.list_price. Two reasons: the reward line already carries
    the displaced retail (Odoo posts it as -retail x qty), and it is
    TAX-INCLUSIVE, so it is on the same basis as amount_total and as the k
    estimator. list_price is tax-EXCLUSIVE unless the POS taxes are
    price_include -- a basis this script does not check and therefore will not
    silently assume.

    Rewards with no product at all (percent / per_order / per_point discounts)
    get their own row: they displace revenue but they have no category and no
    COGS, and bucketing them anywhere would corrupt both columns.

    HOW TO READ IT: standard_price is only as good as the cost maintenance in
    Odoo. The share of reward units whose product carries standard_price == 0
    is printed; if it is large, the cost column is an under-count and the
    posted-value column is the safer planning basis."""
    out = {"exactness": "EXACT (counts and posted value) / DERIVED (cost, depends "
                        "on standard_price maintenance)",
           "method": "pos.order.line where is_reward_line and the reward belongs to "
                     "the points programme, joined via reward_id -> loyalty.reward "
                     "-> reward_product_id to product.product for categ_id and "
                     "standard_price; displaced retail is |price_subtotal_incl| "
                     "(tax-inclusive), signed quantities, refunded lines excluded"}
    price_field, _ = line_price_field(caps, odoo)
    if not price_field:
        out["status"] = "UNAVAILABLE"
        out["reason"] = "pos.order.line has no usable price field"
        return out
    rows, err, rl_meta = fetch_reward_lines(odoo, caps, pctx, price_field,
                                            u_start, u_end, args)
    if err:
        out["status"] = "UNAVAILABLE"
        out["reason"] = err
        return out
    if not rows:
        out["status"] = "UNAVAILABLE"
        out["reason"] = "no points-programme reward lines in the window"
        return out
    out["reward_line_scope"] = rl_meta

    # Refunded reward lines: a reversed redemption is not a redemption. Left in,
    # it ADDS to an abs()-accumulated value column while SUBTRACTING from a
    # signed one, and counts as an extra redemption in the denominator.
    hdr = read_order_headers(odoo, [m2o_id(r.get("order_id")) for r in rows
                                    if r.get("order_id")], args)
    kept, reversed_lines, reversed_units = [], 0, 0.0
    for r in rows:
        oid = m2o_id(r.get("order_id"))
        qty = float(r.get("qty") or 0.0)
        if (hdr.get(oid, {}).get("amount_total", 0.0) < 0) or qty < 0:
            reversed_lines += 1
            reversed_units += qty
            continue
        kept.append(r)
    out["reward_lines_reversed_by_refund"] = {"lines": reversed_lines,
                                              "units": reversed_units}
    if not kept:
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("every points-programme reward line in the window sits on a "
                         "refunded order or carries a negative quantity; there is no "
                         "redemption mix to report.")
        return out

    cmap, cmap_src = load_category_map(args.category_map)
    out["category_map_source"] = cmap_src
    defs = read_reward_defs(odoo, [m2o_id(r.get("reward_id")) for r in kept
                                   if r.get("reward_id")])
    # resolve each reward to a real product where one exists
    resolved = {}
    real_pids = []
    for rid, w in defs.items():
        rtype = w.get("reward_type")
        pid = m2o_id(w.get("reward_product_id"))
        cands = w.get("reward_product_ids") or []
        if rtype == "product":
            if pid:
                resolved[rid] = ("product", pid)
                real_pids.append(pid)
            elif len(cands) == 1:
                resolved[rid] = ("product", cands[0])
                real_pids.append(cands[0])
            else:
                resolved[rid] = ("product_ambiguous", None)
        elif rtype == "discount":
            resolved[rid] = ("discount", None)
        else:
            resolved[rid] = ("other_reward_type", None)
    pinfo = product_info(odoo, real_pids)

    agg = defaultdict(lambda: {"lines": 0, "units": 0.0, "posted_value_jod": 0.0,
                               "cogs_jod": 0.0, "cogs_measurable_units": 0.0,
                               "units_missing_cost": 0.0, "products": set(),
                               "rewards": set(), "cost_basis": None})
    orders = set()
    unresolved_lines = 0
    for r in kept:
        orders.add(m2o_id(r.get("order_id")))
        rid = m2o_id(r.get("reward_id"))
        qty = float(r.get("qty") or 0.0)
        posted = abs(float(r.get(price_field) or 0.0))
        kind, pid = resolved.get(rid, (None, None))
        if kind == "product" and pid:
            pi = pinfo.get(pid, {})
            b = bucket_for(pi.get("categ_name"), cmap)
            a = agg[b]
            a["cost_basis"] = "standard_price x qty of the rewarded product"
            sp = float(pi.get("standard_price") or 0.0)
            a["cogs_jod"] += sp * qty
            a["cogs_measurable_units"] += qty
            if sp <= 0:
                a["units_missing_cost"] += qty
            if pid:
                a["products"].add(pid)
        elif kind == "product_ambiguous":
            a = agg["product reward (catalogue, item unknown)"]
            a["cost_basis"] = ("no COGS: the reward offers a CHOICE of products and "
                               "the line does not record which was taken")
        elif kind == "discount":
            a = agg["discount reward (no product)"]
            a["cost_basis"] = ("no COGS: a percent / per-order / per-point discount "
                               "displaces revenue but consumes no specific item")
        else:
            unresolved_lines += 1
            a = agg["unresolved (reward row not readable)"]
            a["cost_basis"] = "no COGS: loyalty.reward could not be read for this line"
        a["lines"] += 1
        a["units"] += qty
        a["posted_value_jod"] += posted
        if rid:
            a["rewards"].add(rid)
    out["reward_lines_with_unreadable_reward"] = unresolved_lines

    tot_units = sum(a["units"] for a in agg.values())
    tot_posted = sum(a["posted_value_jod"] for a in agg.values())
    tot_cogs = sum(a["cogs_jod"] for a in agg.values())
    tot_cost_units = sum(a["cogs_measurable_units"] for a in agg.values())
    tot_missing = sum(a["units_missing_cost"] for a in agg.values())
    if tot_units <= 0:
        # No fabricated denominator. `or 1.0` used to print 1.0 as a measured
        # unit count and turn every share into a percentage of an invented base.
        out["status"] = "UNAVAILABLE"
        out["reason"] = ("reward units net to %s over the window, so there is no "
                         "denominator for the mix shares. This normally means the "
                         "window contains as many reversed reward lines as issued "
                         "ones; widen the window or investigate the reversals."
                         % money(tot_units))
        out["diagnostics"] = {"reward_lines_kept": len(kept),
                              "reward_lines_reversed": reversed_lines}
        return out

    buckets = []
    for b, a in sorted(agg.items(), key=lambda kv: -kv[1]["units"]):
        buckets.append({
            "bucket": b, "reward_lines": a["lines"], "units": a["units"],
            "unit_share": a["units"] / tot_units,
            "posted_value_jod": a["posted_value_jod"],
            "cogs_jod": (a["cogs_jod"] if a["cogs_measurable_units"] else None),
            "posted_per_unit_jod": (a["posted_value_jod"] / a["units"]) if a["units"] else None,
            "cogs_per_unit_jod": ((a["cogs_jod"] / a["cogs_measurable_units"])
                                  if a["cogs_measurable_units"] else None),
            "distinct_products": len(a["products"]),
            "distinct_rewards": len(a["rewards"]),
            "units_missing_standard_price": a["units_missing_cost"],
            "cost_basis": a["cost_basis"],
        })
    out.update({
        "status": "OK",
        "redemption_orders": len(orders),
        "reward_lines": len(kept),
        "buckets": buckets,
        "totals": {
            "units": tot_units,
            "posted_value_jod": tot_posted,
            "cogs_jod": tot_cogs,
            "units_with_a_measurable_cost": tot_cost_units,
            "posted_per_reward_order_jod": (tot_posted / len(orders)) if orders else None,
            "cogs_per_reward_order_jod": ((tot_cogs / len(orders))
                                          if (orders and tot_cost_units) else None),
            "units_missing_standard_price_share": ((tot_missing / tot_cost_units)
                                                   if tot_cost_units else None),
            "units_with_no_product_share": ((tot_units - tot_cost_units) / tot_units),
        },
        "caveats": [
            "The product behind each reward comes from loyalty.reward, NOT from the "
            "reward line's product_id. That field holds the reward's own technical "
            "discount product -- a service with list_price 0 and no real category -- "
            "so reading it would return an all-zero table.",
            "'posted_value_jod' is |price_subtotal_incl| of the reward line: what the "
            "POS actually recorded, tax-inclusive, and the right basis for displaced "
            "revenue. 'cogs_jod' is standard_price x qty of the REWARDED product and "
            "is the right basis for out-of-pocket cost. They answer different "
            "questions and only the second depends on cost maintenance.",
            "Rows whose cost_basis says 'no COGS' have no rewarded item (percent or "
            "per-order discounts) or an unresolvable one (a catalogue reward). Their "
            "units are excluded from the cost denominators, which is why "
            "units_with_no_product_share is printed.",
            "Reward lines on refunded orders, and lines with a negative quantity, are "
            "excluded and counted separately; leaving them in would let a reversed "
            "redemption add to the value column and subtract from the unit column at "
            "the same time.",
            "Bucketing is keyword matching on product.category.complete_name. Any "
            "category that matches nothing lands in 'other'/'unknown'; if those "
            "buckets are large the map needs fixing before the mix is quoted "
            "(--category-map takes a JSON override).",
            "cost-per-reward-JOD from this table is a MIX-WEIGHTED average of what "
            "members chose to redeem in this window. It will move when the reward "
            "catalogue changes, so it is not a constant to hardcode in the design.",
        ],
    })
    if rl_meta.get("truncated"):
        out["exactness"] = "PARTIAL (row cap hit)"
        out["truncated"] = True
        out["caveats"].insert(0, "The reward-line fetch hit --max-rows (%d); this mix "
                                 "describes only the rows that were read."
                                 % args.max_rows)
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
    """A section that RAN and could not produce its number."""
    status = sec.get("status") or "UNAVAILABLE"
    reason = sec.get("reason") or ("no reason was recorded -- this is a bug in the "
                                   "script, not a finding about the data")
    print("\n%s: %s" % (name, status))
    print("    reason: %s" % reason)
    if sec.get("hint"):
        print("    hint  : %s" % sec["hint"])
    print("    -> This gate number is NOT available. Do not substitute a benchmark "
          "or an assumed value in the design; mark it OPEN.")


def not_run(name, report):
    """A section that was never requested. It is NOT open and NOT measured --
    saying either would be a false statement about production."""
    req = report["meta"].get("sections_requested") or []
    print("\n%s: NOT RUN  (this run was --only %s)" % (name, ",".join(req)))
    print("    Nothing is claimed about it either way. Re-run without --only to "
          "measure it.")


def sec_of(report, name):
    """Return (section, ran). `ran` is False when --only excluded it."""
    req = report["meta"].get("sections_requested") or ALL_SECTIONS
    if name not in req:
        return {}, False
    return (report["sections"].get(name) or {}), True


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
    print("sections run    : %s" % ", ".join(m.get("sections_requested") or []))
    print("rpc calls       : %d" % m["rpc_calls"])
    print("\nEXACTNESS KEY  EXACT = counted in the DB | DERIVED = arithmetic on EXACT")
    print("               ESTIMATE = statistical, CI printed | ASSUMPTION = input "
          "not readable from the DB")
    print("               PARTIAL = a row cap was hit; the figure is a lower bound")

    # ---- configuration actually found -----------------------------------
    pv = report["point_value"]
    pctx = report["program_scope"]
    hr("0. PROGRAM CONFIGURATION AS FOUND (context for every number below)")
    progs = report["programs"]
    if progs.get("status") != "OK":
        print("  loyalty configuration: %s (%s)" % (progs.get("status"), progs.get("reason")))
    else:
        rows = progs.get("programs") or []
        n_arch = len(progs.get("archived_programs") or [])
        print("  loyalty.program rows: %d  (%d active, %d ARCHIVED -- archived rows are "
              "read on purpose:\n    their cards can still hold points)"
              % (len(rows), len(rows) - n_arch, n_arch))
        for p in rows[:20]:
            print("    #%-5s %-34s type=%-16s active=%s"
                  % (p.get("id"), str(p.get("name"))[:34],
                     p.get("program_type"), p.get("active")))
        print("  loyalty.reward rows: %d   loyalty.rule rows: %d   types present: %s"
              % (len(progs.get("rewards") or []), len(progs.get("rules") or []),
                 ", ".join(progs.get("program_types_present") or []) or "n/a"))
    print("\n  MEASUREMENT SCOPE")
    if pctx.get("status") != "OK":
        print("    POINTS PROGRAMME: NOT IDENTIFIED -- %s" % pctx.get("reason"))
        print("    Every section that needs a member, a point or a redemption will "
              "print UNAVAILABLE.")
    else:
        print("    points programme(s): %s   [%s]"
              % (", ".join("#%s %s" % (p["id"], p.get("name")) for p in pctx["points_programs"]),
                 pctx.get("selection")))
        if pctx.get("multi_program_warning"):
            print("    ! %s" % pctx["multi_program_warning"])
        if pctx.get("payment_program_ids"):
            print("    payment programmes EXCLUDED from every point figure: %s"
                  % ", ".join("#%s %s (%s)" % (p["id"], p.get("name"), p.get("program_type"))
                              for p in pctx["payment_programs"]))
        if pctx.get("other_program_ids"):
            print("    coupon/promotion programmes excluded: %d"
                  % len(pctx["other_program_ids"]))

    print("\n  POINT VALUE: %s JOD per point"
          % (money(pv.get("value")) if pv.get("value") is not None else "NOT AVAILABLE"))
    print("    basis      : %s" % pv.get("basis"))
    print("    exactness  : %s" % pv.get("exactness"))
    if pv.get("scope"):
        print("    scope      : %s" % pv.get("scope"))
    for d in pv.get("distinct_per_point_jod") or []:
        print("      %s JOD/point <- reward(s) %s"
              % (money(d["jod_per_point"]),
                 ", ".join("#%s %s" % (s["reward_id"], str(s["description"])[:32])
                           for s in d["from_rewards"])))
    if pv.get("ambiguous"):
        print("    ! CONFIGURATION DISAGREES WITH ITSELF. No headline value is emitted "
              "and no median is\n      taken -- an interpolated midpoint would be a "
              "rate no reward on this database uses.")
        print("    ! %s" % pv.get("action_required"))
    if pv.get("payment_program_rewards"):
        print("    gift-card / eWallet rewards (NOT part of the point value):")
        for r in pv["payment_program_rewards"][:8]:
            print("      #%-5s %-28s %s mode=%s discount=%s"
                  % (r["reward_id"], str(r.get("description"))[:28], r.get("program_type"),
                     r.get("discount_mode"), r.get("discount")))
        print("      (their 'point' IS a currency unit; Odoo ships them at discount=1, "
              "which is why\n       pooling them with a loyalty reward destroys the "
              "point value)")
    if pv.get("matches_owner_claim_1_qirsh") is True:
        print("    owner claim: CONFIRMED -- configuration agrees that 1 point = 1 qirsh (0.01 JOD)")
    elif pv.get("matches_owner_claim_1_qirsh") is False:
        print("    owner claim: REFUTED -- the points programme's own reward(s) price a "
              "point at %s JOD,\n                 NOT 0.01. Every JOD figure below uses "
              "the configured value." % money(pv.get("value")))
    else:
        print("    owner claim: UNVERIFIED -- nothing unambiguous in the points "
              "programme's rewards pins\n                 the point value, so the "
              "'1 point = 1 qirsh' claim remains an assumption.")

    cm = report.get("cards") or {}
    if cm.get("status") in ("OK", "PARTIAL"):
        print("\n  MEMBER CARDS (points programme only): %d total (%d attached to a "
              "partner, %d anonymous)\n    -> %d distinct members"
              % (cm["cards_total"], cm["cards_with_partner"], cm["cards_anonymous"],
                 cm["distinct_member_partners"]))
        print("  outstanding POINTS on those cards: %s" % money(cm["outstanding_points_total"]))
        if cm.get("cards_archived"):
            print("    of which on ARCHIVED cards: %s points (%s of the balance) on %d card(s)"
                  % (money(cm.get("outstanding_points_on_archived_cards")),
                     pct(cm.get("outstanding_points_share_archived")),
                     cm.get("cards_archived")))
        pay = cm.get("payment_programs") or {}
        if pay.get("status") == "OK":
            print("  gift-card / eWallet balances (SEPARATE, already in JOD): %s JOD "
                  "over %d card(s)" % (money(pay.get("balance_currency_total")),
                                       pay.get("cards", 0)))
            for p in (pay.get("programs") or [])[:6]:
                print("      #%-5s %-28s %6d cards  %12s JOD"
                      % (p["program_id"], str(p["program"])[:28], p["cards"],
                         money(p["balance_currency"])))
        if cm.get("status") == "PARTIAL":
            print("  ! %s" % cm.get("reason"))
    elif cm:
        print("\n  MEMBER CARDS: %s -- %s" % (cm.get("status"), cm.get("reason")))

    # ---- 1 coverage ------------------------------------------------------
    sec, ran = sec_of(report, "coverage")
    hr("1. MEMBER COVERAGE, PER BRANCH   [%s]" % (sec.get("exactness", "?") if ran else "not run"))
    if not ran:
        not_run("coverage", report)
    elif sec.get("status") != "OK":
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
        print("  member (points card)     : %s of orders / %s of value"
              % (pct(n["coverage_by_count"]), pct(n["coverage_by_value"])))
        rf = sec.get("refunds") or {}
        print("  refund documents         : %d (%s of orders), %s JOD -- already netted "
              "out of value"
              % (rf.get("orders", 0), pct(rf.get("share_of_orders")),
                 money(rf.get("value_jod"))))
        sp = sec["branch_spread"]
        if sp.get("min_coverage_by_count") is not None:
            print("  per-branch spread by count: %s .. %s  <- if this spread is wide, a "
                  "single network coverage\n     figure is not a usable planning input; "
                  "the design must be sized on the worst branch."
                  % (pct(sp["min_coverage_by_count"]), pct(sp["max_coverage_by_count"])))
        print("\n  caveats:")
        show_caveats(sec)

    # ---- 2 spend + tiers -------------------------------------------------
    sec, ran = sec_of(report, "spend")
    hr("2. MEMBER SPEND DISTRIBUTION AND TIER CALIBRATION   [%s]"
       % (sec.get("exactness", "?") if ran else "not run"))
    if not ran:
        not_run("spend", report)
    elif sec.get("status") != "OK":
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
        mr = sec.get("member_refunds") or {}
        print("\n  inactive card holders in window: %d (%s of all cards)"
              % (sec["inactive_cardholders"], pct(sec["inactive_share"])))
        print("  refund documents inside member visit counts: %d (%s JOD) across %d member(s)"
              % (mr.get("orders", 0), money(mr.get("value_jod")),
                 mr.get("members_with_a_refund", 0)))
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
    sec, ran = sec_of(report, "redemption")
    hr("3. REDEMPTION RATE AND OUTSTANDING BALANCE   [%s]"
       % (sec.get("exactness", "?") if ran else "not run"))
    if not ran:
        not_run("redemption", report)
    elif sec.get("status") != "OK":
        unavailable("redemption", sec)
    else:
        print("  method: %s" % sec["method"])
        print("  scope : %s" % sec.get("scope"))
        w = sec["window"]
        l = sec["lifetime"]
        print("\n  window   : issued %s pts | used %s pts | rate %s"
              % (money(w["points_issued"]), money(w["points_used"]),
                 pct(w["redemption_rate"]) if w["redemption_rate"] is not None else "n/a"))
        if w["points_issued_jod"] is not None:
            print("             issued %s JOD | used %s JOD"
                  % (money(w["points_issued_jod"]), money(w["points_used_jod"])))
        else:
            print("             JOD columns: n/a (no unambiguous point value -- see header)")
        print("  lifetime : issued %s pts | used %s pts | rate %s"
              % (money(l["points_issued"]), money(l["points_used"]),
                 pct(l["redemption_rate"]) if l["redemption_rate"] is not None else "n/a"))
        o = sec["outstanding"]
        print("  outstanding: %s pts%s  (%s)"
              % (money(o["points"]),
                 (" = %s JOD" % money(o["jod"])) if o["jod"] is not None else "",
                 o["source"]))
        if sec.get("payment_program_balances_currency") is not None:
            print("  gift-card / eWallet balances, SEPARATE and already in JOD: %s JOD"
                  % money(sec["payment_program_balances_currency"]))
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
    sec, ran = sec_of(report, "liability")
    hr("4. LIABILITY AGAINST ONE MONTH OF SALES   [%s]"
       % (sec.get("exactness", "?") if ran else "not run"))
    if not ran:
        not_run("liability", report)
    elif sec.get("status") != "OK":
        unavailable("liability", sec)
    else:
        print("  method: %s" % sec["method"])
        print("\n  outstanding points      : %s" % money(sec["outstanding_points"]))
        if sec.get("outstanding_points_on_archived_cards"):
            print("    on archived cards     : %s (included -- archiving does not "
                  "extinguish points)" % money(sec["outstanding_points_on_archived_cards"]))
        print("  point value             : %s JOD  [%s]"
              % (money(sec["point_value_jod"]), sec["point_value_exactness"]))
        print("  GROSS POINT LIABILITY   : %s JOD" % money(sec["liability_jod"]))
        if sec.get("payment_program_liability_jod") is not None:
            print("  gift-card / eWallet     : %s JOD  (money, 1:1 -- NOT multiplied by "
                  "a point value)" % money(sec["payment_program_liability_jod"]))
            print("  TOTAL loyalty-table     : %s JOD"
                  % money(sec.get("total_loyalty_table_liability_jod")))
        print("  measured month of sales : %s JOD over %d orders (trailing 30 days)"
              % (money(sec["month_sales_jod"]), sec["month_sales_orders"]))
        print("  POINT LIAB / MONTH SALES: %s"
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
    sec, ran = sec_of(report, "k")
    hr("5. SUBSTITUTION FACTOR k   [%s]" % (sec.get("exactness", "?") if ran else "not run"))
    if not ran:
        not_run("k", report)
    else:
        print(sec.get("estimator", K_ESTIMATOR_DOC))
        if sec.get("status") != "OK":
            unavailable("k", sec)
            print("\n  BIAS AND LIMITS OF THE ESTIMATOR (they apply whenever it does run):")
            for b in sec.get("bias", K_BIAS_DOC):
                print("    - %s" % b)
        else:
            s = sec["sampling"]
            sc = sec.get("reward_line_scope") or {}
            print("\n  reward lines in window      : %s total, %s on the points programme"
                  % (sc.get("all_reward_lines_in_window", "?"), sc.get("rows", "?")))
            if sc.get("payment_program_tender_lines_excluded") is not None:
                print("    gift-card / eWallet TENDER lines excluded: %s   other "
                      "programmes: %s   no reward_id: %s"
                      % (sc.get("payment_program_tender_lines_excluded"),
                         sc.get("other_program_reward_lines_excluded"),
                         sc.get("reward_lines_without_reward_id")))
            print("  redemption orders in window : %d (%d anonymous, %d refund "
                  "documents, dropped)"
                  % (sec["redemption_orders_found"], sec["redemptions_anonymous_dropped"],
                     sec.get("redemptions_refund_documents_dropped", 0)))
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
    sec, ran = sec_of(report, "ttfr")
    hr("6. TIME TO FIRST REWARD (visits)   [%s]"
       % (sec.get("exactness", "?") if ran else "not run"))
    if not ran:
        not_run("ttfr", report)
    elif sec.get("status") != "OK":
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
        elif sec.get("percentiles_refused_reason"):
            print("\n  visits to first reward: NOT REPORTABLE")
            print("    %s" % sec["percentiles_refused_reason"])
        c = sec.get("visits_so_far_censored_members_lower_bound")
        if c:
            print("  visits so far by members who have NEVER redeemed (lower bound): "
                  "p50=%s p90=%s max=%d" % (money(c["p50"]), money(c["p90"]), c["max"]))
        print("\n  caveats:")
        show_caveats(sec)

    # ---- 7 mix -----------------------------------------------------------
    sec, ran = sec_of(report, "mix")
    hr("7. REDEMPTION MIX BY CATEGORY (feeds cost-per-reward-JOD)   [%s]"
       % (sec.get("exactness", "?") if ran else "not run"))
    if not ran:
        not_run("mix", report)
    elif sec.get("status") != "OK":
        unavailable("mix", sec)
    else:
        print("  method: %s" % sec["method"])
        print("  category map: %s" % sec["category_map_source"])
        print("\n  %-34s %7s %9s %7s %13s %13s %11s"
              % ("BUCKET", "LINES", "UNITS", "SHARE", "POSTED JOD", "COGS JOD",
                 "COGS/UNIT"))
        for b in sec["buckets"]:
            print("  %-34s %7d %9s %7s %13s %13s %11s"
                  % (b["bucket"][:34], b["reward_lines"], money(b["units"]),
                     pct(b["unit_share"], 0), money(b["posted_value_jod"]),
                     money(b["cogs_jod"]) if b["cogs_jod"] is not None else "n/a",
                     money(b["cogs_per_unit_jod"]) if b["cogs_per_unit_jod"] is not None else "n/a"))
        t = sec["totals"]
        print("  " + "-" * 74)
        print("  redemption orders: %d | displaced retail per redeeming order: %s JOD"
              % (sec["redemption_orders"], money(t["posted_per_reward_order_jod"])))
        print("  COGS per redeeming order: %s"
              % ((money(t["cogs_per_reward_order_jod"]) + " JOD")
                 if t["cogs_per_reward_order_jod"] is not None
                 else "n/a (no redeemed reward resolves to a product)"))
        print("  reward units with no rewarded product at all (discounts, catalogue "
              "choices): %s" % pct(t["units_with_no_product_share"]))
        if t["units_missing_standard_price_share"] is not None:
            print("  of the units that DO have a product, share whose standard_price = 0: "
                  "%s\n    <- the cost column is an UNDER-count by at least this share"
                  % pct(t["units_missing_standard_price_share"]))
        rv = sec.get("reward_lines_reversed_by_refund") or {}
        print("  reward lines reversed by refund (excluded): %d" % rv.get("lines", 0))
        print("\n  caveats:")
        show_caveats(sec)

    # ---- closing ---------------------------------------------------------
    hr("GATE SUMMARY")
    req = report["meta"].get("sections_requested") or ALL_SECTIONS
    avail = [k for k in req if (report["sections"].get(k) or {}).get("status") == "OK"]
    missing = [k for k in req if (report["sections"].get(k) or {}).get("status") != "OK"]
    skipped = [k for k in ALL_SECTIONS if k not in req]
    print("  measured : %s" % (", ".join(sorted(avail)) or "(none)"))
    print("  OPEN     : %s" % (", ".join(sorted(missing)) or "(none)"))
    if skipped:
        print("  not run  : %s  <- NOT open, NOT measured; this run did not ask for them"
              % ", ".join(sorted(skipped)))
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
                   help="rolling window length in days, ending today (default: 90, "
                        "minimum 1 -- a zero or negative window is rejected, not run)")
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
                   help="comma-separated subset of sections to run: %s. Sections not "
                        "requested print NOT RUN -- never a false OPEN verdict."
                        % ",".join(ALL_SECTIONS))
    o.add_argument("--verbose", action="store_true",
                   help="row-level progress notes on stderr (section-level notes are "
                        "always printed)")

    c = p.add_argument_group("connection")
    c.add_argument("--env-file", help="shell-style file supplying ODOO_URL/DB/LOGIN/API_KEY "
                                      "for any variable absent from the environment")
    c.add_argument("--timeout", type=float, default=120.0,
                   help="socket timeout per RPC in seconds (default: 120). Without a "
                        "timeout a stalled connection hangs the run for ever and the "
                        "retry loop can never fire")
    c.add_argument("--max-rows", type=int, default=250000,
                   help="hard cap on rows pulled by any single client-side fold or "
                        "paged read (default: 250000). Hitting it downgrades the "
                        "section to PARTIAL instead of silently truncating an 'EXACT' "
                        "sum")

    g = p.add_argument_group("programme scope")
    g.add_argument("--program-id", dest="program_ids", type=int, nargs="+", default=None,
                   metavar="ID",
                   help="measure these loyalty.program ids only. They must be "
                        "program_type='loyalty'. Default: every ACTIVE points "
                        "programme. Coupon, promotion, gift-card and eWallet "
                        "programmes are never measured as points")

    t = p.add_argument_group("tier calibration")
    t.add_argument("--tier-basis", choices=("active", "all"), default="active",
                   help="calibrate thresholds over ACTIVE members (>=1 order in the "
                        "window) or over ALL card holders (inactives at 0 JOD). "
                        "Default: active")
    t.add_argument("--round-to", type=float, default=5.0,
                   help="round candidate thresholds to this JOD step (default: 5)")

    v = p.add_argument_group("point value / liability")
    v.add_argument("--point-value", type=float, default=0.01,
                   help="JOD per point. Reported as an available override when "
                        "configuration does not price a point; it is NOT applied "
                        "silently and it never overrides a configured value "
                        "(default: 0.01 = 1 qirsh, the owner's unverified claim)")
    v.add_argument("--breakage-scenarios", type=float, nargs="+",
                   default=[0.3, 0.5, 0.7, 1.0],
                   help="shares of outstanding points assumed eventually redeemed "
                        "(default: 0.3 0.5 0.7 1.0)")

    k = p.add_argument_group("substitution factor k")
    k.add_argument("--trailing-visits", type=int, default=8,
                   help="visits in the trailing comparison window (default: 8, as "
                        "specified in the proposal)")
    k.add_argument("--min-prior", type=int, default=4,
                   help="minimum prior non-refund visits required to use a redemption "
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
                        "reported (default: 100; values below 2 are raised to 2, "
                        "since the estimator has no meaning on fewer)")
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
    f.add_argument("--ttfr-min-redeemers", type=int, default=30,
                   help="below this many REDEEMERS in the sample the visits-to-first-"
                        "reward percentiles are refused, not printed (default: 30). "
                        "The redeemer count and censored share are still reported")
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
    if args.k_min_sample < 2:
        warn("--k-min-sample %d raised to 2: the ratio estimator, the bootstrap and "
             "the share statistics are undefined on fewer observations."
             % args.k_min_sample)
        args.k_min_sample = 2
    if args.max_rows < 1:
        die("--max-rows must be at least 1")

    # Resolve the window BEFORE opening a connection, so a bad --from/--to or a
    # non-positive --days is reported instantly instead of after an
    # authentication round-trip.
    u_start, u_end, l_start, l_end, days = resolve_window(args)
    args.days = days

    env = load_env(args.env_file)
    odoo = Odoo(env["ODOO_URL"], env["ODOO_DB"], env["ODOO_LOGIN"], env["ODOO_API_KEY"],
                timeout=args.timeout, verbose=args.verbose)

    note("detecting capabilities ...")
    caps = detect_capabilities(odoo)
    note("reading loyalty configuration ...")
    programs = read_programs(odoo, caps)
    pctx = resolve_programs(programs, args)
    if pctx.get("status") != "OK":
        warn("points programme NOT identified: %s" % pctx.get("reason"))
    pv = derive_point_value(odoo, programs if programs.get("status") == "OK" else {},
                            pctx, args.point_value)
    members, card_meta = member_partner_ids(odoo, caps, pctx, args)

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
            "active_test": False,
            "sections_requested": wanted,
            "max_rows": args.max_rows,
            "timeout_seconds": args.timeout,
            "rpc_calls": 0,
        },
        "capabilities": caps,
        "programs": programs,
        "program_scope": pctx,
        "point_value": pv,
        "cards": card_meta,
        "sections": {},
    }
    point_value = pv.get("value")

    runners = {
        "coverage": lambda: section_coverage(odoo, caps, u_start, u_end, members, args),
        "spend": lambda: section_spend(odoo, caps, u_start, u_end, members, args),
        "redemption": lambda: section_redemption(odoo, caps, u_start, u_end, pctx,
                                                 card_meta, point_value, pv, args),
        "liability": lambda: section_liability(odoo, u_start, u_end, card_meta,
                                               point_value, pv, args),
        "k": lambda: section_k(odoo, caps, u_start, u_end, pctx, args),
        "ttfr": lambda: section_time_to_first_reward(odoo, caps, u_start, u_end, pctx,
                                                     members, args),
        "mix": lambda: section_mix(odoo, caps, u_start, u_end, pctx, args),
    }
    for name in ALL_SECTIONS:
        if name not in wanted:
            continue
        note("running section: %s" % name)
        t0 = time.time()
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
            # Plain language FIRST: an interpreter message on its own reads like a
            # measurement result, and this handler would otherwise mask a genuine
            # bug in the section as if it were a fact about the data.
            report["sections"][name] = {
                "status": "ERROR",
                "reason": ("INTERNAL ERROR in the '%s' section of this script -- this "
                           "is a fault in the measurement code, NOT a finding about "
                           "the database, and no number from this section may be "
                           "used. Every other section is unaffected. Underlying "
                           "exception: %s: %s" % (name, type(exc).__name__, exc)),
                "hint": "re-run with --verbose and --only %s to reproduce it alone" % name}
            warn("section %s failed: %s: %s" % (name, type(exc).__name__, exc))
        note("section %s finished in %.1fs (%d RPC calls so far)"
             % (name, time.time() - t0, odoo.calls))

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
