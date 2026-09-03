#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# loyalty_audit_live.py — READ-ONLY audit of the LIVE Odoo 19 loyalty configuration — Almond
# =============================================================================================
# WHY THIS EXISTS
#   The whole loyalty redesign currently rests on a VERBAL description of the live program:
#       "flat 5 points per JOD, 1 point = 1 qirsh (0.01 JOD), tiers are names only".
#   Nobody has ever read the live configuration. This script reads it and VERIFIES or
#   REFUTES that premise with evidence. It invents nothing: every number it prints is
#   either read from the live database or derived, in the open, from something it read.
#
# SAFETY (non-negotiable, and enforced in code — see SAFE_METHODS / rpc())
#   • READ-ONLY. The RPC wrapper refuses any method that is not on the read-only allow-list.
#     There is no write path in this file, no `create`, no `write`, no `unlink`, no button_*.
#   • No APPROVE PROD token is needed precisely because nothing is written.
#   • It only reads; it may be run on production at any time. It is safe to re-run.
#
# WHERE IT RUNS
#   NOT from the dev container (the egress proxy blocks *.odoo.com). Run it from a machine
#   that can reach the Odoo host, exactly like the other tools in this repo.
#
#     export SCRATCH=/path/to/dir/          # dir holding .odoo_env  (export KEY=value lines)
#     python3 loyalty_audit_live.py         # prints the full report to stdout
#     python3 loyalty_audit_live.py --json evidence.json     # also dump machine-readable evidence
#     python3 loyalty_audit_live.py --allow-slow             # permit huge local aggregations
#
#   .odoo_env (or plain environment) must provide:
#     ODOO_URL=https://ag-almond-coffee-house.odoo.com
#     ODOO_DB=ag-almond-coffee-house-master1-29151411
#     ODOO_LOGIN=...            ODOO_API_KEY=...
#
# HOW TO READ THE OUTPUT
#   Every section is headed by the QUESTION it answers. The final PREMISE CHECK block
#   states, in plain sentences, whether the verbal description survived contact with the
#   data, and lists every discrepancy. A verdict is one of:
#       VERIFIED     — the data says the premise is true
#       REFUTED      — the data says the premise is false (discrepancy is listed)
#       UNDETERMINED — the data needed to decide is absent; the script says what is missing
#   "UNDETERMINED" is a legitimate, expected outcome. It is never rounded up to VERIFIED.
#
# THE ONE THING THAT MAKES THIS AUDIT CORRECT: PROGRAM SCOPE
#   loyalty.rule / loyalty.reward / loyalty.card / loyalty.history are NOT exclusive to the
#   points programme. Odoo backs promotions, coupons, promo codes, buy-X-get-Y, GIFT CARDS
#   and eWALLETS with the very same four tables. Odoo's eWallet/gift-card templates ship a
#   rule with reward_point_mode='money', reward_point_amount=1 and a reward with
#   reward_type='discount', discount_mode='per_point', discount=1 — that is, "1 point = 1 JOD",
#   because on those programmes `points` is a CURRENCY BALANCE, not a point count.
#   Reading those tables with an empty domain therefore:
#       • injects a 1.0 pts/JOD rate next to the real 5.0     -> "earning is not flat" (false)
#       • injects a 1.0 JOD/point value next to the real 0.01 -> "a point is not a qirsh" (false)
#       • adds JOD wallet balances to qirsh point balances and multiplies the mixture by 0.01
#         -> a meaningless "liability" that the premise check then presents as a balance-sheet fact.
#   EVERY read below is scoped to the points programmes (see program_scope()). Gift-card and
#   eWallet figures are still reported — in their own clearly labelled block, in JOD, at 1:1 —
#   because that float is a real liability the owner needs to see. It is never mixed in.
#
# LIVE vs ARCHIVED
#   The client sets active_test=False so archived records are visible (an archived programme
#   is part of the history and worth printing). But a verdict about "what the live programme
#   does" may only be derived from LIVE configuration: an archived Ramadan rule at 10 pts/JOD
#   is not evidence that earning is differentiated today. Every derivation therefore keeps two
#   sets — `*_live` (drives verdicts) and the full inventory (printed, never decisive).
#
# VERSION ROBUSTNESS
#   Odoo minor versions move loyalty fields around, and Odoo 19 changed the grouping API.
#   Every field is introspected with fields_get before use; a missing field degrades to a
#   printed note, never a traceback. Aggregation tries formatted_read_group (18/19), then
#   read_group (<=17), then falls back to batched search_read + local arithmetic — and says
#   out loud why it fell back, because that fallback can cost hundreds of round trips.
#   Every section runs inside its own guard: one failing section can never suppress the
#   PREMISE CHECK block or the --json dump.
# =============================================================================================

from __future__ import annotations

import json
import os
import sys
import time
import statistics
import xmlrpc.client
from datetime import datetime, timedelta, timezone

# --------------------------------------------------------------------------- tunables
POS_WINDOW_DAYS = 90          # member-coverage window (the brief's "last 90 days")
MAX_ROWS = 400_000            # hard ceiling on rows pulled for local aggregation
BATCH = 2_000                 # rows per search_read round-trip
SLOW_SCAN_LIMIT = 50_000      # above this, a LOCAL aggregation is refused unless --allow-slow
TAX_PROBE_SAMPLE = 300        # loyalty.history rows sampled for the tax-basis probe
TAX_PROBE_MIN = 30            # hard floor: below this the tax basis is not decided at all
TAX_PROBE_FIRM = 100          # below this the verdict is printed, but flagged PROVISIONAL
TAX_PROBE_BUCKETS = 6         # sample is spread over this many id (≈time) buckets
QIRSH = 0.01                  # the premise's claimed value of one point, in JOD
CLAIMED_POINTS_PER_JOD = 5.0  # the premise's claimed earn rate

# Jordan is UTC+3 all year (no DST since 2022). Date-typed fields (loyalty.card.expiration_date,
# loyalty.program.date_from/date_to) carry a CALENDAR DAY with no timezone, and the calendar day
# that matters to the owner is the Amman one — not UTC's, which lags by three hours each night.
AMMAN = timezone(timedelta(hours=3))

# Only these methods may cross the wire. Anything else raises before it is sent.
SAFE_METHODS = {
    "search", "search_read", "search_count", "read", "fields_get",
    "read_group", "formatted_read_group", "web_read_group",
    "default_get", "check_access_rights", "get_view",
}

ALLOW_SLOW = False            # set from --allow-slow; see Odoo.agg()

# Evidence registry — every section writes here, PREMISE CHECK only reads.
# Seeded with every key the report and the --json consumers expect, so the dump has a stable
# shape even when a section degrades or fails (no consumer has to guess whether a key exists).
EV: dict = {
    "scope": None,
    "programs": None, "programs_readable": None,
    "rules": None, "rules_readable": None,
    "rewards": None, "rewards_readable": None,
    "money_rates": [], "money_rates_live": [],
    "order_rates": [], "order_rates_live": [],
    "unit_rates": [], "unit_rates_live": [],
    "rates_by_program": {},
    "per_point_values": [], "per_point_values_live": [],
    "values_by_program": {},
    "redemption_rungs": [],
    "giveback_pct": None, "giveback_by_program": {},
    "tier_signals": [],
    "cards": None, "other_cards": None,
    "history": None, "other_history": None,
    "expiry": None,
    "pos_coverage": None,
    "member_coverage": None,
    "tax_probe": None,
    "modules": [],
    "section_failures": [],
}


# ============================================================================ plumbing
def load_env() -> dict:
    """Credentials from $SCRATCH/.odoo_env (house format: `export KEY=value`), else os.environ."""
    env = {}
    path = os.environ.get("ODOO_ENV_FILE")
    if not path:
        scratch = os.environ.get("SCRATCH", "")
        if scratch:
            path = os.path.join(scratch, ".odoo_env")
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for ln in fh:
                ln = ln.strip()
                if not ln or ln.startswith("#"):
                    continue
                ln = ln.replace("export ", "", 1)
                if "=" not in ln:
                    continue
                k, v = ln.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("ODOO_URL", "ODOO_DB", "ODOO_LOGIN", "ODOO_API_KEY"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    missing = [k for k in ("ODOO_URL", "ODOO_DB", "ODOO_LOGIN", "ODOO_API_KEY") if not env.get(k)]
    if missing:
        sys.exit(
            "ABORT: missing credentials %s.\n"
            "  Provide them in $SCRATCH/.odoo_env (export KEY=value) or in the environment.\n"
            "  This script is READ-ONLY; it still needs a login to read." % ", ".join(missing)
        )
    env["ODOO_URL"] = env["ODOO_URL"].rstrip("/")
    return env


def today_amman() -> str:
    """The current CALENDAR DAY in Amman, for comparison against Odoo Date fields."""
    return datetime.now(AMMAN).strftime("%Y-%m-%d")


def utc_stamp(days_back: int = 0) -> str:
    """A UTC datetime string, for comparison against Odoo Datetime fields (create_date etc.)."""
    return (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%d %H:%M:%S")


class Odoo:
    """Minimal read-only XML-RPC client (stdlib only), with retries and a method allow-list."""

    def __init__(self, env: dict):
        self.env = env
        try:
            common = xmlrpc.client.ServerProxy(env["ODOO_URL"] + "/xmlrpc/2/common")
            self.uid = common.authenticate(env["ODOO_DB"], env["ODOO_LOGIN"], env["ODOO_API_KEY"], {})
        except Exception as exc:                                  # network / TLS / proxy
            sys.exit("ABORT: cannot reach %s — %s\n  (Odoo is not reachable from the dev "
                     "container; run this from a machine that can reach the host.)"
                     % (env["ODOO_URL"], exc))
        if not self.uid:
            sys.exit("ABORT: authentication refused for %s on db %s (check ODOO_API_KEY)."
                     % (env["ODOO_LOGIN"], env["ODOO_DB"]))
        self.models = xmlrpc.client.ServerProxy(env["ODOO_URL"] + "/xmlrpc/2/object")
        self._fields_cache: dict = {}
        self.ctx = {"active_test": False}   # see archived programs/rules/rewards too

    def rpc(self, model: str, method: str, args: list, kw: dict | None = None, tries: int = 4):
        if method not in SAFE_METHODS:
            raise RuntimeError("BLOCKED: %s.%s is not a read-only method. This script never "
                               "writes to production." % (model, method))
        kw = dict(kw or {})
        kw.setdefault("context", dict(self.ctx))
        for attempt in range(tries):
            try:
                return self.models.execute_kw(
                    self.env["ODOO_DB"], self.uid, self.env["ODOO_API_KEY"], model, method, args, kw)
            except (xmlrpc.client.Fault, xmlrpc.client.ProtocolError, OSError) as exc:
                s = str(exc)
                if "cannot marshal None" in s:
                    return None
                transient = ("503" in s or "504" in s or "Access Denied" in s
                             or "Connection" in s or "timed out" in s)
                if transient and attempt < tries - 1:
                    time.sleep(3 * (attempt + 1))
                    continue
                raise

    # ---- introspection -----------------------------------------------------
    def fields(self, model: str) -> dict:
        """fields_get, cached. Empty dict (with a printed note) if the model is absent."""
        if model in self._fields_cache:
            return self._fields_cache[model]
        try:
            got = self.rpc(model, "fields_get", [[]],
                           {"attributes": ["type", "string", "relation", "selection", "store"]}) or {}
        except Exception as exc:
            warn("model %s is not readable here (%s) — every section that needs it will say so."
                 % (model, str(exc)[:120]))
            got = {}
        self._fields_cache[model] = got
        return got

    def has(self, model: str, field: str) -> bool:
        return field in self.fields(model)

    def pick(self, model: str, wanted: list) -> tuple[list, list]:
        """Split `wanted` into (present, absent) for this deployment. Never guess a field."""
        f = self.fields(model)
        return [w for w in wanted if w in f], [w for w in wanted if w not in f]

    def label(self, model: str, field: str, value):
        """Human label for a selection value, so the report reads like the Odoo UI."""
        meta = self.fields(model).get(field) or {}
        for pair in (meta.get("selection") or []):
            if isinstance(pair, (list, tuple)) and len(pair) == 2 and pair[0] == value:
                return "%s (%s)" % (value, pair[1])
        return value

    def supports_domain(self, model: str, domain: list) -> bool:
        """Can this build evaluate this domain at all? (dotted paths, missing fields, ACLs)."""
        try:
            self.rpc(model, "search_count", [domain])
            return True
        except Exception as exc:
            warn("domain %s is not usable on %s (%s)." % (domain, model, str(exc)[:100]))
            return False

    # ---- bulk reads --------------------------------------------------------
    def read_all(self, model: str, domain: list, fields_: list, order: str | None = None,
                 cap: int = MAX_ROWS) -> tuple[list, bool]:
        """Paged search_read. Returns (rows, truncated).

        search_read is also the ONLY safe way to fetch by id: it silently drops ids that no
        longer exist or that record rules hide, where read() raises MissingError/AccessError.
        """
        out, offset = [], 0
        while True:
            kw = {"limit": min(BATCH, cap - len(out)), "offset": offset}
            if order:
                kw["order"] = order
            chunk = self.rpc(model, "search_read", [domain, fields_], kw) or []
            out.extend(chunk)
            if len(chunk) < kw["limit"] or len(out) >= cap:
                return out, len(out) >= cap
            offset += len(chunk)

    def count(self, model: str, domain: list) -> int | None:
        """Row count, or None if the count itself FAILED.

        None is not zero. Callers must distinguish them: reporting a failed count as
        "ZERO cards" turns an access-rights problem into a business conclusion.
        """
        try:
            return self.rpc(model, "search_count", [domain])
        except Exception as exc:
            warn("search_count on %s failed: %s" % (model, str(exc)[:120]))
            return None

    def agg(self, model: str, domain: list, sum_fields: list) -> dict | None:
        """SUM + COUNT over a domain, across Odoo API generations.

        Odoo 19 renamed the grouping API; try newest first, then oldest, then do the
        arithmetic locally. Returns {'__count': n, '<field>': sum, '_via': how, ...}.

        A failed server-side aggregate is ANNOUNCED, never swallowed: the local fallback
        pages the whole domain at BATCH rows per round trip, so on pos.order over a 90-day
        window (~291k orders here) it costs ~146 round trips. Paying that silently, because
        of a permissions error or an API rename, is the difference between a slow run and an
        unexplained one. Above SLOW_SCAN_LIMIT rows the fallback is REFUSED unless
        --allow-slow was passed: the figure is better reported UNMEASURED than paid for with
        a five-minute scrape whose truncation is invisible.
        """
        # 1) Odoo 18/19
        try:
            aggregates = ["__count"] + ["%s:sum" % f for f in sum_fields]
            res = self.rpc(model, "formatted_read_group", [domain, [], aggregates])
            if res:
                row = res[0]
                out = {"__count": row.get("__count", 0), "_via": "formatted_read_group"}
                for f in sum_fields:
                    out[f] = row.get("%s:sum" % f) or 0.0
                return out
        except Exception as exc:
            warn("formatted_read_group unavailable on %s (%s) — trying the older grouping API."
                 % (model, str(exc)[:110]))
        # 2) Odoo <= 17
        try:
            res = self.rpc(model, "read_group", [domain, sum_fields, []], {"lazy": False})
            if res:
                row = res[0]
                out = {"__count": row.get("__count", row.get("__domain_count", 0)), "_via": "read_group"}
                for f in sum_fields:
                    out[f] = row.get(f) or 0.0
                return out
        except Exception as exc:
            warn("read_group also unavailable on %s (%s) — falling back to a LOCAL sum, which "
                 "pulls every matching row over XML-RPC." % (model, str(exc)[:110]))
        # 3) Local fallback — always correct, just far chattier. Size it before paying for it.
        n = self.count(model, domain)
        if n is not None and n > SLOW_SCAN_LIMIT and not ALLOW_SLOW:
            warn("REFUSING to sum %s rows of %s locally (~%d XML-RPC round trips). The figure is "
                 "reported UNMEASURED rather than guessed. Re-run with --allow-slow to force it, "
                 "or grant the login access to the grouping API."
                 % ("{:,}".format(n), model, (n // BATCH) + 1))
            out = {"__count": n, "_via": "REFUSED (local scan above --allow-slow threshold)",
                   "_unmeasured": True}
            for f in sum_fields:
                out[f] = None
            return out
        rows, truncated = self.read_all(model, domain, sum_fields)
        out = {"__count": len(rows), "_via": "local sum over search_read"}
        if truncated:
            out["_truncated"] = True
            warn("aggregation over %s hit the %d-row ceiling; sums below are a LOWER BOUND and "
                 "must not be compared against a sum that did NOT truncate." % (model, MAX_ROWS))
        for f in sum_fields:
            out[f] = sum((r.get(f) or 0.0) for r in rows)
        return out


# ============================================================================ printing
_W = 92


def head(question: str, title: str) -> None:
    print("\n" + "=" * _W)
    print("QUESTION: " + question)
    print("SECTION : " + title)
    print("=" * _W)


def sub(text: str) -> None:
    print("\n-- %s %s" % (text, "-" * max(0, _W - len(text) - 4)))


def kv(key: str, value) -> None:
    print("   %-38s %s" % (key + ":", value))


def warn(text: str) -> None:
    print("   [!] " + text)


def gap(text: str) -> None:
    """A field/model this deployment does not have. A gap is a finding, not an error."""
    print("   [GAP] " + text)


def derive(text: str) -> None:
    print("   [DERIVED] " + text)


def fmt(x, nd: int = 2):
    if x is None:
        return "—"
    if isinstance(x, bool):
        return "yes" if x else "no"
    if isinstance(x, float):
        return ("%%.%df" % nd) % x
    return x


def m2o(v):
    """[id, name] -> 'name (id)'; False -> '—'."""
    if isinstance(v, (list, tuple)) and len(v) == 2:
        return "%s (id=%s)" % (v[1], v[0])
    return "—" if v in (False, None) else v


def m2o_id(v):
    """[id, name] -> id; anything else -> None."""
    if isinstance(v, (list, tuple)) and v:
        return v[0]
    if isinstance(v, int) and v:
        return v
    return None


# ============================================================================ program scope
def program_is_live(p: dict, today: str) -> tuple[bool, list]:
    """Is this programme running TODAY (Amman)? Returns (live, reasons_it_is_not)."""
    reasons = []
    if not p.get("active", True):
        reasons.append("archived (active=False)")
    df, dt = p.get("date_from"), p.get("date_to")
    if dt and str(dt)[:10] < today:
        reasons.append("date_to %s has passed" % str(dt)[:10])
    if df and str(df)[:10] > today:
        reasons.append("date_from %s is in the future" % str(df)[:10])
    return (not reasons), reasons


def program_scope(o: Odoo, programs: list) -> dict:
    """Partition the programmes into POINTS programmes and everything else.

    This is the single most load-bearing function in the file: every rule/reward/card/history
    read below is filtered through it. See the header note "THE ONE THING THAT MAKES THIS
    AUDIT CORRECT". Degrades loudly — never silently — when program_type cannot be read.
    """
    today = today_amman()
    scope = {"mode": "scoped", "today_amman": today,
             "points_ids": [], "live_points_ids": [], "other_ids": [], "other_by_type": {}}

    if not programs:
        scope["mode"] = "unscoped-no-programs"
        gap("No loyalty.program rows could be read, so rules/rewards/cards/history CANNOT be "
            "scoped to the points programme. Everything below is read UNFILTERED and may mix "
            "gift-card / eWallet rows into the point figures. Treat every derived number in "
            "this run as contaminated until the programme list is readable.")
        return scope

    if not any("program_type" in p for p in programs):
        scope["mode"] = "unscoped-no-type"
        gap("loyalty.program.program_type is not readable on this build, so points programmes "
            "cannot be separated from gift-card / eWallet / promotion programmes. Reads below "
            "are UNFILTERED; rates, point values and liabilities may be contaminated.")
        return scope

    for p in programs:
        ptype = p.get("program_type")
        if ptype == "loyalty":
            scope["points_ids"].append(p["id"])
            live, _ = program_is_live(p, today)
            if live:
                scope["live_points_ids"].append(p["id"])
        else:
            scope["other_ids"].append(p["id"])
            scope["other_by_type"].setdefault(ptype or "unknown", []).append(p["id"])

    sub("PROGRAMME SCOPE — which programmes count as 'the points programme'")
    kv("today (Asia/Amman)", today)
    kv("points programmes (program_type='loyalty')", scope["points_ids"] or "none")
    kv("  of those, LIVE today", scope["live_points_ids"] or "none")
    kv("other programmes on this database", scope["other_ids"] or "none")
    for t, ids in sorted(scope["other_by_type"].items()):
        kv("  program_type=%s" % t, ids)
    if scope["other_ids"]:
        derive("Those %d non-points programme(s) share loyalty.rule / loyalty.reward / "
               "loyalty.card / loyalty.history with the points programme. On gift_card and "
               "ewallet programmes `points` is a JOD BALANCE, and their template reward is "
               "1 JOD per point. They are read and reported separately below, never mixed."
               % len(scope["other_ids"]))
    if not scope["points_ids"]:
        warn("No programme of program_type='loyalty' exists. There is no points programme on "
             "this database — the premise describes something that is not here.")
    return scope


def scope_domain(scope: dict, ids_key: str = "points_ids", field: str = "program_id") -> list:
    """Domain restricting a model to the chosen programme set (or [] when scoping failed)."""
    if scope.get("mode", "").startswith("unscoped"):
        return []
    return [[field, "in", scope.get(ids_key) or []]]


def scope_note(scope: dict) -> str:
    return ("UNFILTERED (scoping unavailable — see the GAP above)"
            if scope.get("mode", "").startswith("unscoped")
            else "scoped to program_type='loyalty'")


# ============================================================================ Q1 programs
def report_programs(o: Odoo) -> list:
    head("What loyalty programs actually exist on the live system, and are they live?",
         "loyalty.program")
    wanted = ["name", "program_type", "applies_on", "trigger", "portal_visible", "portal_point_name",
              "active", "company_id", "currency_id", "date_from", "date_to", "pos_ok", "sale_ok",
              "pos_config_ids", "limit_usage", "max_usage", "coupon_count", "total_order_count",
              "pricelist_ids", "rule_ids", "reward_ids"]
    present, absent = o.pick("loyalty.program", wanted)
    if not present:
        gap("loyalty.program is not installed or not readable. The loyalty module may be absent; "
            "everything below will be empty. STOP and check the login's access rights.")
        EV["programs"], EV["programs_readable"] = [], False
        return []
    if absent:
        gap("loyalty.program has no field(s): %s — not reported (this Odoo build differs)."
            % ", ".join(absent))

    rows, _ = o.read_all("loyalty.program", [], present + ["id"], order="id")
    EV["programs"], EV["programs_readable"] = rows, True
    kv("programs found (incl. archived)", len(rows))
    if not rows:
        warn("ZERO loyalty programs exist. The premise describes a program that is not here.")
        return rows

    today = today_amman()
    for p in rows:
        sub("program id=%s — %s" % (p["id"], p.get("name")))
        for f in ("program_type", "applies_on", "trigger"):
            if f in p:
                kv(f, o.label("loyalty.program", f, p[f]))
        for f in ("active", "portal_visible", "portal_point_name", "pos_ok", "sale_ok",
                  "limit_usage", "max_usage", "coupon_count", "total_order_count"):
            if f in p:
                kv(f, fmt(p[f]))
        for f in ("company_id", "currency_id"):
            if f in p:
                kv(f, m2o(p[f]))
        if "date_from" in p or "date_to" in p:
            kv("date range", "%s → %s" % (p.get("date_from") or "open", p.get("date_to") or "open"))
        live, why = program_is_live(p, today)
        kv("running today (Asia/Amman)", "yes" if live else "no — " + "; ".join(why))
        if "pos_config_ids" in p:
            ids = p.get("pos_config_ids") or []
            kv("pos_config_ids", "%s  %s" % (ids or "[]",
               "(EMPTY = available on ALL POS in Odoo semantics)" if not ids else ""))
        if "pricelist_ids" in p:
            kv("pricelist_ids", p.get("pricelist_ids") or "[] (no pricelist restriction)")
        kv("rules / rewards", "%d rule(s), %d reward(s)"
           % (len(p.get("rule_ids") or []), len(p.get("reward_ids") or [])))

    actives = [p for p in rows if p.get("active", True)]
    loyalty_type = [p for p in actives if p.get("program_type") == "loyalty"]
    kv("ACTIVE programs", len(actives))
    kv("ACTIVE of program_type='loyalty'", len(loyalty_type))
    if len(loyalty_type) > 1:
        derive("More than one ACTIVE points program exists. Multiple concurrent programs are one "
               "way a tier/multiplier could be implemented — see the TIER section.")
    return rows


# ============================================================================ Q2 rules
def report_rules(o: Odoo, programs: list, scope: dict) -> list:
    head("At what rate are points earned, and on what basis (per order / per JOD / per unit)?",
         "loyalty.rule (points programmes only) — and the DERIVED effective points-per-JOD")
    wanted = ["program_id", "active", "reward_point_amount", "reward_point_mode", "reward_point_split",
              "minimum_amount", "minimum_amount_tax_mode", "minimum_qty", "mode", "code",
              "product_ids", "product_category_id", "product_tag_id", "product_domain"]
    present, absent = o.pick("loyalty.rule", wanted)
    if not present:
        gap("loyalty.rule is not readable — the earn rate CANNOT be verified from here.")
        # Keep the evidence registry's contract: every consumer below reads these keys.
        EV["rules"], EV["rules_readable"] = [], False
        EV["money_rates"] = EV["money_rates_live"] = []
        EV["order_rates"] = EV["order_rates_live"] = []
        EV["unit_rates"] = EV["unit_rates_live"] = []
        EV["rates_by_program"] = {}
        return []
    if absent:
        gap("loyalty.rule has no field(s): %s — not reported." % ", ".join(absent))

    kv("read domain", scope_note(scope))
    rows, _ = o.read_all("loyalty.rule", scope_domain(scope), present + ["id"],
                         order="program_id, id")
    EV["rules"], EV["rules_readable"] = rows, True
    kv("rules on points programmes (incl. archived)", len(rows))
    prog_by_id = {p["id"]: p for p in programs}
    today = today_amman()

    money_rates, per_order_rates, unit_rates = [], [], []
    money_live, order_live, unit_live = [], [], []
    rates_by_program: dict = {}

    for r in rows:
        pid = m2o_id(r.get("program_id"))
        prog = prog_by_id.get(pid, {})
        prog_live, prog_why = program_is_live(prog, today) if prog else (True, [])
        rule_live = bool(r.get("active", True)) and prog_live
        sub("rule id=%s  (program: %s)" % (r["id"], m2o(r.get("program_id"))))
        kv("program active / type", "%s / %s" % (fmt(prog.get("active", "?")),
                                                 prog.get("program_type", "?")))
        kv("counts toward the LIVE verdict", "yes" if rule_live else
           "NO — " + "; ".join((["rule active=False"] if not r.get("active", True) else []) + prog_why))
        for f in ("active", "reward_point_amount", "reward_point_split", "minimum_amount",
                  "minimum_qty", "code"):
            if f in r:
                kv(f, fmt(r[f]))
        for f in ("reward_point_mode", "minimum_amount_tax_mode", "mode"):
            if f in r:
                kv(f, o.label("loyalty.rule", f, r[f]))
        prods = r.get("product_ids") or []
        kv("product_ids", "%d product(s)%s" % (len(prods), "" if prods else "  (EMPTY = all products)"))
        for f in ("product_category_id", "product_tag_id"):
            if f in r:
                kv(f, m2o(r[f]))
        if r.get("product_domain") and r["product_domain"] not in ("[]", False):
            kv("product_domain", r["product_domain"])

        mode = r.get("reward_point_mode")
        amount = r.get("reward_point_amount")
        if mode == "money" and amount is not None:
            money_rates.append(amount)
            if rule_live:
                money_live.append(amount)
                rates_by_program.setdefault(pid, []).append(amount)
            derive("EFFECTIVE EARN = %s point(s) per 1 JOD of qualifying spend "
                   "(reward_point_mode='money' multiplies the rate by the money amount).%s"
                   % (fmt(amount), "" if rule_live else "  [ARCHIVED / not running — inventory only]"))
            tax_mode = r.get("minimum_amount_tax_mode")
            if "minimum_amount_tax_mode" in r:
                kv("minimum_amount_tax_mode", o.label("loyalty.rule", "minimum_amount_tax_mode", tax_mode))
                derive("NOTE: minimum_amount_tax_mode ('%s') governs the ELIGIBILITY THRESHOLD "
                       "(minimum_amount) ONLY. It does NOT state the basis used to multiply the "
                       "points. The basis is probed empirically in the TAX BASIS section." % tax_mode)
            else:
                gap("minimum_amount_tax_mode absent — the threshold's tax basis is unknown.")
        elif mode == "order" and amount is not None:
            per_order_rates.append(amount)
            if rule_live:
                order_live.append(amount)
            derive("EFFECTIVE EARN = %s point(s) per ORDER, independent of basket value. "
                   "Points-per-JOD is therefore NOT constant: on the measured average invoice "
                   "it is a function of invoice size, not a rate." % fmt(amount))
        elif mode == "unit" and amount is not None:
            unit_rates.append(amount)
            if rule_live:
                unit_live.append(amount)
            derive("EFFECTIVE EARN = %s point(s) per QUALIFYING UNIT (item), not per JOD."
                   % fmt(amount))
        elif amount is not None:
            gap("reward_point_mode=%r is not one of money/order/unit — cannot derive a rate." % mode)

    EV["money_rates"] = sorted(set(money_rates))
    EV["order_rates"] = sorted(set(per_order_rates))
    EV["unit_rates"] = sorted(set(unit_rates))
    EV["money_rates_live"] = sorted(set(money_live))
    EV["order_rates_live"] = sorted(set(order_live))
    EV["unit_rates_live"] = sorted(set(unit_live))
    EV["rates_by_program"] = {k: sorted(set(v)) for k, v in rates_by_program.items()}

    sub("DERIVED SUMMARY — earn rates (LIVE configuration drives every verdict)")
    kv("LIVE money-mode rates (pts per JOD)", EV["money_rates_live"] or "none")
    kv("LIVE order-mode rates (pts per order)", EV["order_rates_live"] or "none")
    kv("LIVE unit-mode rates (pts per item)", EV["unit_rates_live"] or "none")
    kv("all rates incl. archived (inventory)", EV["money_rates"] or "none")
    kv("rates per live programme", EV["rates_by_program"] or "none")
    archived_only = sorted(set(EV["money_rates"]) - set(EV["money_rates_live"]))
    if archived_only:
        derive("NOTE (not a discrepancy): archived / expired rule(s) earned at %s pts/JOD. That "
               "is history, not current differentiation, and it is excluded from every verdict."
               % archived_only)
    if len(EV["money_rates_live"]) > 1:
        derive("MORE THAN ONE LIVE money-mode rate exists (%s). The programme is NOT flat — "
               "different baskets/products/programmes earn at different rates today."
               % EV["money_rates_live"])
    elif len(EV["money_rates_live"]) == 1:
        derive("A SINGLE LIVE money-mode rate exists: %s point(s) per JOD."
               % fmt(EV["money_rates_live"][0]))

    # --- the same table, for everything that is NOT the points programme -----
    if scope.get("other_ids"):
        sub("OTHER PROGRAMMES ON THIS DATABASE — their rules, reported separately, never mixed")
        others, _ = o.read_all("loyalty.rule", scope_domain(scope, "other_ids"),
                               present + ["id"], order="program_id, id")
        kv("rules on non-points programmes", len(others))
        for r in others:
            pid = m2o_id(r.get("program_id"))
            kv("  rule id=%s (%s)" % (r["id"], (prog_by_id.get(pid) or {}).get("program_type", "?")),
               "%s = %s, program %s" % (r.get("reward_point_mode"),
                                        fmt(r.get("reward_point_amount")),
                                        m2o(r.get("program_id"))))
        if others:
            derive("These rates are REAL but they belong to gift-card / eWallet / promotion "
                   "programmes. An eWallet's 'money 1.0' rule means 1 JOD topped up = 1 unit of "
                   "balance — it is not an earn rate for the points programme, and including it "
                   "would falsely refute 'earning is flat'.")
    return rows


# ============================================================================ Q3 rewards
def report_rewards(o: Odoo, programs: list, scope: dict) -> list:
    head("What can points be exchanged for, and what is ONE point worth in JOD?",
         "loyalty.reward (points programmes only) — and the DERIVED JOD value of one point")
    wanted = ["program_id", "active", "description", "reward_type", "discount", "discount_mode",
              "discount_applicability", "discount_max_amount", "required_points", "point_name",
              "reward_product_id", "reward_product_ids", "reward_product_qty", "clear_wallet",
              "discount_product_ids", "discount_product_category_id"]
    present, absent = o.pick("loyalty.reward", wanted)
    if not present:
        gap("loyalty.reward is not readable — the value of a point CANNOT be derived from here.")
        EV["rewards"], EV["rewards_readable"] = [], False
        EV["per_point_values"] = EV["per_point_values_live"] = []
        EV["values_by_program"] = {}
        return []
    if absent:
        gap("loyalty.reward has no field(s): %s — not reported." % ", ".join(absent))

    kv("read domain", scope_note(scope))
    rows, _ = o.read_all("loyalty.reward", scope_domain(scope), present + ["id"],
                         order="program_id, id")
    EV["rewards"], EV["rewards_readable"] = rows, True
    kv("rewards on points programmes (incl. archived)", len(rows))
    prog_by_id = {p["id"]: p for p in programs}
    today = today_amman()

    per_point_values, per_point_live, rung_values = [], [], []
    values_by_program: dict = {}

    for w in rows:
        sub("reward id=%s  (program: %s)" % (w["id"], m2o(w.get("program_id"))))
        pid = m2o_id(w.get("program_id"))
        prog = prog_by_id.get(pid, {})
        prog_live, prog_why = program_is_live(prog, today) if prog else (True, [])
        rw_live = bool(w.get("active", True)) and prog_live
        kv("program active", fmt(prog.get("active", "?")))
        kv("counts toward the LIVE verdict", "yes" if rw_live else
           "NO — " + "; ".join((["reward active=False"] if not w.get("active", True) else []) + prog_why))
        if "description" in w:
            kv("description", w.get("description"))
        for f in ("reward_type", "discount_mode", "discount_applicability"):
            if f in w:
                kv(f, o.label("loyalty.reward", f, w[f]))
        for f in ("active", "discount", "required_points", "discount_max_amount",
                  "reward_product_qty", "point_name", "clear_wallet"):
            if f in w:
                kv(f, fmt(w[f]))
        for f in ("reward_product_id", "discount_product_category_id"):
            if f in w:
                kv(f, m2o(w[f]))
        if "reward_product_ids" in w:
            kv("reward_product_ids", len(w.get("reward_product_ids") or []))
        if "discount_product_ids" in w:
            kv("discount_product_ids", len(w.get("discount_product_ids") or []))

        rtype, dmode = w.get("reward_type"), w.get("discount_mode")
        disc, req = w.get("discount"), w.get("required_points")
        if rtype == "discount" and dmode == "per_point" and disc:
            per_point_values.append(disc)
            if rw_live:
                per_point_live.append(disc)
                values_by_program.setdefault(pid, []).append(disc)
            derive("ONE POINT = %.4f JOD (discount_mode='per_point': `discount` IS the currency "
                   "amount granted per point). => %s points = 1 JOD.%s"
                   % (disc, fmt(1.0 / disc, 1),
                      "" if rw_live else "  [ARCHIVED / not running — inventory only]"))
            if abs(disc - QIRSH) < 1e-9:
                derive("This equals exactly 1 qirsh (0.01 JOD) — matches the verbal premise.")
            else:
                derive("This is NOT 1 qirsh. Premise value 0.01 JOD vs live %.4f JOD "
                       "(ratio %.2fx)." % (disc, disc / QIRSH))
        elif rtype == "discount" and dmode == "per_order" and req:
            rung_values.append((req, disc))
            derive("REDEMPTION RUNG: %s points buy a %.3f JOD order discount "
                   "=> implied %.4f JOD per point." % (fmt(req, 0), disc or 0.0,
                                                       (disc or 0.0) / req if req else 0.0))
        elif rtype == "discount" and dmode == "percent":
            derive("PERCENT discount reward (%s%% off %s) — a point has no fixed JOD value here; "
                   "its value depends on basket size." % (fmt(disc), w.get("discount_applicability")))
        elif rtype == "product":
            derive("FREE-PRODUCT reward for %s points. JOD value of a point depends on the "
                   "product's price/cost — not derivable from the loyalty tables alone." % fmt(req, 0))

    EV["per_point_values"] = sorted(set(per_point_values))
    EV["per_point_values_live"] = sorted(set(per_point_live))
    EV["redemption_rungs"] = sorted(rung_values)
    EV["values_by_program"] = {k: sorted(set(v)) for k, v in values_by_program.items()}

    sub("DERIVED SUMMARY — value of a point (LIVE configuration drives every verdict)")
    kv("LIVE per_point JOD values", EV["per_point_values_live"] or "none found")
    kv("all per_point values incl. archived", EV["per_point_values"] or "none found")
    kv("per-point value by live programme", EV["values_by_program"] or "none")
    kv("per_order rungs (points, JOD)", EV["redemption_rungs"] or "none found")
    archived_only = sorted(set(EV["per_point_values"]) - set(EV["per_point_values_live"]))
    if archived_only:
        derive("NOTE (not a discrepancy): archived reward(s) priced a point at %s JOD. Excluded "
               "from the verdict." % archived_only)
    if not per_point_values and not rung_values:
        gap("No reward prices a point in JOD (no per_point and no per_order rung). The claim "
            "'1 point = 1 qirsh' cannot be confirmed from configuration — it may live only in "
            "the app/BFF, or in staff convention.")

    # --- headline giveback, paired WITHIN a programme ------------------------
    # Points earned on programme A cannot be redeemed on programme B, so a rate from one
    # programme must never be multiplied by a point value from another. The pairing is done
    # per program_id; a cross-programme product would be a fiction.
    sub("DERIVED — headline giveback, paired within each live points programme")
    giveback = {}
    for pid in (scope.get("live_points_ids") or list(EV["rates_by_program"].keys())):
        rates = EV["rates_by_program"].get(pid) or []
        vals = EV["values_by_program"].get(pid) or []
        pname = (prog_by_id.get(pid) or {}).get("name", pid)
        if not rates or not vals:
            kv("  programme %s" % pname,
               "cannot pair (%d live rate(s), %d live per-point value(s))" % (len(rates), len(vals)))
            continue
        lo = min(rates) * min(vals) * 100.0
        hi = max(rates) * max(vals) * 100.0
        giveback[pid] = {"name": pname, "rates": rates, "values": vals, "pct_min": lo, "pct_max": hi}
        if abs(hi - lo) < 1e-9:
            kv("  programme %s" % pname, "%s pts/JOD x %.4f JOD/pt = %.2f%% of qualifying spend"
               % (fmt(rates[0]), vals[0], lo))
        else:
            kv("  programme %s" % pname, "%.2f%% – %.2f%% of qualifying spend (several live "
               "rates/values on this programme)" % (lo, hi))
    EV["giveback_by_program"] = giveback
    if len(giveback) == 1:
        only = list(giveback.values())[0]
        if abs(only["pct_max"] - only["pct_min"]) < 1e-9:
            EV["giveback_pct"] = only["pct_min"]
            derive("HEADLINE GIVEBACK = %.2f%% of qualifying spend returned as points, on the "
                   "single live points programme." % EV["giveback_pct"])
        else:
            derive("Giveback is a RANGE (%.2f%%–%.2f%%) even within one programme; no single "
                   "headline number is honest here." % (only["pct_min"], only["pct_max"]))
    elif len(giveback) > 1:
        derive("%d live points programmes each have their own giveback; there is no single "
               "headline figure. See the per-programme lines above." % len(giveback))
    else:
        gap("No live points programme has BOTH an earn rate and a per-point value, so the "
            "headline giveback cannot be derived from configuration.")

    # --- the same table, for everything that is NOT the points programme -----
    if scope.get("other_ids"):
        sub("OTHER PROGRAMMES ON THIS DATABASE — their rewards, reported separately")
        others, _ = o.read_all("loyalty.reward", scope_domain(scope, "other_ids"),
                               present + ["id"], order="program_id, id")
        kv("rewards on non-points programmes", len(others))
        other_vals = {}
        for w in others:
            pid = m2o_id(w.get("program_id"))
            ptype = (prog_by_id.get(pid) or {}).get("program_type", "?")
            kv("  reward id=%s (%s)" % (w["id"], ptype),
               "%s / %s, discount=%s, required_points=%s, clear_wallet=%s"
               % (w.get("reward_type"), w.get("discount_mode"), fmt(w.get("discount"), 4),
                  fmt(w.get("required_points")), fmt(w.get("clear_wallet"))))
            if w.get("reward_type") == "discount" and w.get("discount_mode") == "per_point" and w.get("discount"):
                other_vals.setdefault(pid, []).append(w["discount"])
        EV["values_by_program"].update({k: sorted(set(v)) for k, v in other_vals.items()})
        if other_vals:
            derive("On these programmes 'discount per point' is typically 1.0 — i.e. the card's "
                   "`points` field IS a JOD balance. That is exactly why their balances must "
                   "never be added to point balances, nor multiplied by 0.01.")
    return rows


# ============================================================================ Q4 tiers
def report_tier_mechanism(o: Odoo, programs: list, rules: list) -> None:
    head("Does ANY tier / multiplier mechanism exist on the live system, "
         "or are tiers just names? (THE CORE QUESTION)",
         "programs x rates x partner tags x custom fields")
    signals = []

    sub("Signal 1 — multiple concurrent points programs")
    actives = [p for p in programs if p.get("active", True) and p.get("program_type") == "loyalty"]
    kv("active program_type='loyalty' count", len(actives))
    for p in actives:
        kv("  · " + str(p.get("name")), "id=%s" % p["id"])
    if len(actives) > 1:
        signals.append("multiple active points programs (%d) — a customer could be earning on "
                       "several at once, which is how a manual tier is usually faked" % len(actives))

    sub("Signal 2 — different earn rates between LIVE rules of the points programme")
    # Only live rules of points programmes count here. Reading every rule in the database
    # (an archived promo, an eWallet's 'money 1.0' template rule) would manufacture this signal
    # out of nothing — which is the failure this section exists to avoid.
    kv("LIVE money-mode rates", EV.get("money_rates_live") or "none")
    kv("(archived / other-programme rates, for context)", EV.get("money_rates") or "none")
    if len(EV.get("money_rates_live") or []) > 1:
        signals.append("LIVE rules carry DIFFERENT money-mode rates %s — rate differentiation "
                       "exists in the running configuration" % EV["money_rates_live"])

    sub("Signal 3 — rules restricted by product / category / tag / domain")
    restricted = []
    for r in rules:
        if not r.get("active", True):
            continue
        if (r.get("product_ids") or r.get("product_category_id") or r.get("product_tag_id")
                or (r.get("product_domain") not in (None, False, "[]"))):
            restricted.append(r["id"])
    kv("LIVE rules with a product restriction", "%d %s" % (len(restricted), restricted or ""))
    if restricted:
        signals.append("%d live rule(s) are product/category restricted — earn is not uniform "
                       "across the menu" % len(restricted))

    sub("Signal 4 — programs restricted by pricelist (a common tier proxy)")
    if o.has("loyalty.program", "pricelist_ids"):
        pl = [(p["id"], p.get("pricelist_ids")) for p in programs
              if p.get("pricelist_ids") and p.get("active", True)
              and p.get("program_type") in (None, "loyalty")]
        kv("active points programs with pricelist_ids", pl or "none")
        if pl:
            signals.append("program(s) %s are limited to specific pricelists — that is a customer "
                           "segmentation mechanism" % [x[0] for x in pl])
    else:
        gap("loyalty.program.pricelist_ids absent on this build — signal not testable.")

    sub("Signal 5 — partner tags / categories that could drive eligibility")
    if o.fields("res.partner.category"):
        cats, _ = o.read_all("res.partner.category", [], ["name"], cap=500)
        kv("res.partner.category (tags) defined", len(cats))
        tierish = [c for c in cats if any(t in (c.get("name") or "").lower() for t in
                   ("tier", "gold", "silver", "black", "bean", "vip", "ذهب", "فض", "عضو"))]
        for c in cats[:40]:
            n = o.count("res.partner", [["category_id", "=", c["id"]]])
            flag = "   <-- tier-shaped name" if c in tierish else ""
            kv("  tag '%s'" % c.get("name"), "%s partner(s)%s"
               % ("UNKNOWN (count failed)" if n is None else n, flag))
        if len(cats) > 40:
            warn("only the first 40 tags listed (of %d)." % len(cats))
        if tierish:
            signals.append("partner tag(s) with tier-shaped names exist: %s — check whether staff "
                           "use them manually" % [c.get("name") for c in tierish])
        derive("Odoo's loyalty.rule has NO partner-tag condition field. Even if these tags exist, "
               "the loyalty engine CANNOT read them: any tier they represent is enforced by "
               "humans or by custom code, not by the program.")
    else:
        gap("res.partner.category not readable — partner-tag signal not testable.")

    sub("Signal 6 — custom tier/multiplier fields added to loyalty or partner models")
    needles = ("tier", "level", "grade", "multiplier", "rank", "segment")
    for model in ("loyalty.card", "loyalty.program", "loyalty.rule", "res.partner"):
        f = o.fields(model)
        if not f:
            continue
        hits = sorted(n for n in f
                      if any(k in n.lower() for k in needles)
                      and (n.startswith("x_") or "almond" in n.lower()
                           or any(k in n.lower() for k in ("tier", "multiplier", "grade"))))
        kv("%s custom tier-ish fields" % model, hits or "none")
        if hits:
            signals.append("model %s carries field(s) %s — a custom tier mechanism may be "
                           "installed" % (model, hits))

    sub("Signal 7 — loyalty-related custom modules installed")
    if o.fields("ir.module.module"):
        try:
            mods, _ = o.read_all("ir.module.module",
                                 ["&", ["state", "=", "installed"],
                                  "|", "|", ["name", "ilike", "loyalty"],
                                  ["name", "ilike", "almond"], ["name", "ilike", "pos_loyalty"]],
                                 ["name", "shortdesc", "author"], cap=200)
            for m in mods:
                kv("  module " + m["name"], m.get("shortdesc"))
            EV["modules"] = [m["name"] for m in mods]
            custom = [m["name"] for m in mods if "almond" in m["name"].lower()]
            if custom:
                signals.append("custom module(s) %s are installed and may alter earn behaviour — "
                               "read their code before trusting the configuration alone" % custom)
        except Exception as exc:
            gap("ir.module.module not readable (%s)." % str(exc)[:80])
    else:
        gap("ir.module.module not readable — installed-module signal not testable.")

    EV["tier_signals"] = signals
    sub("VERDICT INPUT — tier mechanism")
    if signals:
        for i, s in enumerate(signals, 1):
            print("   %d. %s" % (i, s))
    else:
        print("   No tier/multiplier signal of any kind was found in the live configuration.")


# ============================================================================ Q5 cards
def _point_value_for(pid, fallback: list):
    """The JOD value of one point on programme `pid` — never borrowed from another programme."""
    vals = (EV.get("values_by_program") or {}).get(pid) or []
    if vals:
        # Several live per-point rewards on one programme: price the liability at the most
        # expensive one. Under-stating a liability is the more dangerous error.
        return max(vals), (len(vals) > 1)
    if len(fallback) == 1:
        return fallback[0], False
    return None, False


def _liability(o: Odoo, prog_ids: list, extra_domain: list, fallback_vals: list) -> dict:
    """Sum points per programme and price each programme at ITS OWN point value."""
    total, priced, unpriced, rows = 0.0, 0.0, [], []
    for pid in prog_ids:
        dom = [["program_id", "=", pid]] + extra_domain
        a = o.agg("loyalty.card", dom, ["points"]) or {}
        pts = a.get("points")
        if a.get("_unmeasured") or pts is None:
            unpriced.append((pid, None, "points not measured"))
            continue
        val, multi = _point_value_for(pid, fallback_vals)
        if val is None:
            unpriced.append((pid, pts, "no per-point JOD value on this programme"))
            continue
        total += pts * val
        priced += pts
        rows.append((pid, pts, val, pts * val, multi))
    return {"jod": total, "points_priced": priced, "unpriced": unpriced, "rows": rows}


def report_cards(o: Odoo, programs: list, scope: dict) -> None:
    head("How many loyalty cards exist and what is the outstanding point liability?",
         "loyalty.card population (points programmes only)")
    if not o.fields("loyalty.card"):
        gap("loyalty.card not readable — population and liability unknown.")
        EV["cards"] = None
        return
    present, absent = o.pick("loyalty.card", ["points", "partner_id", "program_id", "create_date",
                                              "expiration_date", "code", "points_display"])
    if absent:
        gap("loyalty.card has no field(s): %s." % ", ".join(absent))

    dom = scope_domain(scope)
    kv("read domain", scope_note(scope))
    total = o.count("loyalty.card", dom)
    if total is None:
        gap("loyalty.card count could not be read (RPC / access-rights failure) — the card "
            "population is UNKNOWN, which is NOT the same as zero. Re-run with read access to "
            "loyalty.card before drawing any conclusion about enrolment.")
        EV["cards"] = None
        return
    kv("loyalty.card records (points programmes)", total)
    if not total:
        warn("ZERO cards on the points programme(s). Either nobody has ever enrolled, or cards "
             "live elsewhere.")
        EV["cards"] = {"count": 0}
        _report_other_cards(o, programs, scope)
        return

    prog_by_id = {p["id"]: p for p in programs}
    today = today_amman()
    stats = {"count": total, "scope": scope.get("mode")}
    if "points" in present:
        a = o.agg("loyalty.card", dom, ["points"]) or {}
        kv("sum of points (points programmes)", fmt(a.get("points"), 2))
        kv("  aggregation method", a.get("_via"))
        stats["sum_points"] = a.get("points")
        stats["sum_truncated"] = bool(a.get("_truncated") or a.get("_unmeasured"))
        pos_n = o.count("loyalty.card", dom + [["points", ">", 0]])
        stats["positive"] = pos_n
        kv("cards with points > 0", "UNKNOWN (count failed)" if pos_n is None else
           "%s  (%.1f%% of cards)" % (pos_n, 100.0 * pos_n / total))
        rows, truncated = o.read_all("loyalty.card", dom, ["points"])
        vals = sorted((r.get("points") or 0.0) for r in rows)
        if truncated:
            warn("card sample truncated at %d rows — min/max/median are over the sample." % MAX_ROWS)
        if vals:
            stats.update(min=vals[0], max=vals[-1], median=statistics.median(vals),
                         mean=statistics.fmean(vals))
            kv("min / median / mean / max points",
               "%s / %s / %s / %s" % (fmt(vals[0]), fmt(stats["median"]),
                                      fmt(stats["mean"]), fmt(vals[-1])))
            pos = [v for v in vals if v > 0]
            if pos:
                kv("median points among cards > 0", fmt(statistics.median(pos)))

        # --- liability: GROSS and NET ------------------------------------------------
        # Odoo does NOT zero a card when it expires — expiration_date is applied as a filter
        # when usable cards are selected at earn/redeem time. So points sitting on an expired
        # card are normal, and they are NOT money the business owes. Both figures are printed:
        # gross (everything ever awarded and unspent) and net (what a redesign must actually
        # fund). Each programme is priced at its own per-point value; no cross-programme mixing.
        sub("OUTSTANDING LIABILITY — gross vs net")
        fallback = EV.get("per_point_values_live") or []
        pids = scope.get("points_ids") or [p["id"] for p in programs]
        gross = _liability(o, pids, [], fallback)
        stats["liability_gross_jod"] = gross["jod"]
        for pid, pts, val, jod, multi in gross["rows"]:
            kv("  gross · %s" % (prog_by_id.get(pid, {}).get("name", pid)),
               "%s points x %.4f JOD/pt = %.2f JOD%s"
               % (fmt(pts), val, jod, "  (several per-point rewards; priced at the highest)" if multi else ""))
        for pid, pts, why in gross["unpriced"]:
            gap("programme %s holds %s points that CANNOT be priced: %s."
                % (prog_by_id.get(pid, {}).get("name", pid), fmt(pts), why))
        kv("GROSS liability (all points cards)", "%.2f JOD" % gross["jod"])

        live_pids = scope.get("live_points_ids") or pids
        net_extra = []
        if "expiration_date" in present:
            net_extra = ["|", ["expiration_date", "=", False], ["expiration_date", ">=", today]]
        net = _liability(o, live_pids, net_extra, fallback)
        stats["liability_net_jod"] = net["jod"]
        kv("NET liability (live programmes, unexpired)", "%.2f JOD" % net["jod"])
        kv("  net cut-off date used", "%s (Asia/Amman calendar day)" % today)
        if not net_extra:
            warn("expiration_date is absent on this build, so NET could not exclude expired "
                 "cards — it differs from GROSS only by dropping archived/expired programmes.")
        derive("GROSS %.2f JOD is every unspent point ever awarded on a points programme. "
               "NET %.2f JOD is the part that a customer could still redeem today (live "
               "programme, card not past expiration_date). The NET figure is the one a redesign "
               "must fund; the gap between them is points that Odoo will simply refuse at the "
               "till." % (gross["jod"], net["jod"]))
        if stats.get("sum_truncated"):
            warn("at least one point sum was truncated or refused — the liability above is a "
                 "LOWER BOUND, not a measurement.")
        if not fallback and not EV.get("values_by_program"):
            gap("No per_point JOD value found on any live points programme, so the point "
                "liability cannot be converted to JOD from configuration alone.")

    if "create_date" in present:
        first, _ = o.read_all("loyalty.card", dom, ["create_date"], order="create_date asc", cap=1)
        last, _ = o.read_all("loyalty.card", dom, ["create_date"], order="create_date desc", cap=1)
        stats["oldest"] = first[0]["create_date"] if first else None
        stats["newest"] = last[0]["create_date"] if last else None
        kv("oldest / newest card create_date", "%s  →  %s" % (stats["oldest"], stats["newest"]))
    if o.has("loyalty.card", "program_id"):
        sub("cards per program (every programme, so nothing is hidden)")
        for p in programs:
            n = o.count("loyalty.card", [["program_id", "=", p["id"]]])
            kv("  %s [%s]" % (p.get("name"), p.get("program_type", "?")),
               "UNKNOWN (count failed)" if n is None else n)
    EV["cards"] = stats
    _report_other_cards(o, programs, scope)


def _report_other_cards(o: Odoo, programs: list, scope: dict) -> None:
    """Gift-card / eWallet float — a real liability, in JOD, at 1:1. Never mixed with points."""
    if not scope.get("other_ids"):
        return
    sub("NON-POINTS CARD BALANCES (gift cards / eWallets) — reported in JOD at 1:1")
    prog_by_id = {p["id"]: p for p in programs}
    grand = 0.0
    out = {"by_program": [], "total_jod": 0.0}
    for pid in scope["other_ids"]:
        p = prog_by_id.get(pid, {})
        n = o.count("loyalty.card", [["program_id", "=", pid]])
        a = o.agg("loyalty.card", [["program_id", "=", pid]], ["points"]) or {}
        bal = a.get("points")
        vals = (EV.get("values_by_program") or {}).get(pid) or []
        rate = vals[0] if vals else 1.0
        jod = None if bal is None else bal * rate
        if jod is not None:
            grand += jod
        kv("  %s [%s]" % (p.get("name"), p.get("program_type", "?")),
           "%s card(s), balance %s x %.4f = %s JOD"
           % ("?" if n is None else n, fmt(bal), rate, fmt(jod)))
        if vals and abs(rate - 1.0) > 1e-9:
            warn("this programme prices a unit at %.4f JOD, not 1.0 — the balance was converted "
                 "at its own configured rate." % rate)
        out["by_program"].append({"program_id": pid, "name": p.get("name"),
                                  "program_type": p.get("program_type"), "cards": n,
                                  "balance": bal, "rate": rate, "jod": jod})
    out["total_jod"] = grand
    kv("TOTAL non-points float", "%.2f JOD" % grand)
    derive("This float is a genuine obligation — a customer paid for it — but it is CASH, not "
           "points. It is deliberately kept out of the point liability above: on these "
           "programmes `points` is already a currency amount, so adding it to point balances "
           "and multiplying by 0.01 would be meaningless in both directions.")
    EV["other_cards"] = out


# ============================================================================ Q6 history
def loyalty_history_domain(o: Odoo, scope: dict) -> tuple[list, str]:
    """Restrict loyalty.history to the points programmes.

    loyalty.history has no program_id — only card_id — so the filter is reached by dotted
    path. Without it an eWallet top-up counts as `issued` and a wallet spend as `used`, and
    since wallet turnover approaches 100% the redemption rate is biased upward without bound.
    """
    if scope.get("mode", "").startswith("unscoped"):
        return [], ("UNFILTERED (programme scoping unavailable — redemption rate may be "
                    "inflated by wallet / gift-card turnover)")
    dom = [["card_id.program_id.program_type", "=", "loyalty"]]
    if o.supports_domain("loyalty.history", dom):
        return dom, "scoped via card_id.program_id.program_type = 'loyalty'"
    warn("this build cannot evaluate the dotted domain card_id.program_id.program_type. History "
         "figures below are UNFILTERED and may include gift-card / eWallet movements.")
    return [], "UNFILTERED (dotted domain unsupported on this build)"


def report_history(o: Odoo, scope: dict) -> None:
    head("What is the REDEMPTION RATE — how many points issued vs actually used?",
         "loyalty.history (points programmes only: numerator and denominator)")
    if not o.fields("loyalty.history"):
        gap("loyalty.history is not present/readable on this build. Redemption rate CANNOT be "
            "measured. Fallback: derive used-points from pos.order.line where reward_id is set.")
        EV["history"] = None
        return
    present, absent = o.pick("loyalty.history", ["issued", "used", "card_id", "description",
                                                 "create_date", "order_id", "order_model"])
    if absent:
        gap("loyalty.history has no field(s): %s." % ", ".join(absent))

    dom, how = loyalty_history_domain(o, scope)
    kv("read domain", how)
    total = o.count("loyalty.history", dom)
    if total is None:
        gap("loyalty.history count could not be read (RPC / access-rights failure) — the ledger "
            "population is UNKNOWN, not zero. No conclusion about earning or redemption may be "
            "drawn from this run.")
        EV["history"] = None
        return
    kv("loyalty.history rows", total)
    hist = {"count": total, "scope": how}
    if not total:
        warn("ZERO history rows on the points programme(s) — no earning or redemption has ever "
             "been recorded here.")
        EV["history"] = hist
        return
    if "create_date" in present:
        first, _ = o.read_all("loyalty.history", dom, ["create_date"], order="create_date asc", cap=1)
        last, _ = o.read_all("loyalty.history", dom, ["create_date"], order="create_date desc", cap=1)
        hist["first"] = first[0]["create_date"] if first else None
        hist["last"] = last[0]["create_date"] if last else None
        kv("date range", "%s  →  %s" % (hist["first"], hist["last"]))
    sums = [f for f in ("issued", "used") if f in present]
    if sums:
        a = o.agg("loyalty.history", dom, sums) or {}
        kv("aggregation method", a.get("_via"))
        hist["issued"] = a.get("issued")
        hist["used"] = a.get("used")
        hist["truncated"] = bool(a.get("_truncated") or a.get("_unmeasured"))
        kv("TOTAL points ISSUED (denominator)", fmt(hist["issued"]))
        kv("TOTAL points USED   (numerator)", fmt(hist["used"]))
        if hist.get("issued") and not hist["truncated"]:
            hist["redemption_rate"] = 100.0 * (hist.get("used") or 0.0) / hist["issued"]
            derive("REDEMPTION RATE = used / issued = %.2f%%. Read it as: this share of every "
                   "point ever awarded has been taken back off an invoice. It is the single "
                   "number that turns a giveback %% into a real cost." % hist["redemption_rate"])
            derive("BREAKAGE = 100%% - redemption = %.2f%% (points issued and never used). "
                   "Note this is a LIFETIME figure, not a cohort figure; points issued recently "
                   "have not had time to be redeemed, so it OVERSTATES breakage."
                   % (100.0 - hist["redemption_rate"]))
        elif hist["truncated"]:
            gap("issued/used could not be summed completely (truncated or refused) — the "
                "redemption rate is NOT computed rather than computed from partial sums.")
        # last 90 days, to show the trend rather than the lifetime blur
        if "create_date" in present:
            since = utc_stamp(POS_WINDOW_DAYS)   # create_date is a Datetime, genuinely stored in UTC
            b = o.agg("loyalty.history", dom + [["create_date", ">=", since]], sums) or {}
            kv("last %d days — issued / used" % POS_WINDOW_DAYS,
               "%s / %s" % (fmt(b.get("issued")), fmt(b.get("used"))))
            if b.get("issued") and not (b.get("_truncated") or b.get("_unmeasured")):
                hist["redemption_rate_90d"] = 100.0 * (b.get("used") or 0.0) / b["issued"]
                derive("Trailing-%dd redemption rate = %.2f%%."
                       % (POS_WINDOW_DAYS, hist["redemption_rate_90d"]))
    EV["history"] = hist

    # --- the same ledger, for everything that is NOT the points programme ----
    if scope.get("other_ids") and not scope.get("mode", "").startswith("unscoped"):
        other_dom = [["card_id.program_id.program_type", "!=", "loyalty"]]
        if o.supports_domain("loyalty.history", other_dom) and sums:
            sub("NON-POINTS LEDGER (gift cards / eWallets) — reported separately")
            a2 = o.agg("loyalty.history", other_dom, sums) or {}
            kv("rows", a2.get("__count"))
            kv("units issued / used (JOD-denominated)",
               "%s / %s" % (fmt(a2.get("issued")), fmt(a2.get("used"))))
            EV["other_history"] = {"count": a2.get("__count"), "issued": a2.get("issued"),
                                   "used": a2.get("used")}
            derive("A wallet top-up is an 'issued' row and a wallet spend is a 'used' row, and "
                   "wallet turnover approaches 100%. Folding these into the redemption rate "
                   "above would push it toward 100% and make the points programme look far more "
                   "redeemed than it is.")


# ============================================================================ Q7 expiry
def report_expiry(o: Odoo, scope: dict) -> None:
    head("Do points expire — is expiration_date populated, and how does Odoo enforce it?",
         "loyalty.card.expiration_date + ir.cron")
    print("   How Odoo actually behaves: expiration_date is a FILTER applied when usable cards")
    print("   are selected at earn/redeem time. Odoo does NOT sweep expired cards to zero, and")
    print("   there is no standard cron that does. So a card with a past expiration_date and a")
    print("   non-zero balance is the NORMAL steady state, not evidence of a broken process.")
    print("   The finding that matters here is how many cards carry NO expiry date at all —")
    print("   those points are a permanent liability.")
    exp = {}
    dom = scope_domain(scope)
    kv("read domain", scope_note(scope))
    if not o.has("loyalty.card", "expiration_date"):
        gap("loyalty.card.expiration_date does NOT exist on this build. Points cannot expire "
            "through the standard mechanism — the liability is PERMANENT unless custom code "
            "removes it.")
        exp["field"] = False
    else:
        exp["field"] = True
        today = today_amman()
        exp["today_amman"] = today
        total = o.count("loyalty.card", dom)
        withdate = o.count("loyalty.card", dom + [["expiration_date", "!=", False]])
        exp["total"] = total
        exp["with_date"] = withdate
        if total is None or withdate is None:
            gap("card counts could not be read — expiry coverage is UNKNOWN, not zero.")
        else:
            exp["without_date"] = total - withdate
            kv("cards with an expiration_date", "%s of %s (%.1f%%)"
               % (withdate, total, 100.0 * withdate / total if total else 0.0))
            kv("cards with NO expiration_date", "%s  <-- these points never age out"
               % exp["without_date"])
        if withdate:
            soon, _ = o.read_all("loyalty.card", dom + [["expiration_date", "!=", False]],
                                 ["expiration_date"], order="expiration_date asc", cap=1)
            late, _ = o.read_all("loyalty.card", dom + [["expiration_date", "!=", False]],
                                 ["expiration_date"], order="expiration_date desc", cap=1)
            exp["earliest"] = soon[0]["expiration_date"] if soon else None
            exp["latest"] = late[0]["expiration_date"] if late else None
            kv("earliest / latest expiration_date", "%s → %s" % (exp["earliest"], exp["latest"]))
            # expiration_date is a DATE (calendar day, no timezone). The business day is Amman's;
            # deriving it from UTC would drop a whole day's cohort for three hours every night.
            past = o.count("loyalty.card", dom + [["expiration_date", "<", today],
                                                  ["points", ">", 0]])
            kv("cards past expiry that still show points", "UNKNOWN" if past is None else past)
            kv("  cut-off date used", "%s (Asia/Amman calendar day, not UTC)" % today)
            if past:
                exp["stale"] = past
                derive("%s card(s) show a balance past their expiry date. This is EXPECTED Odoo "
                       "behaviour, not a fault: those points are already unusable at the till. "
                       "They are excluded from the NET liability in the cards section — which is "
                       "why gross and net differ." % past)
        elif withdate == 0:
            warn("NO card carries an expiration date: in practice points never expire today, and "
                 "the whole balance is a permanent liability.")
    sub("scheduled actions that touch loyalty (context only — none is required)")
    if o.fields("ir.cron"):
        try:
            crons, _ = o.read_all(
                "ir.cron",
                ["|", "|", ["name", "ilike", "loyalty"], ["name", "ilike", "expir"],
                 ["name", "ilike", "coupon"]],
                ["name", "active", "interval_number", "interval_type", "nextcall", "model_id"],
                cap=100)
            kv("matching crons", len(crons))
            for c in crons:
                kv("  " + str(c.get("name")),
                   "active=%s every %s %s next=%s model=%s"
                   % (fmt(c.get("active")), c.get("interval_number"), c.get("interval_type"),
                      c.get("nextcall"), m2o(c.get("model_id"))))
            exp["crons"] = [{"name": c.get("name"), "active": c.get("active")} for c in crons]
            if not crons:
                kv("verdict", "no loyalty/expiry cron exists — which is NORMAL: stock Odoo has no "
                              "expiry sweep. Absence here is not a defect.")
        except Exception as exc:
            gap("ir.cron not readable (%s) — the login may lack admin rights. Re-run as a user "
                "who can read scheduled actions before concluding no cron exists." % str(exc)[:80])
    else:
        gap("ir.cron not readable — cannot say whether an expiry job is scheduled.")
    EV["expiry"] = exp


# ============================================================================ Q8 POS coverage
def report_pos_coverage(o: Odoo, programs: list, scope: dict) -> None:
    head("Which POS shops / branches can actually AWARD POINTS today? "
         "(where are the coverage gaps across the 8 branches?)",
         "pos.config x loyalty.program.pos_config_ids, filtered by pos_ok / type / dates")
    if not o.fields("pos.config"):
        gap("pos.config not readable — POS coverage cannot be assessed.")
        EV["pos_coverage"] = None
        return
    present, _ = o.pick("pos.config", ["name", "active", "company_id", "branch_id", "module_pos_loyalty"])
    configs, _ = o.read_all("pos.config", [], present + ["id"], order="id", cap=500)
    kv("pos.config shops (incl. archived)", len(configs))
    active_cfg = [c for c in configs if c.get("active", True)]
    kv("ACTIVE shops", len(active_cfg))
    if o.has("pos.config", "branch_id"):
        branches = {}
        for c in configs:
            b = m2o(c.get("branch_id"))
            branches.setdefault(b, []).append(c.get("name"))
        kv("distinct branches (almond_branch)", len(branches))
        for b, names in branches.items():
            kv("  branch " + str(b), ", ".join(str(n) for n in names))
    else:
        gap("pos.config.branch_id absent (almond_branch not installed here) — shops are reported "
            "individually; map them to the 8 physical branches by hand.")

    sub("program → shop matrix")
    if not o.has("loyalty.program", "pos_config_ids"):
        gap("loyalty.program.pos_config_ids absent — per-shop enablement cannot be read; check "
            "the POS settings UI instead.")
        EV["pos_coverage"] = None
        return

    # A programme only covers a shop if it can award POINTS there TODAY. The POS loads
    # programmes with a domain equivalent to
    #     [('pos_ok','=',True), '|', ('pos_config_ids','=',False), ('pos_config_ids','in', config.id)]
    # so "empty pos_config_ids = all shops" is only HALF the rule. Counting an active sale-only
    # promotion, a gift-card programme or an expired programme as coverage empties the gap list
    # and prints a false all-clear for branches where nobody can earn a point.
    today = today_amman()
    cfg_name = {c["id"]: c.get("name") for c in configs}
    covered, matrix, excluded, counted = set(), {}, [], []
    for p in programs:
        reasons = []
        live, why = program_is_live(p, today)
        if not live:
            reasons += why
        if "program_type" in p and p.get("program_type") != "loyalty":
            reasons.append("program_type=%s (not a points programme)" % p.get("program_type"))
        if "pos_ok" in p and not p.get("pos_ok"):
            reasons.append("pos_ok=False (not available in POS at all)")
        if reasons:
            excluded.append((p, reasons))
            continue
        counted.append(p)
        ids = p.get("pos_config_ids") or []
        if not ids:
            matrix[p["id"]] = "ALL SHOPS (pos_config_ids is empty => no restriction)"
            covered |= {c["id"] for c in active_cfg}
        else:
            matrix[p["id"]] = ", ".join(str(cfg_name.get(i, i)) for i in ids)
            covered |= set(ids)
        kv("  %s (id=%s)" % (p.get("name"), p["id"]), matrix[p["id"]])
    if not counted:
        warn("NO programme qualifies as a POS points programme today — every active shop is a "
             "coverage gap by definition. See the exclusion list below for why.")

    sub("programmes EXCLUDED from the coverage matrix — and why (so the all-clear is auditable)")
    if excluded:
        for p, reasons in excluded:
            kv("  %s (id=%s)" % (p.get("name"), p["id"]), "skipped: " + "; ".join(reasons))
        derive("None of the above can award a point at a till today. A shop that is 'covered' "
               "only by one of these is a GAP, and is listed as such below.")
    else:
        print("   None — every programme on this database qualifies as a live POS points programme.")

    gaps = [c for c in active_cfg if c["id"] not in covered]
    kv("ACTIVE shops with NO points programme", len(gaps))
    for c in gaps:
        kv("  GAP: " + str(c.get("name")), "id=%s — customers here earn nothing" % c["id"])
    EV["pos_coverage"] = {"shops": len(configs), "active_shops": len(active_cfg),
                          "counted_programs": [p["id"] for p in counted],
                          "excluded_programs": [{"id": p["id"], "name": p.get("name"),
                                                 "reasons": r} for p, r in excluded],
                          "uncovered": [c.get("name") for c in gaps],
                          "today_amman": today}


# ============================================================================ Q9 member coverage
def report_member_coverage(o: Odoo, scope: dict) -> None:
    head("MEMBER COVERAGE — what share of business is actually identified? "
         "(the single most important unknown)",
         "res.partner with points cards + pos.order carrying a partner, last %d days"
         % POS_WINDOW_DAYS)
    cov = {}
    card_dom = scope_domain(scope)
    # -- partners holding a POINTS card (a gift-card holder is not a programme member)
    if o.has("loyalty.card", "partner_id"):
        kv("card read domain", scope_note(scope))
        with_partner = o.count("loyalty.card", card_dom + [["partner_id", "!=", False]])
        all_cards = o.count("loyalty.card", card_dom)
        kv("points cards attached to a partner",
           "UNKNOWN (count failed)" if with_partner is None else with_partner)
        distinct, truncated_partners = None, False
        try:
            res = o.rpc("loyalty.card", "formatted_read_group",
                        [card_dom + [["partner_id", "!=", False]], ["partner_id"], ["__count"]])
            distinct = len(res or [])
        except Exception as exc:
            warn("formatted_read_group unavailable for the distinct-partner count (%s) — "
                 "trying the older grouping API." % str(exc)[:110])
            try:
                res = o.rpc("loyalty.card", "read_group",
                            [card_dom + [["partner_id", "!=", False]], ["partner_id"], ["partner_id"]],
                            {"lazy": False})
                distinct = len(res or [])
            except Exception as exc2:
                warn("read_group also unavailable (%s) — counting distinct partners locally, "
                     "which pulls one row per card." % str(exc2)[:110])
                rows, truncated_partners = o.read_all(
                    "loyalty.card", card_dom + [["partner_id", "!=", False]], ["partner_id"])
                distinct = len({r["partner_id"][0] for r in rows if r.get("partner_id")})
                if truncated_partners:
                    warn("distinct-partner count is a LOWER BOUND (row ceiling hit).")
        cov["partners_with_card"] = distinct
        cov["partners_truncated"] = truncated_partners
        kv("DISTINCT partners holding >=1 points card", distinct)
        if with_partner is not None and all_cards is not None:
            anon = all_cards - with_partner
            if anon:
                kv("points cards with NO partner (anonymous)", anon)
                warn("%s card(s) are not attached to anybody — those points can never be "
                     "marketed to." % anon)
    else:
        gap("loyalty.card.partner_id absent — cannot count members.")
    total_partners = o.count("res.partner", [])
    cov["total_partners"] = total_partners
    kv("res.partner records (all kinds)",
       "UNKNOWN (count failed)" if total_partners is None else total_partners)

    # -- identified share of POS traffic
    sub("identified share of POS traffic — last %d days" % POS_WINDOW_DAYS)
    if not o.fields("pos.order"):
        gap("pos.order not readable — member coverage CANNOT be measured. This is the most "
            "important gap in this report; fix the access rights and re-run.")
        EV["member_coverage"] = cov
        return
    since = utc_stamp(POS_WINDOW_DAYS)      # date_order is a Datetime, genuinely stored in UTC
    base = [["date_order", ">=", since]]
    if o.has("pos.order", "state"):
        base += [["state", "in", ["paid", "done", "invoiced"]]]
        kv("order filter", "state in (paid, done, invoiced) — excludes drafts/cancelled")
    n_all = o.count("pos.order", base)
    n_id = o.count("pos.order", base + [["partner_id", "!=", False]])
    cov.update(window_days=POS_WINDOW_DAYS, orders=n_all, orders_with_partner=n_id)
    kv("POS orders in window", "UNKNOWN (count failed)" if n_all is None else n_all)
    kv("POS orders carrying a partner", "UNKNOWN (count failed)" if n_id is None else n_id)
    if n_all and n_id is not None:
        cov["coverage_pct"] = 100.0 * n_id / n_all
        derive("MEMBER COVERAGE = %.2f%% of POS orders are identified. Every giveback %% in any "
               "design must be multiplied by THIS number to become a real cost — an unidentified "
               "invoice costs the program nothing and earns it nothing."
               % cov["coverage_pct"])
    elif n_all == 0:
        warn("No POS orders in the window — check date_order/state filters or the window length.")
    if o.has("pos.order", "amount_total"):
        a_all = o.agg("pos.order", base, ["amount_total"]) or {}
        a_id = o.agg("pos.order", base + [["partner_id", "!=", False]], ["amount_total"]) or {}
        cov["value_all"] = a_all.get("amount_total")
        cov["value_identified"] = a_id.get("amount_total")
        cov["value_via"] = a_all.get("_via")
        # A truncated or refused sum on one side and a complete sum on the other would divide
        # two DIFFERENT populations — a 90-day numerator over a partial denominator, which can
        # print above 100%. The flag is written by agg(); here it is actually read.
        bad = [k for k, a in (("all orders", a_all), ("identified orders", a_id))
               if a.get("_truncated") or a.get("_unmeasured")]
        cov["value_truncated"] = bool(bad)
        kv("value of all orders (JOD)", fmt(cov["value_all"]))
        kv("value of identified orders (JOD)", fmt(cov["value_identified"]))
        kv("aggregation method", a_all.get("_via"))
        if bad:
            warn("the %s sum was truncated or refused, so the two sums cover DIFFERENT "
                 "populations. COVERAGE BY VALUE is deliberately NOT computed — a percentage "
                 "built from mismatched populations can exceed 100%% and would be worse than no "
                 "number at all. Re-run with --allow-slow or with grouping-API access."
                 % " and ".join(bad))
        elif cov.get("value_all"):
            cov["coverage_value_pct"] = 100.0 * (cov.get("value_identified") or 0.0) / cov["value_all"]
            derive("COVERAGE BY VALUE = %.2f%%. Compare with coverage by count above: if value "
                   "coverage is materially higher, members already buy bigger baskets and the "
                   "programme's incremental job is frequency, not size." % cov["coverage_value_pct"])
    # per-shop, so the gap is actionable per branch
    if o.fields("pos.config"):
        sub("coverage per shop (where identification actually happens)")
        cfgs, _ = o.read_all("pos.config", [], ["name"], cap=200)
        per = []
        for c in cfgs:
            tot = o.count("pos.order", base + [["config_id", "=", c["id"]]])
            if not tot:
                continue
            ident = o.count("pos.order", base + [["config_id", "=", c["id"]],
                                                 ["partner_id", "!=", False]])
            if ident is None:
                kv("  " + str(c.get("name")), "%s orders, identified count FAILED" % tot)
                continue
            per.append((c.get("name"), tot, ident, 100.0 * ident / tot))
            kv("  " + str(c.get("name")), "%s orders, %s identified (%.1f%%)"
               % (tot, ident, 100.0 * ident / tot))
        cov["per_shop"] = per
    EV["member_coverage"] = cov


# ============================================================================ Q10 tax basis
def _quartiles(v: list) -> tuple:
    """(q1, median, q3) by linear interpolation — stdlib only, works for tiny samples."""
    s = sorted(v)
    n = len(s)

    def q(p):
        if n == 1:
            return s[0]
        idx = p * (n - 1)
        lo = int(idx)
        hi = min(lo + 1, n - 1)
        return s[lo] * (1 - (idx - lo)) + s[hi] * (idx - lo)
    return q(0.25), q(0.50), q(0.75)


def _sample_history_spread(o: Odoo, dom: list, read_fields: list, cap: int) -> list:
    """Sample awarded-point rows ACROSS the window, not just the newest ones.

    `order='id desc'` alone returns the last N awards, which on this fleet means one recent
    promotion, one busy branch, or one Ramadan evening. ids are monotonic with creation, so
    slicing the id range into buckets spreads the sample over time at no extra cost.
    """
    first, _ = o.read_all("loyalty.history", dom, ["id"], order="id asc", cap=1)
    last, _ = o.read_all("loyalty.history", dom, ["id"], order="id desc", cap=1)
    if not first or not last:
        return []
    lo, hi = first[0]["id"], last[0]["id"]
    if hi <= lo:
        rows, _ = o.read_all("loyalty.history", dom, read_fields, order="id desc", cap=cap)
        return rows
    per = max(1, cap // TAX_PROBE_BUCKETS)
    step = (hi - lo + 1) / float(TAX_PROBE_BUCKETS)
    out, seen = [], set()
    for b in range(TAX_PROBE_BUCKETS):
        b_lo = int(lo + b * step)
        b_hi = hi if b == TAX_PROBE_BUCKETS - 1 else int(lo + (b + 1) * step) - 1
        chunk, _ = o.read_all("loyalty.history",
                              dom + [["id", ">=", b_lo], ["id", "<=", b_hi]],
                              read_fields, order="id desc", cap=per)
        for r in chunk:
            if r["id"] not in seen:
                seen.add(r["id"])
                out.append(r)
    if len(out) < cap:      # top up from the most recent rows if some buckets were thin
        extra, _ = o.read_all("loyalty.history", dom, read_fields, order="id desc",
                              cap=cap - len(out))
        for r in extra:
            if r["id"] not in seen:
                seen.add(r["id"])
                out.append(r)
    return out


def probe_money_mode_tax_basis(o: Odoo, scope: dict) -> None:
    head("Does reward_point_mode='money' award points on the TAX-INCLUSIVE or TAX-EXCLUSIVE "
         "amount? (measured, not assumed)",
         "empirical probe: loyalty.history.issued vs the source pos.order amounts")
    print("   Why it matters: at 5 pts/JOD the difference between an 8%% and a 16%% tax base is a")
    print("   direct 7-14%% error in every cost projection. The configuration does not state it,")
    print("   so it is measured here from real awarded points.")
    print("   How much evidence is enough: below %d matched awards nothing is decided; below %d"
          % (TAX_PROBE_MIN, TAX_PROBE_FIRM))
    print("   the verdict is printed as PROVISIONAL. A wide spread refuses the verdict outright.")
    probe = {"status": "undetermined", "matched": 0, "confidence": None}
    if not o.fields("loyalty.history") or not o.has("loyalty.history", "issued"):
        gap("loyalty.history.issued absent — the basis cannot be measured. Fall back to reading "
            "the installed loyalty module source on the server.")
        EV["tax_probe"] = probe
        return
    link_field = next((f for f in ("order_id", "pos_order_id", "sale_order_id")
                       if o.has("loyalty.history", f)), None)
    if not link_field:
        gap("loyalty.history has no field linking a row to its source order (looked for "
            "order_id / pos_order_id / sale_order_id). The basis cannot be measured from here.")
        EV["tax_probe"] = probe
        return
    read_fields = ["id", "issued", link_field]
    for f in ("order_model", "card_id", "create_date"):
        if o.has("loyalty.history", f):
            read_fields.append(f)

    hdom, how = loyalty_history_domain(o, scope)
    dom = hdom + [["issued", ">", 0]]
    kv("read domain", how + ", issued > 0")
    rows = _sample_history_spread(o, dom, read_fields, TAX_PROBE_SAMPLE)
    kv("history rows sampled (spread over %d id buckets)" % TAX_PROBE_BUCKETS, len(rows))
    if rows and "create_date" in read_fields:
        dates = sorted(str(r.get("create_date") or "") for r in rows if r.get("create_date"))
        if dates:
            kv("sample spans", "%s  →  %s" % (dates[0], dates[-1]))
    if not rows:
        gap("No history row with issued>0 on a points programme — nothing to measure against.")
        EV["tax_probe"] = probe
        return

    def order_ref(r):
        v = r.get(link_field)
        if isinstance(v, (list, tuple)) and v:
            return v[0]
        if isinstance(v, int) and v:
            if "order_model" in r and r.get("order_model") not in (None, False, "pos.order"):
                return None
            return v
        return None

    ids = [i for i in (order_ref(r) for r in rows) if i]
    if not ids:
        gap("Sampled history rows do not resolve to pos.order ids (order_model may be "
            "'sale.order'). Basis undetermined for POS.")
        EV["tax_probe"] = probe
        return
    if not o.fields("pos.order"):
        gap("pos.order not readable — cannot compare issued points to order amounts.")
        EV["tax_probe"] = probe
        return
    ofields, _ = o.pick("pos.order", ["amount_total", "amount_tax", "amount_paid", "config_id"])
    # loyalty.history.order_id is a Many2oneReference: no foreign key, no ondelete cascade, so a
    # history row can name a pos.order that was vacuumed away or that a record rule hides. read()
    # would raise MissingError/AccessError on the whole batch and kill the run one section before
    # PREMISE CHECK. search_read over an id domain simply omits what it cannot see, and the
    # shortfall is then reported honestly instead of crashing.
    orders, _ = o.read_all("pos.order", [["id", "in", sorted(set(ids))]], ofields + ["id"])
    by_id = {x["id"]: x for x in orders}
    missing = len(set(ids)) - len(by_id)
    kv("sampled history rows whose pos.order is gone/unreadable", missing)
    if missing:
        derive("Those %d reference(s) are dangling Many2oneReference ids (deleted orders, or "
               "rows this login cannot read). They are skipped, not fatal." % missing)

    incl_ratios, excl_ratios = [], []
    shops, cards = set(), set()
    for r in rows:
        oid = order_ref(r)
        od = by_id.get(oid)
        if not od:
            continue
        total = od.get("amount_total") or 0.0
        tax = od.get("amount_tax") or 0.0
        issued = r.get("issued") or 0.0
        if total > 0:
            incl_ratios.append(issued / total)
            shops.add(m2o_id(od.get("config_id")))
            cid = m2o_id(r.get("card_id"))
            if cid:
                cards.add(cid)
        if (total - tax) > 0:
            excl_ratios.append(issued / (total - tax))
    matched = len(incl_ratios)
    probe["matched"] = matched
    kv("history rows matched to a pos.order", matched)

    # How concentrated is the evidence? A tight 40 rows from one till is not a network fact.
    shops.discard(None)
    kv("distinct POS configs behind the matched rows", len(shops) or "unknown")
    if o.fields("loyalty.card") and cards:
        crows, _ = o.read_all("loyalty.card", [["id", "in", sorted(cards)]], ["program_id"])
        progs = {m2o_id(c.get("program_id")) for c in crows}
        progs.discard(None)
        probe["programs"] = sorted(progs)
        kv("distinct programmes behind the matched rows", len(progs))
    probe["shops"] = len(shops)
    if len(shops) <= 1:
        warn("the matched rows come from at most ONE till/shop — whatever this measures, it is "
             "not necessarily how the whole network awards points.")

    if matched < TAX_PROBE_MIN:
        gap("Only %d matched row(s) — below the %d-row floor. A median-based decision under a "
            "25%% tolerance needs more evidence than this. Basis UNDETERMINED; do not assume "
            "either. (Widen TAX_PROBE_SAMPLE or wait for more awards.)" % (matched, TAX_PROBE_MIN))
        EV["tax_probe"] = probe
        return
    probe["confidence"] = "provisional" if matched < TAX_PROBE_FIRM else "measured"
    if probe["confidence"] == "provisional":
        warn("%d matched rows is enough to point at an answer but not to settle it. The verdict "
             "below is PROVISIONAL — re-run when more awards exist before putting it in a cost "
             "model." % matched)

    i_q1, i_md, i_q3 = _quartiles(incl_ratios)
    e_q1, e_md, e_q3 = _quartiles(excl_ratios) if excl_ratios else (0.0, 0.0, 0.0)
    i_iqr, e_iqr = i_q3 - i_q1, e_q3 - e_q1
    kv("issued / amount_total  (TAX-INCLUSIVE basis)",
       "median %.4f   [q1 %.4f, q3 %.4f, IQR %.4f, min %.4f, max %.4f]"
       % (i_md, i_q1, i_q3, i_iqr, min(incl_ratios), max(incl_ratios)))
    kv("issued / (total - tax) (TAX-EXCLUSIVE basis)",
       "median %.4f   [q1 %.4f, q3 %.4f, IQR %.4f]" % (e_md, e_q1, e_q3, e_iqr))
    probe.update(incl_median=i_md, excl_median=e_md, incl_iqr=i_iqr, excl_iqr=e_iqr)

    separation = abs(i_md - e_md)
    if separation > 0 and i_iqr > separation:
        derive("The ratios are SCATTERED: the inter-quartile range of the tax-inclusive ratio "
               "(%.4f) is wider than the whole distance between the two hypotheses (%.4f). "
               "A median that sits closer to one hypothesis is meaningless at that spread. "
               "Basis UNDETERMINED — the awards in this sample are not a clean multiple of the "
               "invoice." % (i_iqr, separation))
        probe["status"] = "undetermined_scatter"
        EV["tax_probe"] = probe
        return

    rates = EV.get("money_rates_live") or EV.get("money_rates") or []
    if rates:
        rate = rates[0]
        d_incl, d_excl = abs(i_md - rate), abs(e_md - rate)
        kv("configured LIVE money-mode rate", fmt(rate))
        tag = "" if probe["confidence"] == "measured" else " (PROVISIONAL, n=%d)" % matched
        if min(d_incl, d_excl) > 0.25 * rate:
            probe["status"] = "undetermined"
            derive("NEITHER basis reproduces the configured rate (%s) within 25%%. Points on these "
                   "orders were NOT a plain multiple of the invoice — restricted products, "
                   "several rules, or manual adjustments are in play. Basis UNDETERMINED; do not "
                   "assume either." % fmt(rate))
        elif d_incl <= d_excl:
            probe["status"] = "tax_inclusive"
            derive("MEASURED%s: points track the TAX-INCLUSIVE total (median %.4f vs configured %s; "
                   "the tax-exclusive hypothesis is further off at %.4f), over %d matched awards "
                   "from %d till(s). Cost models must therefore apply the rate to the GROSS "
                   "invoice." % (tag, i_md, fmt(rate), e_md, matched, len(shops)))
        else:
            probe["status"] = "tax_exclusive"
            derive("MEASURED%s: points track the TAX-EXCLUSIVE (net) amount (median %.4f vs "
                   "configured %s; tax-inclusive is further off at %.4f), over %d matched awards "
                   "from %d till(s)." % (tag, e_md, fmt(rate), i_md, matched, len(shops)))
    else:
        gap("No LIVE money-mode rate was found in the rules, so the measured ratios cannot be "
            "matched against a configured rate. Ratios above are still the empirical earn rate.")
        probe["status"] = "no_configured_rate"
    if incl_ratios:
        derive("EMPIRICAL EARN RATE (whatever the basis) = %.4f points per JOD of gross invoice, "
               "median over %d real awards. If this differs from the configured rate, something "
               "outside loyalty.rule is awarding points." % (i_md, matched))
    EV["tax_probe"] = probe


# ============================================================================ PREMISE CHECK
def premise_check() -> None:
    print("\n" + "#" * _W)
    print("# PREMISE CHECK — does the verbal description of the live program survive the data?")
    print("# The premise under test: \"flat 5 points per JOD, 1 point = 1 qirsh (0.01 JOD),")
    print("# tiers are names only\".")
    print("# Every verdict below is derived ONLY from LIVE configuration of programmes whose")
    print("# program_type is 'loyalty'. Archived rules, expired programmes, gift cards and")
    print("# eWallets are reported elsewhere in this run and are never decisive here.")
    print("#" * _W)
    discrepancies, unknowns = [], []

    scope = EV.get("scope") or {}
    if str(scope.get("mode", "")).startswith("unscoped"):
        warn("PROGRAMME SCOPING FAILED for this run (%s). Every verdict below may be "
             "contaminated by gift-card / eWallet / promotion rows. Treat the whole block as "
             "provisional and fix the access first." % scope.get("mode"))
        unknowns.append("programme scoping (program_type unreadable) — verdicts are provisional")

    # --- P1: flat 5 points per JOD
    sub("PREMISE 1 — earn is a FLAT 5 points per JOD")
    rates = EV.get("money_rates_live") or []
    order_rates = EV.get("order_rates_live") or []
    unit_rates = EV.get("unit_rates_live") or []
    if EV.get("rules_readable") is False:
        print("   VERDICT: UNDETERMINED — loyalty.rule could not be read, so no earn rate exists "
              "to compare against.")
        unknowns.append("the earn rate itself (loyalty.rule unreadable)")
    elif not EV.get("rules"):
        print("   VERDICT: UNDETERMINED — no rule exists on any points programme, so nothing "
              "awards points per JOD here.")
        unknowns.append("the earn rate (no loyalty.rule on any points programme)")
    elif not rates and (order_rates or unit_rates):
        print("   VERDICT: REFUTED — earning is NOT per-JOD at all. Live rules earn per order "
              "(%s) and/or per unit (%s)." % (order_rates or "none", unit_rates or "none"))
        discrepancies.append("Earn is not money-based: the live rules use reward_point_mode "
                             "'order'/'unit', so there is no points-per-JOD rate. Any model built "
                             "on '5 points per JOD' is modelling a program that does not exist.")
    elif not rates:
        print("   VERDICT: UNDETERMINED — rules exist but none of them is live and money-mode.")
        unknowns.append("the live earn rate (rules exist, none live and money-based)")
    elif len(rates) == 1 and abs(rates[0] - CLAIMED_POINTS_PER_JOD) < 1e-9:
        print("   VERDICT: VERIFIED — exactly one LIVE money-mode rate exists and it is 5.00 "
              "points per JOD, applied uniformly.")
    elif len(rates) == 1:
        print("   VERDICT: REFUTED — the rate is flat, but it is %s points per JOD, not 5."
              % fmt(rates[0]))
        discrepancies.append("Earn rate is %s pts/JOD, not the stated 5. Every cost figure "
                             "derived from 5%% is wrong by a factor of %.2f."
                             % (fmt(rates[0]), rates[0] / CLAIMED_POINTS_PER_JOD))
    else:
        print("   VERDICT: REFUTED — earning is NOT flat. Distinct LIVE money-mode rates found: %s"
              % rates)
        discrepancies.append("Multiple LIVE earn rates %s coexist on the points programme(s). "
                             "The programme is already differentiated; 'flat' is wrong." % rates)
    if rates and any(r.get("active", True) and
                     (r.get("product_ids") or r.get("product_category_id") or r.get("product_tag_id"))
                     for r in (EV.get("rules") or [])):
        discrepancies.append("At least one LIVE rule is product/category restricted, so even a "
                             "single rate is not applied to the whole basket — 'flat' overstates "
                             "coverage.")

    # --- P2: 1 point = 1 qirsh
    sub("PREMISE 2 — one point is worth 1 qirsh (0.01 JOD)")
    vals = EV.get("per_point_values_live") or []
    rungs = EV.get("redemption_rungs") or []
    if vals and all(abs(v - QIRSH) < 1e-9 for v in vals):
        print("   VERDICT: VERIFIED — every LIVE per_point reward on the points programme grants "
              "exactly 0.0100 JOD per point (100 points = 1 JOD).")
    elif vals:
        print("   VERDICT: REFUTED — live per_point reward value(s) are %s JOD, not 0.01." % vals)
        discrepancies.append("A point is worth %s JOD live, not the stated 0.01."
                             % ", ".join("%.4f" % v for v in vals))
    elif rungs:
        implied = [(r[1] / r[0]) for r in rungs if r[0]]
        print("   VERDICT: UNDETERMINED — no per_point reward exists; fixed rungs imply %s JOD "
              "per point, which is a rung price, not a redemption rate."
              % ", ".join("%.4f" % v for v in implied))
        unknowns.append("the marginal value of a point (only fixed rungs exist, no per_point "
                        "reward)")
    else:
        print("   VERDICT: UNDETERMINED — no reward on a live points programme prices a point in "
              "JOD. The '1 qirsh' figure is not in Odoo; it lives in the app, the BFF, or in "
              "staff convention.")
        unknowns.append("where the 1-qirsh point value is actually enforced (not in Odoo)")
    if EV.get("giveback_pct") is not None:
        print("   Cross-check: configured giveback = %.2f%% of qualifying spend (rate x point "
              "value, paired within one programme)." % EV["giveback_pct"])
        if abs(EV["giveback_pct"] - 5.0) > 0.01:
            discrepancies.append("Headline giveback is %.2f%% of spend, not the assumed 5%%."
                                 % EV["giveback_pct"])
    elif EV.get("giveback_by_program"):
        print("   Cross-check: no single headline giveback — see the per-programme figures in the "
              "REWARDS section.")

    # --- P3: tiers are names only
    sub("PREMISE 3 — tiers are names only (no mechanism behind them)")
    signals = EV.get("tier_signals") or []
    if not signals:
        print("   VERDICT: VERIFIED — no tier or multiplier mechanism of any kind exists in the "
              "live configuration: one live rate, one programme, no partner-based "
              "differentiation, no custom tier fields. Whatever tiers customers are told about "
              "are decoration.")
    else:
        print("   VERDICT: REFUTED (or at least contested) — %d mechanism signal(s) found:"
              % len(signals))
        for i, s in enumerate(signals, 1):
            print("     %d. %s" % (i, s))
        discrepancies.append("Tier/multiplier machinery exists in some form (%d signal(s)); "
                             "'names only' is not accurate — a redesign must first neutralise "
                             "what is already running." % len(signals))

    # --- the things the premise never mentioned but that decide the design
    sub("WHAT THE PREMISE NEVER MENTIONED (measured here, and decisive)")
    cov = EV.get("member_coverage") or {}
    if cov.get("coverage_pct") is not None:
        print("   MEMBER COVERAGE: %.2f%% of POS orders in the last %d days carry a partner "
              "(%s of %s orders)." % (cov["coverage_pct"], cov.get("window_days", POS_WINDOW_DAYS),
                                      cov.get("orders_with_partner"), cov.get("orders")))
        print("   => Multiply every giveback percentage by this to get real cost. An unidentified")
        print("      invoice neither earns nor costs.")
        if cov.get("coverage_value_pct") is not None:
            print("   COVERAGE BY VALUE: %.2f%%." % cov["coverage_value_pct"])
        elif cov.get("value_truncated"):
            print("   COVERAGE BY VALUE: NOT COMPUTED — the two value sums covered different "
                  "populations (one was truncated/refused).")
            unknowns.append("coverage by value (aggregation truncated or refused; re-run with "
                            "--allow-slow or grouping-API access)")
    else:
        print("   MEMBER COVERAGE: NOT MEASURED (pos.order unreadable or window empty).")
        unknowns.append("member coverage — the most important unknown; re-run with POS read access")
    h = EV.get("history") or {}
    if h is None:
        print("   REDEMPTION RATE: NOT MEASURED (loyalty.history unreadable — this is a failure "
              "to read, not a measured zero).")
        unknowns.append("redemption rate / breakage (loyalty.history unreadable)")
    elif h.get("redemption_rate") is not None:
        print("   REDEMPTION RATE: %.2f%% lifetime (%s used of %s issued)%s — points programmes "
              "only, wallet/gift-card turnover excluded."
              % (h["redemption_rate"], fmt(h.get("used")), fmt(h.get("issued")),
                 ", %.2f%% trailing %dd" % (h["redemption_rate_90d"], POS_WINDOW_DAYS)
                 if h.get("redemption_rate_90d") is not None else ""))
    else:
        print("   REDEMPTION RATE: NOT MEASURED (no history rows, or sums incomplete).")
        unknowns.append("redemption rate / breakage")
    c = EV.get("cards") or {}
    if EV.get("cards") is None:
        print("   OUTSTANDING POINTS: NOT MEASURED (loyalty.card unreadable — not a measured zero).")
        unknowns.append("outstanding point liability (loyalty.card unreadable)")
    elif c.get("sum_points") is not None:
        print("   OUTSTANDING POINTS: %s across %s points cards (%s with a positive balance)."
              % (fmt(c.get("sum_points")), c.get("count"), c.get("positive")))
        if c.get("liability_net_jod") is not None:
            print("   LIABILITY: %.2f JOD NET (live programmes, unexpired cards) — this is the "
                  "balance-sheet number a redesign must fund." % c["liability_net_jod"])
            print("   ...........%.2f JOD GROSS (including expired cards and archived "
                  "programmes, which Odoo will refuse at the till)."
                  % (c.get("liability_gross_jod") or 0.0))
        if c.get("sum_truncated"):
            unknowns.append("the exact liability (a point sum was truncated or refused; the "
                            "figure printed is a lower bound)")
    else:
        print("   OUTSTANDING POINTS: NOT MEASURED.")
        unknowns.append("outstanding point liability")
    oc = EV.get("other_cards") or {}
    if oc.get("total_jod"):
        print("   SEPARATELY — GIFT-CARD / eWALLET FLOAT: %.2f JOD. Real money owed, but it is "
              "CASH, not points, and it is excluded from every point figure above."
              % oc["total_jod"])
    e = EV.get("expiry") or {}
    if e.get("field") is False:
        print("   EXPIRY: no expiration_date field — points are PERMANENT liability.")
        discrepancies.append("Points have no expiry mechanism at all; the liability never ages out.")
    elif e.get("with_date") == 0:
        print("   EXPIRY: the field exists but NO card carries a date — in practice nothing expires.")
        discrepancies.append("expiration_date exists but is unpopulated: expiry is nominal only.")
    elif e.get("with_date"):
        print("   EXPIRY: %s of %s cards carry an expiration date (%s → %s); %s carry none and "
              "therefore never age out."
              % (e["with_date"], e.get("total"), e.get("earliest"), e.get("latest"),
                 e.get("without_date")))
        if e.get("without_date"):
            discrepancies.append("%s points card(s) carry NO expiration date — that portion of "
                                 "the liability is permanent." % e["without_date"])
        if e.get("stale"):
            print("   ......... %s card(s) are past expiry but still show a balance. That is "
                  "normal Odoo behaviour (expiry is enforced at redemption, not by a sweep) and "
                  "is already excluded from the NET liability." % e["stale"])
    pc = EV.get("pos_coverage") or {}
    if pc.get("uncovered"):
        print("   POS GAPS: %d active shop(s) run NO live points programme: %s"
              % (len(pc["uncovered"]), ", ".join(str(x) for x in pc["uncovered"])))
        discrepancies.append("Point-earning coverage is not network-wide: %s have no live points "
                             "programme (pos_ok / program_type / date window all checked)."
                             % ", ".join(str(x) for x in pc["uncovered"]))
    elif pc:
        print("   POS GAPS: none — all %s active shop(s) are covered by %d live POS points "
              "programme(s)%s." % (pc.get("active_shops"), len(pc.get("counted_programs") or []),
                                   "; %d programme(s) were excluded as non-earning, see the POS "
                                   "section" % len(pc.get("excluded_programs") or [])
                                   if pc.get("excluded_programs") else ""))
    tp = EV.get("tax_probe") or {}
    conf = tp.get("confidence")
    if tp.get("status") == "tax_inclusive":
        print("   TAX BASIS: points are awarded on the TAX-INCLUSIVE invoice (%s, n=%d matched "
              "awards from %s till(s))." % (conf or "measured", tp.get("matched", 0),
                                            tp.get("shops", "?")))
        if conf == "provisional":
            unknowns.append("the tax basis at full confidence (verdict rests on only %d matched "
                            "awards)" % tp.get("matched", 0))
    elif tp.get("status") == "tax_exclusive":
        print("   TAX BASIS: points are awarded on the TAX-EXCLUSIVE amount (%s, n=%d matched "
              "awards from %s till(s))." % (conf or "measured", tp.get("matched", 0),
                                            tp.get("shops", "?")))
        if conf == "provisional":
            unknowns.append("the tax basis at full confidence (verdict rests on only %d matched "
                            "awards)" % tp.get("matched", 0))
    else:
        print("   TAX BASIS: UNDETERMINED from the sample (%s; n=%d matched) — do not assume 8%% "
              "or 16%% in any model." % (tp.get("status", "undetermined"), tp.get("matched", 0)))
        unknowns.append("whether points are computed on the gross or net invoice")

    # --- sections that failed outright
    fails = EV.get("section_failures") or []
    if fails:
        sub("SECTIONS THAT FAILED IN THIS RUN (their questions are unanswered)")
        for i, f in enumerate(fails, 1):
            print("   %d. %s — %s" % (i, f["section"], f["error"]))
            unknowns.append("everything the section '%s' would have measured (it failed: %s)"
                            % (f["section"], f["error"][:80]))

    # --- roll-up
    sub("DISCREPANCIES (premise vs live data)")
    if discrepancies:
        for i, d in enumerate(discrepancies, 1):
            print("   %d. %s" % (i, d))
    else:
        print("   None. Every testable part of the verbal description matched the live data.")

    sub("STILL UNVERIFIABLE FROM THIS RUN")
    if unknowns:
        for i, u in enumerate(unknowns, 1):
            print("   %d. %s" % (i, u))
    else:
        print("   Nothing — every question in this audit was answered with live data.")

    print("\n   Read this block as the ONLY sanctioned summary of the live program. Any design "
          "\n   document that contradicts it is describing a system that does not exist.")


# ============================================================================ main
def run_section(label: str, fn, *args):
    """Run one section in isolation.

    No single section may destroy the run: the PREMISE CHECK block and the --json dump are
    the whole point of the exercise, and they come LAST. A section that raises prints why,
    records itself as an unknown, and the audit continues.
    """
    try:
        return fn(*args)
    except Exception as exc:
        print("\n   [SECTION FAILED] %s — %s: %s"
              % (label, type(exc).__name__, str(exc)[:200]))
        print("   The audit continues; PREMISE CHECK will list this section's questions as "
              "unanswered. Nothing was written to Odoo — this script has no write path.")
        EV["section_failures"].append(
            {"section": label, "error": "%s: %s" % (type(exc).__name__, str(exc)[:200])})
        return None


def main() -> None:
    global ALLOW_SLOW
    out_json = None
    if "--json" in sys.argv:
        i = sys.argv.index("--json")
        out_json = sys.argv[i + 1] if len(sys.argv) > i + 1 else "loyalty_audit_evidence.json"
    if "--allow-slow" in sys.argv:
        ALLOW_SLOW = True

    env = load_env()
    print("=" * _W)
    print("ALMOND — LIVE LOYALTY CONFIGURATION AUDIT (READ-ONLY)")
    print("=" * _W)
    kv("host", env["ODOO_URL"])
    kv("database", env["ODOO_DB"])
    kv("login", env["ODOO_LOGIN"])
    kv("run at (UTC)", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))
    kv("run at (Asia/Amman)", datetime.now(AMMAN).strftime("%Y-%m-%d %H:%M:%S"))
    kv("date cut-offs use", "Asia/Amman calendar days for Date fields, UTC for Datetime fields")
    kv("slow local aggregation", "ALLOWED (--allow-slow)" if ALLOW_SLOW else
       "refused above %s rows (pass --allow-slow to force)" % "{:,}".format(SLOW_SCAN_LIMIT))
    kv("mode", "READ-ONLY — writes are blocked in code (SAFE_METHODS allow-list)")
    o = Odoo(env)
    kv("authenticated uid", o.uid)

    sub("model availability (fields_get probe before anything is read)")
    for model in ("loyalty.program", "loyalty.rule", "loyalty.reward", "loyalty.card",
                  "loyalty.history", "pos.order", "pos.config", "res.partner", "ir.cron"):
        f = o.fields(model)
        kv(model, "%d fields" % len(f) if f else "NOT AVAILABLE")

    programs = run_section("Q1 programs", report_programs, o) or []
    scope = run_section("programme scope", program_scope, o, programs) or {
        "mode": "unscoped-no-programs", "points_ids": [], "live_points_ids": [], "other_ids": []}
    EV["scope"] = scope

    rules = run_section("Q2 rules", report_rules, o, programs, scope) or []
    run_section("Q3 rewards", report_rewards, o, programs, scope)
    run_section("Q4 tier mechanism", report_tier_mechanism, o, programs, rules)
    run_section("Q5 cards / liability", report_cards, o, programs, scope)
    run_section("Q6 history / redemption", report_history, o, scope)
    run_section("Q7 expiry", report_expiry, o, scope)
    run_section("Q8 POS coverage", report_pos_coverage, o, programs, scope)
    run_section("Q9 member coverage", report_member_coverage, o, scope)
    run_section("Q10 tax basis", probe_money_mode_tax_basis, o, scope)

    try:
        premise_check()
    except Exception as exc:                    # the summary must never be the thing that dies
        print("\n   [PREMISE CHECK FAILED] %s: %s" % (type(exc).__name__, str(exc)[:200]))
        print("   The evidence gathered above still stands; read the sections directly.")
    finally:
        if out_json:
            try:
                with open(out_json, "w", encoding="utf-8") as fh:
                    json.dump(EV, fh, ensure_ascii=False, indent=2, default=str)
                print("\n   Evidence written to %s (machine-readable; feeds the Phase-0 "
                      "measurement kit)." % out_json)
            except Exception as exc:
                warn("could not write %s: %s" % (out_json, exc))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:                                   # never dump a raw traceback
        print("\nABORTED: %s: %s" % (type(exc).__name__, exc))
        print("Nothing was written to Odoo — this script has no write path.")
        sys.exit(1)
