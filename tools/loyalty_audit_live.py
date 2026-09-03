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
# VERSION ROBUSTNESS
#   Odoo minor versions move loyalty fields around, and Odoo 19 changed the grouping API.
#   Every field is introspected with fields_get before use; a missing field degrades to a
#   printed note, never a traceback. Aggregation tries formatted_read_group (18/19), then
#   read_group (<=17), then falls back to batched search_read + local arithmetic.
# =============================================================================================

from __future__ import annotations

import json
import os
import sys
import time
import statistics
import xmlrpc.client
from datetime import datetime, timedelta

# --------------------------------------------------------------------------- tunables
POS_WINDOW_DAYS = 90          # member-coverage window (the brief's "last 90 days")
MAX_ROWS = 400_000            # hard ceiling on rows pulled for local aggregation
BATCH = 2_000                 # rows per search_read round-trip
TAX_PROBE_SAMPLE = 300        # loyalty.history rows sampled for the tax-basis probe
QIRSH = 0.01                  # the premise's claimed value of one point, in JOD
CLAIMED_POINTS_PER_JOD = 5.0  # the premise's claimed earn rate

# Only these methods may cross the wire. Anything else raises before it is sent.
SAFE_METHODS = {
    "search", "search_read", "search_count", "read", "fields_get",
    "read_group", "formatted_read_group", "web_read_group",
    "default_get", "check_access_rights", "get_view",
}

EV: dict = {}   # evidence registry — every section writes here, PREMISE CHECK only reads


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

    # ---- bulk reads --------------------------------------------------------
    def read_all(self, model: str, domain: list, fields_: list, order: str | None = None,
                 cap: int = MAX_ROWS) -> tuple[list, bool]:
        """Paged search_read. Returns (rows, truncated)."""
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
        try:
            return self.rpc(model, "search_count", [domain])
        except Exception as exc:
            warn("search_count on %s failed: %s" % (model, str(exc)[:120]))
            return None

    def agg(self, model: str, domain: list, sum_fields: list) -> dict | None:
        """SUM + COUNT over a domain, across Odoo API generations.

        Odoo 19 renamed the grouping API; try newest first, then oldest, then do the
        arithmetic locally. Returns {'__count': n, '<field>': sum, ...} or None.
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
        except Exception:
            pass
        # 2) Odoo <= 17
        try:
            res = self.rpc(model, "read_group", [domain, sum_fields, []], {"lazy": False})
            if res:
                row = res[0]
                out = {"__count": row.get("__count", row.get("__domain_count", 0)), "_via": "read_group"}
                for f in sum_fields:
                    out[f] = row.get(f) or 0.0
                return out
        except Exception:
            pass
        # 3) Local fallback — always correct, just chattier
        rows, truncated = self.read_all(model, domain, sum_fields)
        out = {"__count": len(rows), "_via": "local sum over search_read"}
        if truncated:
            out["_truncated"] = True
            warn("aggregation over %s hit the %d-row ceiling; sums below are a LOWER BOUND."
                 % (model, MAX_ROWS))
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
        EV["programs"] = []
        return []
    if absent:
        gap("loyalty.program has no field(s): %s — not reported (this Odoo build differs)."
            % ", ".join(absent))

    rows, _ = o.read_all("loyalty.program", [], present + ["id"], order="id")
    EV["programs"] = rows
    kv("programs found (incl. archived)", len(rows))
    if not rows:
        warn("ZERO loyalty programs exist. The premise describes a program that is not here.")
        return rows

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
def report_rules(o: Odoo, programs: list) -> list:
    head("At what rate are points earned, and on what basis (per order / per JOD / per unit)?",
         "loyalty.rule — and the DERIVED effective points-per-JOD")
    wanted = ["program_id", "active", "reward_point_amount", "reward_point_mode", "reward_point_split",
              "minimum_amount", "minimum_amount_tax_mode", "minimum_qty", "mode", "code",
              "product_ids", "product_category_id", "product_tag_id", "product_domain"]
    present, absent = o.pick("loyalty.rule", wanted)
    if not present:
        gap("loyalty.rule is not readable — the earn rate CANNOT be verified from here.")
        EV["rules"] = []
        return []
    if absent:
        gap("loyalty.rule has no field(s): %s — not reported." % ", ".join(absent))

    rows, _ = o.read_all("loyalty.rule", [], present + ["id"], order="program_id, id")
    EV["rules"] = rows
    kv("rules found (incl. archived)", len(rows))
    prog_by_id = {p["id"]: p for p in programs}

    money_rates, per_order_rates, unit_rates = [], [], []
    for r in rows:
        pid = (r.get("program_id") or [None])[0] if isinstance(r.get("program_id"), (list, tuple)) else None
        prog = prog_by_id.get(pid, {})
        sub("rule id=%s  (program: %s)" % (r["id"], m2o(r.get("program_id"))))
        kv("program active / type", "%s / %s" % (fmt(prog.get("active", "?")),
                                                 prog.get("program_type", "?")))
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
            derive("EFFECTIVE EARN = %s point(s) per 1 JOD of qualifying spend "
                   "(reward_point_mode='money' multiplies the rate by the money amount)."
                   % fmt(amount))
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
            derive("EFFECTIVE EARN = %s point(s) per ORDER, independent of basket value. "
                   "Points-per-JOD is therefore NOT constant: on the measured average invoice "
                   "it is a function of invoice size, not a rate." % fmt(amount))
        elif mode == "unit" and amount is not None:
            unit_rates.append(amount)
            derive("EFFECTIVE EARN = %s point(s) per QUALIFYING UNIT (item), not per JOD."
                   % fmt(amount))
        elif amount is not None:
            gap("reward_point_mode=%r is not one of money/order/unit — cannot derive a rate." % mode)

    EV["money_rates"] = sorted(set(money_rates))
    EV["order_rates"] = sorted(set(per_order_rates))
    EV["unit_rates"] = sorted(set(unit_rates))

    sub("DERIVED SUMMARY — earn rates")
    kv("distinct money-mode rates (pts per JOD)", EV["money_rates"] or "none")
    kv("distinct order-mode rates (pts per order)", EV["order_rates"] or "none")
    kv("distinct unit-mode rates (pts per item)", EV["unit_rates"] or "none")
    if len(EV["money_rates"]) > 1:
        derive("MORE THAN ONE money-mode rate exists (%s). The program is NOT flat — different "
               "baskets/products/programs earn at different rates." % EV["money_rates"])
    elif len(EV["money_rates"]) == 1:
        derive("A SINGLE money-mode rate exists: %s point(s) per JOD." % fmt(EV["money_rates"][0]))
    return rows


# ============================================================================ Q3 rewards
def report_rewards(o: Odoo, programs: list) -> list:
    head("What can points be exchanged for, and what is ONE point worth in JOD?",
         "loyalty.reward — and the DERIVED JOD value of one point")
    wanted = ["program_id", "active", "description", "reward_type", "discount", "discount_mode",
              "discount_applicability", "discount_max_amount", "required_points", "point_name",
              "reward_product_id", "reward_product_ids", "reward_product_qty", "clear_wallet",
              "discount_product_ids", "discount_product_category_id"]
    present, absent = o.pick("loyalty.reward", wanted)
    if not present:
        gap("loyalty.reward is not readable — the value of a point CANNOT be derived from here.")
        EV["rewards"] = []
        return []
    if absent:
        gap("loyalty.reward has no field(s): %s — not reported." % ", ".join(absent))

    rows, _ = o.read_all("loyalty.reward", [], present + ["id"], order="program_id, id")
    EV["rewards"] = rows
    kv("rewards found (incl. archived)", len(rows))
    prog_by_id = {p["id"]: p for p in programs}

    per_point_values, rung_values = [], []
    for w in rows:
        sub("reward id=%s  (program: %s)" % (w["id"], m2o(w.get("program_id"))))
        pid = (w.get("program_id") or [None])[0] if isinstance(w.get("program_id"), (list, tuple)) else None
        kv("program active", fmt(prog_by_id.get(pid, {}).get("active", "?")))
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
            derive("ONE POINT = %.4f JOD (discount_mode='per_point': `discount` IS the currency "
                   "amount granted per point). => %s points = 1 JOD." % (disc, fmt(1.0 / disc, 1)))
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
    EV["redemption_rungs"] = sorted(rung_values)
    sub("DERIVED SUMMARY — value of a point")
    kv("distinct per_point JOD values", EV["per_point_values"] or "none found")
    kv("per_order rungs (points, JOD)", EV["redemption_rungs"] or "none found")
    if not per_point_values and not rung_values:
        gap("No reward prices a point in JOD (no per_point and no per_order rung). The claim "
            "'1 point = 1 qirsh' cannot be confirmed from configuration — it may live only in "
            "the app/BFF, or in staff convention.")
    if EV["money_rates"] and EV["per_point_values"]:
        rate, val = EV["money_rates"][0], EV["per_point_values"][0]
        EV["giveback_pct"] = rate * val * 100.0
        derive("HEADLINE GIVEBACK = %s pts/JOD x %.4f JOD/pt = %.2f%% of qualifying spend "
               "returned as points." % (fmt(rate), val, EV["giveback_pct"]))
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

    sub("Signal 2 — different earn rates between rules")
    kv("distinct money-mode rates", EV.get("money_rates") or "none")
    if len(EV.get("money_rates") or []) > 1:
        signals.append("rules carry DIFFERENT money-mode rates %s — rate differentiation exists "
                       "in the configuration" % EV["money_rates"])

    sub("Signal 3 — rules restricted by product / category / tag / domain")
    restricted = []
    for r in rules:
        if (r.get("product_ids") or r.get("product_category_id") or r.get("product_tag_id")
                or (r.get("product_domain") not in (None, False, "[]"))):
            restricted.append(r["id"])
    kv("rules with a product restriction", "%d %s" % (len(restricted), restricted or ""))
    if restricted:
        signals.append("%d rule(s) are product/category restricted — earn is not uniform across "
                       "the menu" % len(restricted))

    sub("Signal 4 — programs restricted by pricelist (a common tier proxy)")
    if o.has("loyalty.program", "pricelist_ids"):
        pl = [(p["id"], p.get("pricelist_ids")) for p in programs if p.get("pricelist_ids")]
        kv("programs with pricelist_ids", pl or "none")
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
            kv("  tag '%s'" % c.get("name"), "%s partner(s)%s" % (n, flag))
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
def report_cards(o: Odoo) -> None:
    head("How many loyalty cards exist and what is the outstanding point liability?",
         "loyalty.card population")
    if not o.fields("loyalty.card"):
        gap("loyalty.card not readable — population and liability unknown.")
        EV["cards"] = None
        return
    present, absent = o.pick("loyalty.card", ["points", "partner_id", "program_id", "create_date",
                                              "expiration_date", "code", "points_display"])
    if absent:
        gap("loyalty.card has no field(s): %s." % ", ".join(absent))
    total = o.count("loyalty.card", [])
    kv("loyalty.card records", total)
    if not total:
        warn("ZERO cards. Either nobody has ever enrolled, or cards live elsewhere.")
        EV["cards"] = {"count": 0}
        return

    stats = {"count": total}
    if "points" in present:
        a = o.agg("loyalty.card", [], ["points"]) or {}
        kv("sum of points (all cards)", fmt(a.get("points"), 2))
        kv("  aggregation method", a.get("_via"))
        stats["sum_points"] = a.get("points")
        stats["positive"] = o.count("loyalty.card", [["points", ">", 0]])
        kv("cards with points > 0", "%s  (%.1f%% of cards)"
           % (stats["positive"], 100.0 * (stats["positive"] or 0) / total))
        rows, truncated = o.read_all("loyalty.card", [], ["points"])
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
            if EV.get("per_point_values"):
                v = EV["per_point_values"][0]
                stats["liability_jod"] = (stats.get("sum_points") or 0.0) * v
                derive("OUTSTANDING LIABILITY = %s points x %.4f JOD/point = %.2f JOD, at today's "
                       "point value. This is the balance-sheet number a redesign must not ignore."
                       % (fmt(stats.get("sum_points")), v, stats["liability_jod"]))
            else:
                gap("No per_point JOD value found, so the point liability cannot be converted "
                    "to JOD from configuration alone.")
    if "create_date" in present:
        first, _ = o.read_all("loyalty.card", [], ["create_date"], order="create_date asc", cap=1)
        last, _ = o.read_all("loyalty.card", [], ["create_date"], order="create_date desc", cap=1)
        stats["oldest"] = first[0]["create_date"] if first else None
        stats["newest"] = last[0]["create_date"] if last else None
        kv("oldest / newest card create_date", "%s  →  %s" % (stats["oldest"], stats["newest"]))
    if o.has("loyalty.card", "program_id"):
        sub("cards per program")
        for p in EV.get("programs", []):
            kv("  " + str(p.get("name")), o.count("loyalty.card", [["program_id", "=", p["id"]]]))
    EV["cards"] = stats


# ============================================================================ Q6 history
def report_history(o: Odoo) -> None:
    head("What is the REDEMPTION RATE — how many points issued vs actually used?",
         "loyalty.history (numerator and denominator)")
    if not o.fields("loyalty.history"):
        gap("loyalty.history is not present/readable on this build. Redemption rate CANNOT be "
            "measured. Fallback: derive used-points from pos.order.line where reward_id is set.")
        EV["history"] = None
        return
    present, absent = o.pick("loyalty.history", ["issued", "used", "card_id", "description",
                                                 "create_date", "order_id", "order_model"])
    if absent:
        gap("loyalty.history has no field(s): %s." % ", ".join(absent))
    total = o.count("loyalty.history", [])
    kv("loyalty.history rows", total)
    hist = {"count": total}
    if not total:
        warn("ZERO history rows — no earning or redemption has ever been recorded here.")
        EV["history"] = hist
        return
    if "create_date" in present:
        first, _ = o.read_all("loyalty.history", [], ["create_date"], order="create_date asc", cap=1)
        last, _ = o.read_all("loyalty.history", [], ["create_date"], order="create_date desc", cap=1)
        hist["first"] = first[0]["create_date"] if first else None
        hist["last"] = last[0]["create_date"] if last else None
        kv("date range", "%s  →  %s" % (hist["first"], hist["last"]))
    sums = [f for f in ("issued", "used") if f in present]
    if sums:
        a = o.agg("loyalty.history", [], sums) or {}
        kv("aggregation method", a.get("_via"))
        hist["issued"] = a.get("issued")
        hist["used"] = a.get("used")
        kv("TOTAL points ISSUED (denominator)", fmt(hist["issued"]))
        kv("TOTAL points USED   (numerator)", fmt(hist["used"]))
        if hist.get("issued"):
            hist["redemption_rate"] = 100.0 * (hist.get("used") or 0.0) / hist["issued"]
            derive("REDEMPTION RATE = used / issued = %.2f%%. Read it as: this share of every "
                   "point ever awarded has been taken back off an invoice. It is the single "
                   "number that turns a giveback %% into a real cost." % hist["redemption_rate"])
            derive("BREAKAGE = 100%% - redemption = %.2f%% (points issued and never used). "
                   "Note this is a LIFETIME figure, not a cohort figure; points issued recently "
                   "have not had time to be redeemed, so it OVERSTATES breakage."
                   % (100.0 - hist["redemption_rate"]))
        # last 90 days, to show the trend rather than the lifetime blur
        if "create_date" in present:
            since = (datetime.utcnow() - timedelta(days=POS_WINDOW_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
            b = o.agg("loyalty.history", [["create_date", ">=", since]], sums) or {}
            kv("last %d days — issued / used" % POS_WINDOW_DAYS,
               "%s / %s" % (fmt(b.get("issued")), fmt(b.get("used"))))
            if b.get("issued"):
                hist["redemption_rate_90d"] = 100.0 * (b.get("used") or 0.0) / b["issued"]
                derive("Trailing-%dd redemption rate = %.2f%%."
                       % (POS_WINDOW_DAYS, hist["redemption_rate_90d"]))
    EV["history"] = hist


# ============================================================================ Q7 expiry
def report_expiry(o: Odoo) -> None:
    head("Do points expire — is expiration_date populated, and is anything scheduled to enforce it?",
         "loyalty.card.expiration_date + ir.cron")
    exp = {}
    if not o.has("loyalty.card", "expiration_date"):
        gap("loyalty.card.expiration_date does NOT exist on this build. Points cannot expire "
            "through the standard mechanism — the liability is PERMANENT unless custom code "
            "removes it.")
        exp["field"] = False
    else:
        exp["field"] = True
        total = o.count("loyalty.card", []) or 0
        withdate = o.count("loyalty.card", [["expiration_date", "!=", False]])
        exp["with_date"] = withdate
        kv("cards with an expiration_date", "%s of %s (%.1f%%)"
           % (withdate, total, 100.0 * (withdate or 0) / total if total else 0.0))
        if withdate:
            soon, _ = o.read_all("loyalty.card", [["expiration_date", "!=", False]],
                                 ["expiration_date"], order="expiration_date asc", cap=1)
            late, _ = o.read_all("loyalty.card", [["expiration_date", "!=", False]],
                                 ["expiration_date"], order="expiration_date desc", cap=1)
            exp["earliest"] = soon[0]["expiration_date"] if soon else None
            exp["latest"] = late[0]["expiration_date"] if late else None
            kv("earliest / latest expiration_date", "%s → %s" % (exp["earliest"], exp["latest"]))
            today = datetime.utcnow().strftime("%Y-%m-%d")
            past = o.count("loyalty.card", [["expiration_date", "<", today], ["points", ">", 0]])
            kv("cards ALREADY past expiry with points > 0", past)
            if past:
                warn("%s card(s) hold points past their expiry date — evidence that nothing is "
                     "actually sweeping expired points." % past)
                exp["stale"] = past
        else:
            warn("NO card carries an expiration date: in practice points never expire today.")
    sub("scheduled actions that could expire points")
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
                warn("No loyalty/expiry/coupon cron found. Nothing is scheduled to expire points.")
        except Exception as exc:
            gap("ir.cron not readable (%s) — the login may lack admin rights. Re-run as a user "
                "who can read scheduled actions before concluding no cron exists." % str(exc)[:80])
    else:
        gap("ir.cron not readable — cannot say whether an expiry job is scheduled.")
    EV["expiry"] = exp


# ============================================================================ Q8 POS coverage
def report_pos_coverage(o: Odoo, programs: list) -> None:
    head("Which POS shops / branches is each program actually enabled on? "
         "(where are the coverage gaps across the 8 branches?)",
         "pos.config x loyalty.program.pos_config_ids")
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
    cfg_name = {c["id"]: c.get("name") for c in configs}
    covered, matrix = set(), {}
    for p in programs:
        if not p.get("active", True):
            continue
        ids = p.get("pos_config_ids") or []
        if not ids:
            matrix[p["id"]] = "ALL SHOPS (pos_config_ids is empty => no restriction)"
            covered |= {c["id"] for c in active_cfg}
        else:
            matrix[p["id"]] = ", ".join(str(cfg_name.get(i, i)) for i in ids)
            covered |= set(ids)
        kv("  %s (id=%s)" % (p.get("name"), p["id"]), matrix[p["id"]])
    gaps = [c for c in active_cfg if c["id"] not in covered]
    kv("ACTIVE shops with NO active program", len(gaps))
    for c in gaps:
        kv("  GAP: " + str(c.get("name")), "id=%s — customers here earn nothing" % c["id"])
    EV["pos_coverage"] = {"shops": len(configs), "active_shops": len(active_cfg),
                          "uncovered": [c.get("name") for c in gaps]}


# ============================================================================ Q9 member coverage
def report_member_coverage(o: Odoo) -> None:
    head("MEMBER COVERAGE — what share of business is actually identified? "
         "(the single most important unknown)",
         "res.partner with cards + pos.order carrying a partner, last %d days" % POS_WINDOW_DAYS)
    cov = {}
    # -- partners holding a card
    if o.has("loyalty.card", "partner_id"):
        with_partner = o.count("loyalty.card", [["partner_id", "!=", False]])
        kv("cards attached to a partner", with_partner)
        distinct = None
        try:
            res = o.rpc("loyalty.card", "formatted_read_group",
                        [[["partner_id", "!=", False]], ["partner_id"], ["__count"]])
            distinct = len(res or [])
        except Exception:
            try:
                res = o.rpc("loyalty.card", "read_group",
                            [[["partner_id", "!=", False]], ["partner_id"], ["partner_id"]],
                            {"lazy": False})
                distinct = len(res or [])
            except Exception:
                rows, truncated = o.read_all("loyalty.card", [["partner_id", "!=", False]],
                                             ["partner_id"])
                distinct = len({r["partner_id"][0] for r in rows if r.get("partner_id")})
                if truncated:
                    warn("distinct-partner count is a LOWER BOUND (row ceiling hit).")
        cov["partners_with_card"] = distinct
        kv("DISTINCT partners holding >=1 card", distinct)
        anon = (with_partner is not None and o.count("loyalty.card", []) is not None
                and o.count("loyalty.card", []) - with_partner)
        if anon:
            kv("cards with NO partner (anonymous)", anon)
            warn("%s card(s) are not attached to anybody — those points can never be marketed to."
                 % anon)
    else:
        gap("loyalty.card.partner_id absent — cannot count members.")
    total_partners = o.count("res.partner", [])
    cov["total_partners"] = total_partners
    kv("res.partner records (all kinds)", total_partners)

    # -- identified share of POS traffic
    sub("identified share of POS traffic — last %d days" % POS_WINDOW_DAYS)
    if not o.fields("pos.order"):
        gap("pos.order not readable — member coverage CANNOT be measured. This is the most "
            "important gap in this report; fix the access rights and re-run.")
        EV["member_coverage"] = cov
        return
    since = (datetime.utcnow() - timedelta(days=POS_WINDOW_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
    base = [["date_order", ">=", since]]
    if o.has("pos.order", "state"):
        base += [["state", "in", ["paid", "done", "invoiced"]]]
        kv("order filter", "state in (paid, done, invoiced) — excludes drafts/cancelled")
    n_all = o.count("pos.order", base)
    n_id = o.count("pos.order", base + [["partner_id", "!=", False]])
    cov.update(window_days=POS_WINDOW_DAYS, orders=n_all, orders_with_partner=n_id)
    kv("POS orders in window", n_all)
    kv("POS orders carrying a partner", n_id)
    if n_all:
        cov["coverage_pct"] = 100.0 * (n_id or 0) / n_all
        derive("MEMBER COVERAGE = %.2f%% of POS orders are identified. Every giveback %% in any "
               "design must be multiplied by THIS number to become a real cost — an unidentified "
               "invoice costs the program nothing and earns it nothing."
               % cov["coverage_pct"])
    else:
        warn("No POS orders in the window — check date_order/state filters or the window length.")
    if o.has("pos.order", "amount_total"):
        a_all = o.agg("pos.order", base, ["amount_total"]) or {}
        a_id = o.agg("pos.order", base + [["partner_id", "!=", False]], ["amount_total"]) or {}
        cov["value_all"] = a_all.get("amount_total")
        cov["value_identified"] = a_id.get("amount_total")
        kv("value of all orders (JOD)", fmt(cov["value_all"]))
        kv("value of identified orders (JOD)", fmt(cov["value_identified"]))
        if cov.get("value_all"):
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
            per.append((c.get("name"), tot, ident, 100.0 * (ident or 0) / tot))
            kv("  " + str(c.get("name")), "%s orders, %s identified (%.1f%%)"
               % (tot, ident, 100.0 * (ident or 0) / tot))
        cov["per_shop"] = per
    EV["member_coverage"] = cov


# ============================================================================ Q10 tax basis
def probe_money_mode_tax_basis(o: Odoo) -> None:
    head("Does reward_point_mode='money' award points on the TAX-INCLUSIVE or TAX-EXCLUSIVE "
         "amount? (measured, not assumed)",
         "empirical probe: loyalty.history.issued vs the source pos.order amounts")
    print("   Why it matters: at 5 pts/JOD the difference between an 8%% and a 16%% tax base is a")
    print("   direct 7-14%% error in every cost projection. The configuration does not state it,")
    print("   so it is measured here from real awarded points.")
    probe = {"status": "undetermined"}
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
    read_fields = ["issued", link_field]
    if o.has("loyalty.history", "order_model"):
        read_fields.append("order_model")
    dom = [["issued", ">", 0]]
    rows, _ = o.read_all("loyalty.history", dom, read_fields,
                         order="id desc", cap=TAX_PROBE_SAMPLE)
    kv("history rows sampled (most recent, issued>0)", len(rows))
    if not rows:
        gap("No history row with issued>0 — nothing to measure against.")
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
    ofields, _ = o.pick("pos.order", ["amount_total", "amount_tax", "amount_paid"])
    orders = o.rpc("pos.order", "read", [ids, ofields + ["id"]]) or []
    by_id = {x["id"]: x for x in orders}
    incl_ratios, excl_ratios = [], []
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
        if (total - tax) > 0:
            excl_ratios.append(issued / (total - tax))
    kv("history rows matched to a pos.order", len(incl_ratios))
    if len(incl_ratios) < 5:
        gap("Fewer than 5 matched rows — too little evidence to decide. Basis UNDETERMINED.")
        EV["tax_probe"] = probe
        return

    def spread(v):
        v = sorted(v)
        return (v[0], statistics.median(v), v[-1])

    i_lo, i_md, i_hi = spread(incl_ratios)
    e_lo, e_md, e_hi = spread(excl_ratios)
    kv("issued / amount_total  (TAX-INCLUSIVE basis)",
       "median %.4f   [min %.4f, max %.4f]" % (i_md, i_lo, i_hi))
    kv("issued / (total - tax) (TAX-EXCLUSIVE basis)",
       "median %.4f   [min %.4f, max %.4f]" % (e_md, e_lo, e_hi))
    probe.update(incl_median=i_md, excl_median=e_md, matched=len(incl_ratios))
    rates = EV.get("money_rates") or []
    if rates:
        rate = rates[0]
        d_incl, d_excl = abs(i_md - rate), abs(e_md - rate)
        kv("configured money-mode rate", fmt(rate))
        if min(d_incl, d_excl) > 0.25 * rate:
            probe["status"] = "undetermined"
            derive("NEITHER basis reproduces the configured rate (%s) within 25%%. Points on these "
                   "orders were NOT a plain multiple of the invoice — restricted products, "
                   "several rules, or manual adjustments are in play. Basis UNDETERMINED; do not "
                   "assume either." % fmt(rate))
        elif d_incl <= d_excl:
            probe["status"] = "tax_inclusive"
            derive("MEASURED: points track the TAX-INCLUSIVE total (median %.4f vs configured %s; "
                   "the tax-exclusive hypothesis is further off at %.4f). Cost models must "
                   "therefore apply the rate to the GROSS invoice." % (i_md, fmt(rate), e_md))
        else:
            probe["status"] = "tax_exclusive"
            derive("MEASURED: points track the TAX-EXCLUSIVE (net) amount (median %.4f vs "
                   "configured %s; tax-inclusive is further off at %.4f)."
                   % (e_md, fmt(rate), i_md))
    else:
        gap("No money-mode rate was found in the rules, so the measured ratios cannot be "
            "matched against a configured rate. Ratios above are still the empirical earn rate.")
        probe["status"] = "no_configured_rate"
    if incl_ratios:
        derive("EMPIRICAL EARN RATE (whatever the basis) = %.4f points per JOD of gross invoice, "
               "median over %d real awards. If this differs from the configured rate, something "
               "outside loyalty.rule is awarding points." % (i_md, len(incl_ratios)))
    EV["tax_probe"] = probe


# ============================================================================ PREMISE CHECK
def premise_check() -> None:
    print("\n" + "#" * _W)
    print("# PREMISE CHECK — does the verbal description of the live program survive the data?")
    print("# The premise under test: \"flat 5 points per JOD, 1 point = 1 qirsh (0.01 JOD),")
    print("# tiers are names only\".")
    print("#" * _W)
    discrepancies, unknowns = [], []

    # --- P1: flat 5 points per JOD
    sub("PREMISE 1 — earn is a FLAT 5 points per JOD")
    rates = EV.get("money_rates") or []
    order_rates = EV.get("order_rates") or []
    unit_rates = EV.get("unit_rates") or []
    if not EV.get("rules"):
        print("   VERDICT: UNDETERMINED — no loyalty.rule could be read, so no earn rate exists "
              "to compare against.")
        unknowns.append("the earn rate itself (loyalty.rule unreadable)")
    elif not rates and (order_rates or unit_rates):
        print("   VERDICT: REFUTED — earning is NOT per-JOD at all. Live rules earn per order "
              "(%s) and/or per unit (%s)." % (order_rates or "none", unit_rates or "none"))
        discrepancies.append("Earn is not money-based: the live rules use reward_point_mode "
                             "'order'/'unit', so there is no points-per-JOD rate. Any model built "
                             "on '5 points per JOD' is modelling a program that does not exist.")
    elif len(rates) == 1 and abs(rates[0] - CLAIMED_POINTS_PER_JOD) < 1e-9:
        print("   VERDICT: VERIFIED — exactly one money-mode rate exists and it is 5.00 points "
              "per JOD, applied uniformly.")
    elif len(rates) == 1:
        print("   VERDICT: REFUTED — the rate is flat, but it is %s points per JOD, not 5."
              % fmt(rates[0]))
        discrepancies.append("Earn rate is %s pts/JOD, not the stated 5. Every cost figure "
                             "derived from 5%% is wrong by a factor of %.2f."
                             % (fmt(rates[0]), rates[0] / CLAIMED_POINTS_PER_JOD))
    else:
        print("   VERDICT: REFUTED — earning is NOT flat. Distinct money-mode rates found: %s"
              % rates)
        discrepancies.append("Multiple earn rates %s coexist. The program is already "
                             "differentiated; the 'flat' description is wrong." % rates)
    if rates and any(r.get("product_ids") or r.get("product_category_id") or r.get("product_tag_id")
                     for r in EV.get("rules", [])):
        discrepancies.append("At least one rule is product/category restricted, so even a single "
                             "rate is not applied to the whole basket — 'flat' overstates coverage.")

    # --- P2: 1 point = 1 qirsh
    sub("PREMISE 2 — one point is worth 1 qirsh (0.01 JOD)")
    vals = EV.get("per_point_values") or []
    rungs = EV.get("redemption_rungs") or []
    if vals and all(abs(v - QIRSH) < 1e-9 for v in vals):
        print("   VERDICT: VERIFIED — every per_point reward grants exactly 0.0100 JOD per point "
              "(100 points = 1 JOD).")
    elif vals:
        print("   VERDICT: REFUTED — per_point reward value(s) are %s JOD, not 0.01." % vals)
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
        print("   VERDICT: UNDETERMINED — no reward in the live configuration prices a point in "
              "JOD. The '1 qirsh' figure is not in Odoo; it lives in the app, the BFF, or in "
              "staff convention.")
        unknowns.append("where the 1-qirsh point value is actually enforced (not in Odoo)")
    if EV.get("giveback_pct") is not None:
        print("   Cross-check: configured giveback = %.2f%% of qualifying spend (rate x point "
              "value)." % EV["giveback_pct"])
        if abs(EV["giveback_pct"] - 5.0) > 0.01:
            discrepancies.append("Headline giveback is %.2f%% of spend, not the assumed 5%%."
                                 % EV["giveback_pct"])

    # --- P3: tiers are names only
    sub("PREMISE 3 — tiers are names only (no mechanism behind them)")
    signals = EV.get("tier_signals") or []
    if not signals:
        print("   VERDICT: VERIFIED — no tier or multiplier mechanism of any kind exists in the "
              "live configuration: one rate, one program, no partner-based differentiation, no "
              "custom tier fields. Whatever tiers customers are told about are decoration.")
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
    else:
        print("   MEMBER COVERAGE: NOT MEASURED (pos.order unreadable or window empty).")
        unknowns.append("member coverage — the most important unknown; re-run with POS read access")
    h = EV.get("history") or {}
    if h.get("redemption_rate") is not None:
        print("   REDEMPTION RATE: %.2f%% lifetime (%s used of %s issued)%s."
              % (h["redemption_rate"], fmt(h.get("used")), fmt(h.get("issued")),
                 ", %.2f%% trailing %dd" % (h["redemption_rate_90d"], POS_WINDOW_DAYS)
                 if h.get("redemption_rate_90d") is not None else ""))
    else:
        print("   REDEMPTION RATE: NOT MEASURED (loyalty.history absent or empty).")
        unknowns.append("redemption rate / breakage")
    c = EV.get("cards") or {}
    if c.get("sum_points") is not None:
        print("   OUTSTANDING POINTS: %s across %s cards (%s with a positive balance)%s."
              % (fmt(c.get("sum_points")), c.get("count"), c.get("positive"),
                 " = %.2f JOD of liability" % c["liability_jod"] if c.get("liability_jod") else ""))
    else:
        print("   OUTSTANDING POINTS: NOT MEASURED.")
        unknowns.append("outstanding point liability")
    e = EV.get("expiry") or {}
    if e.get("field") is False:
        print("   EXPIRY: no expiration_date field — points are PERMANENT liability.")
        discrepancies.append("Points have no expiry mechanism at all; the liability never ages out.")
    elif e.get("with_date") == 0:
        print("   EXPIRY: the field exists but NO card carries a date — in practice nothing expires.")
        discrepancies.append("expiration_date exists but is unpopulated: expiry is nominal only.")
    elif e.get("with_date"):
        print("   EXPIRY: %s cards carry an expiration date (%s → %s)%s."
              % (e["with_date"], e.get("earliest"), e.get("latest"),
                 "; %s already past expiry but still holding points" % e["stale"]
                 if e.get("stale") else ""))
    pc = EV.get("pos_coverage") or {}
    if pc.get("uncovered"):
        print("   POS GAPS: %d active shop(s) run NO program: %s"
              % (len(pc["uncovered"]), ", ".join(str(x) for x in pc["uncovered"])))
        discrepancies.append("Program coverage is not network-wide: %s have no active program."
                             % ", ".join(str(x) for x in pc["uncovered"]))
    tp = EV.get("tax_probe") or {}
    if tp.get("status") == "tax_inclusive":
        print("   TAX BASIS: points are awarded on the TAX-INCLUSIVE invoice (measured).")
    elif tp.get("status") == "tax_exclusive":
        print("   TAX BASIS: points are awarded on the TAX-EXCLUSIVE amount (measured).")
    else:
        print("   TAX BASIS: UNDETERMINED from the sample — do not assume 8%% or 16%% in any model.")
        unknowns.append("whether points are computed on the gross or net invoice")

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
def main() -> None:
    out_json = None
    if "--json" in sys.argv:
        i = sys.argv.index("--json")
        out_json = sys.argv[i + 1] if len(sys.argv) > i + 1 else "loyalty_audit_evidence.json"

    env = load_env()
    print("=" * _W)
    print("ALMOND — LIVE LOYALTY CONFIGURATION AUDIT (READ-ONLY)")
    print("=" * _W)
    kv("host", env["ODOO_URL"])
    kv("database", env["ODOO_DB"])
    kv("login", env["ODOO_LOGIN"])
    kv("run at (UTC)", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))
    kv("mode", "READ-ONLY — writes are blocked in code (SAFE_METHODS allow-list)")
    o = Odoo(env)
    kv("authenticated uid", o.uid)

    sub("model availability (fields_get probe before anything is read)")
    for model in ("loyalty.program", "loyalty.rule", "loyalty.reward", "loyalty.card",
                  "loyalty.history", "pos.order", "pos.config", "res.partner", "ir.cron"):
        f = o.fields(model)
        kv(model, "%d fields" % len(f) if f else "NOT AVAILABLE")

    programs = report_programs(o)
    rules = report_rules(o, programs)
    report_rewards(o, programs)
    report_tier_mechanism(o, programs, rules)
    report_cards(o)
    report_history(o)
    report_expiry(o)
    report_pos_coverage(o, programs)
    report_member_coverage(o)
    probe_money_mode_tax_basis(o)
    premise_check()

    if out_json:
        try:
            with open(out_json, "w", encoding="utf-8") as fh:
                json.dump(EV, fh, ensure_ascii=False, indent=2, default=str)
            print("\n   Evidence written to %s (machine-readable; feeds the Phase-0 measurement kit)."
                  % out_json)
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
