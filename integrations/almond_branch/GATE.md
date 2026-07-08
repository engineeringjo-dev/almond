# /odoo-gate — deploy-readiness evidence · `almond_branch`

**Gate status: READY for dev-almond install.** Prod (`ag-almond-coffee-house-master1`)
stays locked behind a typed `APPROVE PROD`. Nothing has been deployed.

## 1) What changes (scope)
- **New model** `almond.branch` (a dimension grouping POS shops). New table, new ACL.
- **`pos.config`** `_inherit`: adds `branch_id` (indexed M2O) + one form field.
- **`pos.order`** `_inherit`: adds `branch_id` (stored related, part of composite index).
  → **DDL on a large table**: adds a column + index to `pos_order` (~10^5 rows) and
  backfills it. This is the only heavy step.
- **`report.pos.order`** `_inherit`: recreates the SQL view with one extra column + join.
- **Security**: 1 privilege, 1 group, 2 ACL rows, 1 global multi-company rule.
- No change to any existing field, view logic, or business flow. No external network.

## 2) Evidence collected
**Static (this repo):** `py_compile` clean on all `.py`; all 3 XML well-formed; manifest
evaluates; ACL CSV parses; map validated = 14 POS → 9 branches, every branch key has a
display name.

**Source-verified (official Odoo 19 `point_of_sale/report/pos_order_report.py`):**
view built from `_select()`+`_from()`; aliases `s`=pos_order / `l`=pos_order_line /
`ps`=pos_session; base report has **no** pos_config join; `_group_by()` unused. Our
override appends the column + `LEFT JOIN pos_config pc ON pc.id = ps.config_id` at the end.

**Live-verified (read-only JSON-RPC on the real instance):**
- `base.module_category_sales_point_of_sale` exists (id 61); `res.groups.privilege` exists.
- `point_of_sale.pos_config_view_form` exists; field `name` appears **exactly once** → xpath anchor safe.
- `point_of_sale.menu_point_root` / `group_pos_user` / `group_pos_manager` all exist.
- Fleet: 14 `pos.config` across 4 companies → 9 branches; no pre-existing `branch` field on pos.order/account.move.

**Review (/odoo-review):** no BLOCKER. HIGH (double recompute) mitigated; LOW/NIT items applied.

## 3) Pre-deploy checklist
- [x] Branch map confirmed from live fleet (`hooks.py`).
- [x] External xmlids confirmed present on the target instance.
- [x] `pos.config` form `name` anchor confirmed unique.
- [ ] **Backup / snapshot** the target DB before `-i` (adds a column + index to `pos_order`).
- [ ] Install **off-peak** (the `pos_order` column add + backfill briefly locks writes).
- [ ] Run on **dev-almond first**; do not `-i` on prod without `APPROVE PROD`.

## 4) Install (dev-almond)
```bash
# module lives at integrations/almond_branch -> ensure it's on the addons_path
odoo-bin -d dev-almond -i almond_branch --stop-after-init
```
Expected in the log: `almond_branch: mapped 14 POS shop(s) into 9 branch(es); skipped (not found): none`.

## 5) Post-install verification (read-only)
```python
# odoo-bin shell -d dev-almond
env['almond.branch'].search_count([])                      # -> 9
env['pos.config'].search_count([('branch_id','=',False)])  # -> 0 (all 14 mapped)
# every order inherited its branch:
env.cr.execute("SELECT count(*) FROM pos_order WHERE branch_id IS NULL AND config_id IS NOT NULL")
env.cr.fetchone()                                          # -> (0,)
# report view exposes the column:
env['report.pos.order'].read_group([], ['price_total:sum'], ['branch_id'])
```
Then in the UI: open a **dev copy** of a dashboard → Filters → Add → Relation →
`almond.branch` → field-match `branch_id` → pick a branch → confirm both its POS appear.

## 6) Rollback
```bash
odoo-bin -d dev-almond --uninstall almond_branch --stop-after-init
```
Uninstall drops `almond.branch`, the `pos.config.branch_id` / `pos.order.branch_id`
columns + indexes, and restores the stock `report.pos.order` view. (Branches created by
the hook have no `ir.model.data`, so they vanish with their table — no orphans.) The
dashboard filter must be removed from any dashboard it was added to (UI).

## 7) Promotion to prod — GATED
After dev install + filter test pass, promotion is a **separate, human-approved** step:
module install on `ag-almond-coffee-house-master1` **only** after a typed `APPROVE PROD`,
off-peak, with a fresh snapshot. Dashboard edits on prod are likewise WRITE(prod).
