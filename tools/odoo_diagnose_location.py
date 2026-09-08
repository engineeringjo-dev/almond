#!/usr/bin/env python3
"""
Diagnose: "the roastery's ready-to-issue location doesn't show all items".

READ-ONLY — performs no writes. Run it from a machine that can reach Odoo.

Usage:
    export ODOO_URL=https://ag-almond-coffee-house.odoo.com
    export ODOO_DB=ag-almond-coffee-house-master1     # or dev-almond
    export ODOO_USER=you@example.com
    export ODOO_KEY=<API key from Preferences → Account Security>
    python3 tools/odoo_diagnose_location.py "الجاهز للصرف"

Checks, in order of likelihood:
  1. Products not inventory-tracked  -> they can never have a quant anywhere
  2. Zero-quantity                    -> no quant row exists, so nothing renders
  3. Location usage / type            -> a "view" location holds no stock itself
  4. Multi-location setting off       -> per-location detail is hidden in the UI
  5. Archived products                -> hidden by the default filter
"""
import os
import sys
import xmlrpc.client

URL = os.environ.get("ODOO_URL", "").rstrip("/")
DB = os.environ.get("ODOO_DB", "")
USER = os.environ.get("ODOO_USER", "")
KEY = os.environ.get("ODOO_KEY", "")
NEEDLE = sys.argv[1] if len(sys.argv) > 1 else "صرف"

if not all([URL, DB, USER, KEY]):
    sys.exit("Set ODOO_URL, ODOO_DB, ODOO_USER, ODOO_KEY first (see docstring).")

common = xmlrpc.client.ServerProxy(f"{URL}/xmlrpc/2/common")
uid = common.authenticate(DB, USER, KEY, {})
if not uid:
    sys.exit("Authentication failed — check ODOO_DB / ODOO_USER / ODOO_KEY.")
models = xmlrpc.client.ServerProxy(f"{URL}/xmlrpc/2/object")


def call(model, method, *args, **kw):
    return models.execute_kw(DB, uid, KEY, model, method, list(args), kw)


print(f"Connected: {URL} db={DB} uid={uid}")
print(f"Odoo version: {common.version().get('server_version')}\n")

# Which "storable" field does this version use? (17 = type='product',
# 18/19 = type='consu' + is_storable). Introspect instead of assuming.
tmpl_fields = call("product.template", "fields_get", [], ["type"])
has_is_storable = bool(call("product.template", "fields_get", ["is_storable"], ["type"]))
print(f"[schema] product.template.is_storable present: {has_is_storable}")

# ---------------------------------------------------------------- locations
locs = call(
    "stock.location", "search_read",
    [["|", ("name", "ilike", NEEDLE), ("complete_name", "ilike", NEEDLE)]],
    fields=["complete_name", "usage", "active", "company_id"],
)
if not locs:
    sys.exit(f"\nNo location matching {NEEDLE!r}. Re-run with the exact name.")

print(f"\n=== Locations matching {NEEDLE!r} ===")
for l in locs:
    flag = "" if l["usage"] == "internal" else "  <-- CHECK #3: not 'internal', holds no stock itself"
    print(f"  [{l['id']}] {l['complete_name']}  usage={l['usage']} active={l['active']}{flag}")

loc_ids = [l["id"] for l in locs]

# ------------------------------------------------------------------- quants
quants = call(
    "stock.quant", "search_read", [[("location_id", "in", loc_ids)]],
    fields=["product_id", "quantity", "location_id"], limit=5000,
)
nonzero = [q for q in quants if q["quantity"] != 0]
print(f"\n=== Stock at those locations ===")
print(f"  quant rows: {len(quants)}   with qty != 0: {len(nonzero)}")
if len(quants) and not nonzero:
    print("  <-- CHECK #2: rows exist but all zero; the UI hides zero quantities.")

# ------------------------------------------- products that can never show up
print("\n=== CHECK #1: products that are NOT inventory-tracked ===")
if has_is_storable:
    domain = [("is_storable", "=", False), ("type", "!=", "service")]
else:
    domain = [("type", "!=", "product"), ("type", "!=", "service")]
untracked = call(
    "product.template", "search_read", domain,
    fields=["name", "type"], limit=200,
)
total = call("product.template", "search_count", [[("type", "!=", "service")]])
print(f"  {len(untracked)} of {total} non-service products are NOT tracked")
if untracked:
    print("  These can NEVER appear in any location. Most likely root cause.")
    for p in untracked[:25]:
        print(f"    - {p['name']}  (type={p['type']})")
    if len(untracked) > 25:
        print(f"    ... and {len(untracked) - 25} more")

# ------------------------------------------------------------ other filters
print("\n=== CHECK #4/#5: settings & archived ===")
multi = call("res.users", "has_group", uid, "stock.group_stock_multi_locations")
print(f"  multi-locations group enabled for this user: {multi}"
      + ("" if multi else "   <-- CHECK #4: per-location detail hidden in the UI"))
archived = call("product.template", "search_count", [[("active", "=", False)]])
print(f"  archived products: {archived}"
      + ("   <-- CHECK #5: hidden by the default filter" if archived else ""))

print("\nDone. Fix order: #1 (enable Track Inventory + opening inventory) → #3 → #4 → #2/#5.")
