#!/usr/bin/env python3
"""
Measure Odoo POS against the Wafii loyalty export — the four questions that are
worth money and cannot be answered from the loyalty files alone.

READ-ONLY. Never writes to Odoo. Stdlib only; no pip install.

WHY THIS EXISTS AND NOT tools/loyalty_audit_live.py
    That script hunts Odoo's own loyalty module (loyalty.program / loyalty.card).
    Almond's programme is **Wafii, a third-party system** — those models are
    either absent or unused, so that script would confirm nothing. This one asks
    Odoo only for what Odoo actually holds: the sales it rang up.

WHAT IT ANSWERS, in order of value

  Q1  SUBSTITUTION — worth ~15,000 JOD/yr of design assumption.
      The Wafii export records `amount_spent = points/100` on every redemption
      row, so the basket on a redemption visit is invisible and k could only be
      bounded at 0.35-0.80. Odoo has the till receipt. If a redemption ticket
      also carries paid lines, the reward did NOT displace a purchase and k is
      low; if the ticket is points-only, it did. 200 tickets settle it.

  Q2  THE COVERAGE DENOMINATOR.
      Every coverage figure in the analysis divides by an assumed 3,238 invoices
      a day taken from the ops dashboard. This counts them, per branch, per day,
      from the source. If the real number differs, every coverage and cost
      percentage moves with it.

  Q3  THE THREE DARK BRANCHES AND THE TWO THAT STOPPED.
      Khalda, Shafa Badran and Madina have never issued a loyalty point in 980
      days; Saudi Hospital stopped dead on 2026-05-31 and City Mall collapsed in
      July 2026. Odoo says whether those tills were selling anyway — which
      separates "no integration" from "no trade".

  Q4  IS ODOO'S OWN LOYALTY MODULE INSTALLED AND DOING ANYTHING?
      If it is live alongside Wafii, two systems are granting points and the
      liability is understated. Cheap to check, expensive to miss.

USAGE
    export ODOO_URL=https://ag-almond-coffee-house.odoo.com
    export ODOO_DB=ag-almond-coffee-house-master1-29151411
    export ODOO_LOGIN=API@ALMONDJO.COM
    export ODOO_API_KEY=...                 # never commit this
    python3 tools/odoo_pos_measure.py                       # all four
    python3 tools/odoo_pos_measure.py --from 2026-01-01 --to 2026-09-01
    python3 tools/odoo_pos_measure.py --redemptions redemptions.csv   # enables Q1

  Odoo only went live at the start of 2026, so the window defaults to
  2026-01-01 → today and anything earlier is not there to be measured.

  For Q1, pass a CSV of redemption rows exported from Wafii with at least
  `store_id,datetime,amount_spent` (the loyalty files already have these). The
  script matches each to a pos.order on branch + date + amount and reports what
  else was on the ticket.
"""
import argparse
import collections
import csv
import datetime as dt
import os
import sys
import xmlrpc.client

# Wafii store_id -> the fragment that identifies the branch in Odoo. Matching is
# fuzzy on purpose: pos.config names drift, and a wrong exact-match would read as
# "the branch sold nothing", which is precisely the conclusion under test.
BRANCH_HINTS = {
    "Rabieh": ["rabieh", "rabia", "الرابية"],
    "Mecca": ["mecca", "makkah", "مكة", "مكّة"],
    "Almond 8th circle": ["8th", "eighth", "thamen", "الثامن"],
    "Almond Uni Street": ["uni", "university", "jamia", "الجامعة"],
    "Almond City Mall": ["city mall", "citymall", "ستي"],
    "Almond Saudi Hospital": ["saudi", "hospital", "السعودي"],
    # Present in the POS, absent from loyalty for all 980 days — the point of Q3.
    "Khalda": ["khalda", "خلدا"],
    "Shafa Badran": ["shafa", "badran", "شفا"],
    "Madina": ["madina", "medina", "المدينة"],
}


def env(name, required=True):
    v = os.environ.get(name, "").strip()
    if required and not v:
        sys.exit(f"Missing {name}. See the docstring at the top of this file.")
    return v


def connect():
    url, db = env("ODOO_URL").rstrip("/"), env("ODOO_DB")
    login, key = env("ODOO_LOGIN"), env("ODOO_API_KEY")
    common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common", allow_none=True)
    try:
        uid = common.authenticate(db, login, key, {})
    except Exception as e:
        sys.exit(f"Could not reach {url}: {e}\nRun this from a machine that can see Odoo.")
    if not uid:
        sys.exit("Authentication failed — check ODOO_DB, ODOO_LOGIN and ODOO_API_KEY.")
    models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object", allow_none=True)
    ver = common.version().get("server_version", "?")
    print(f"Connected: {url}  db={db}  uid={uid}  Odoo {ver}\n")
    return db, uid, key, models


def make_call(db, uid, key, models):
    def call(model, method, *args, **kw):
        return models.execute_kw(db, uid, key, model, method, list(args), kw)
    return call


def has_model(call, model):
    """True if the model exists AND is readable — a missing model raises."""
    try:
        call(model, "search_count", [[]])
        return True
    except Exception:
        return False


def paged_search_read(call, model, domain, fields, page=2000, cap=400_000):
    """search_read in pages. Odoo's default limit silently truncates, and a short
    read here would understate exactly the counts this script exists to verify."""
    out, offset = [], 0
    while offset < cap:
        batch = call(model, "search_read", domain, fields=fields, limit=page, offset=offset, order="id")
        out.extend(batch)
        if len(batch) < page:
            return out
        offset += page
    print(f"  ! hit the {cap:,} row cap on {model} — figures below are a FLOOR", file=sys.stderr)
    return out


def resolve_branches(call):
    """Map every pos.config to a Wafii branch label, and report what did not match."""
    configs = call("pos.config", "search_read", [[]], fields=["name"])
    mapping, unmatched = {}, []
    for c in configs:
        low = (c["name"] or "").lower()
        hit = next((b for b, keys in BRANCH_HINTS.items() if any(k in low for k in keys)), None)
        if hit:
            mapping[c["id"]] = hit
        else:
            unmatched.append(c["name"])
    print("=== pos.config → branch ===")
    for b in sorted(set(mapping.values())):
        names = [c["name"] for c in configs if mapping.get(c["id"]) == b]
        print(f"   {b:26} ← {', '.join(names)}")
    if unmatched:
        print(f"   UNMATCHED pos.config ({len(unmatched)}): {', '.join(unmatched)}")
        print("   → add a hint to BRANCH_HINTS; unmatched tills are excluded from Q2/Q3.")
    if not mapping:
        print("   ! nothing matched. Q2 and Q3 will be empty until BRANCH_HINTS is fixed.")
    print()
    return mapping


# --------------------------------------------------------------------- Q2 / Q3
def q2_q3(call, mapping, d_from, d_to):
    print("=== Q2/Q3 — what the tills actually sold ===")
    orders = paged_search_read(
        call, "pos.order",
        [[("date_order", ">=", f"{d_from} 00:00:00"), ("date_order", "<=", f"{d_to} 23:59:59"),
          ("state", "in", ["paid", "done", "invoiced"])]],
        ["date_order", "amount_total", "config_id", "partner_id"],
    )
    if not orders:
        print("   no paid pos.order rows in the window — check the dates and the state filter.\n")
        return
    days = (dt.date.fromisoformat(d_to) - dt.date.fromisoformat(d_from)).days + 1
    total = sum(o["amount_total"] or 0 for o in orders)
    with_partner = sum(1 for o in orders if o.get("partner_id"))
    print(f"   window {d_from} → {d_to}  ({days} days)")
    print(f"   invoices {len(orders):,}  =  {len(orders)/days:,.0f}/day   (the analysis assumed 3,238/day)")
    print(f"   value    {total:,.0f} JOD  =  {total/days:,.0f}/day   avg ticket {total/len(orders):.2f}")
    print(f"   carrying a partner: {with_partner:,} ({with_partner/len(orders)*100:.1f}%)"
          "   <- an upper bound on identification")

    per = collections.defaultdict(lambda: [0, 0.0, set()])
    for o in orders:
        cid = o["config_id"][0] if o.get("config_id") else None
        b = mapping.get(cid, "(unmapped)")
        day = o["date_order"][:10]
        per[b][0] += 1
        per[b][1] += o["amount_total"] or 0
        per[b][2].add(day)
    print("\n   per branch — 'trading days' is what separates a dead till from a dead branch:")
    print(f"   {'branch':26} {'invoices':>9} {'/day':>8} {'value':>12} {'trading days':>13}")
    for b, (n, v, dset) in sorted(per.items(), key=lambda x: -x[1][0]):
        print(f"   {b:26} {n:9,} {n/days:8,.0f} {v:12,.0f} {len(dset):13,}")

    print("\n   monthly, to date the outages (loyalty stopped: Saudi Hospital after 2026-05-31,"
          "\n   City Mall in July 2026 — if Odoo shows normal trade, the integration failed, not the branch):")
    mon = collections.defaultdict(lambda: collections.Counter())
    for o in orders:
        cid = o["config_id"][0] if o.get("config_id") else None
        mon[mapping.get(cid, "(unmapped)")][o["date_order"][:7]] += 1
    months = sorted({m for c in mon.values() for m in c})
    print(f"   {'branch':26} " + " ".join(f"{m[2:]:>7}" for m in months))
    for b in sorted(mon):
        print(f"   {b:26} " + " ".join(f"{mon[b].get(m,0):7,}" for m in months))
    print()


# -------------------------------------------------------------------------- Q1
def q1(call, mapping, path, tol=0.02, limit=200):
    print("=== Q1 — does a redemption ticket also carry paid items? ===")
    try:
        rows = [r for r in csv.DictReader(open(path, encoding="utf-8-sig"))]
    except OSError as e:
        print(f"   cannot read {path}: {e}\n")
        return
    reds = [r for r in rows if str(r.get("is_redeem", "")).strip() == "1"][:limit]
    if not reds:
        print(f"   no rows with is_redeem=1 in {path}\n")
        return
    rev = collections.defaultdict(list)
    for cid, b in mapping.items():
        rev[b].append(cid)

    matched = unmatched = 0
    points_only = mixed = 0
    extra_values = []
    for r in reds:
        try:
            burnt = float(r["amount_spent"])
            day = dt.datetime.strptime(r["datetime"].strip(), "%d-%m-%Y").date().isoformat()
        except (KeyError, ValueError):
            continue
        cids = rev.get((r.get("store_id") or "").strip(), [])
        if not cids:
            unmatched += 1
            continue
        # The redeemed value is a lower bound on the ticket: a points-only ticket
        # totals the burn, a mixed one totals more.
        cand = call("pos.order", "search_read",
                    [[("date_order", ">=", f"{day} 00:00:00"), ("date_order", "<=", f"{day} 23:59:59"),
                      ("config_id", "in", cids), ("amount_total", ">=", burnt - tol),
                      ("state", "in", ["paid", "done", "invoiced"])]],
                    fields=["amount_total", "lines"], limit=40)
        if not cand:
            unmatched += 1
            continue
        best = min(cand, key=lambda o: abs((o["amount_total"] or 0) - burnt))
        matched += 1
        extra = (best["amount_total"] or 0) - burnt
        extra_values.append(extra)
        if extra <= tol:
            points_only += 1
        else:
            mixed += 1

    print(f"   redemption rows tried : {len(reds)}")
    print(f"   matched to a ticket   : {matched}   unmatched: {unmatched}")
    if not matched:
        print("   → no matches. Widen --tol, or the branch mapping is wrong.\n")
        return
    med = sorted(extra_values)[len(extra_values) // 2]
    print(f"   ticket == points burnt (points-only) : {points_only:4}  ({points_only/matched*100:.1f}%)")
    print(f"   ticket  > points burnt (mixed)       : {mixed:4}  ({mixed/matched*100:.1f}%)")
    print(f"   median paid value beyond the burn    : {med:.2f} JOD")
    print()
    print("   HOW TO READ THIS — it decides a ~15,000 JOD/yr line in the design:")
    print("     mostly POINTS-ONLY  → the reward replaced a sale. k is HIGH (~0.8);")
    print("                            the design's k=0.7 is about right and the ladder is expensive.")
    print("     mostly MIXED        → the reward rode along with a sale it did not replace.")
    print("                            k is LOW (~0.3); the programme costs roughly half what is modelled.")
    print("   The loyalty export cannot tell these apart — it records only the burn.\n")


# -------------------------------------------------------------------------- Q4
def q4(call):
    print("=== Q4 — is Odoo's own loyalty module also granting points? ===")
    if not has_model(call, "loyalty.program"):
        print("   loyalty.program not present or not readable — Odoo loyalty is not in play.")
        print("   Good: Wafii is the only grantor, and the liability has one source.\n")
        return
    progs = call("loyalty.program", "search_read", [[]],
                 fields=["name", "program_type", "active", "trigger"])
    print(f"   loyalty.program rows: {len(progs)}")
    for p in progs:
        print(f"      [{p['id']}] {p['name']}  type={p.get('program_type')} "
              f"active={p.get('active')} trigger={p.get('trigger')}")
    if has_model(call, "loyalty.card"):
        n = call("loyalty.card", "search_count", [[]])
        print(f"   loyalty.card rows: {n:,}")
        if n:
            print("   ⚠ A SECOND grantor exists alongside Wafii. Points may be issued twice and")
            print("     the liability computed from the Wafii export would be understated.")
    print()


def main():
    ap = argparse.ArgumentParser(description="Read-only Odoo POS measurement for the loyalty redesign.")
    today = dt.date.today().isoformat()
    ap.add_argument("--from", dest="d_from", default="2026-01-01",
                    help="window start (default 2026-01-01 — Odoo went live at the start of 2026)")
    ap.add_argument("--to", dest="d_to", default=today, help="window end (default today)")
    ap.add_argument("--redemptions", help="CSV of Wafii rows; enables Q1")
    ap.add_argument("--tol", type=float, default=0.02, help="JOD tolerance when matching a ticket")
    ap.add_argument("--limit", type=int, default=200, help="how many redemptions to test (default 200)")
    a = ap.parse_args()

    db, uid, key, models = connect()
    call = make_call(db, uid, key, models)
    mapping = resolve_branches(call)
    q2_q3(call, mapping, a.d_from, a.d_to)
    if a.redemptions:
        q1(call, mapping, a.redemptions, a.tol, a.limit)
    else:
        print("=== Q1 skipped — pass --redemptions <wafii.csv> to run the substitution test ===\n")
    q4(call)
    print("Done. Nothing was written to Odoo.")


if __name__ == "__main__":
    main()
