# almond_branch — a "Branch" dimension for multi-POS dashboard filtering

Groups several POS shops (`pos.config`) into one physical **Branch** so a single
dashboard **Global Filter (Relation)** can span all POS of a branch in one click.
Design & rationale: [`../../docs/odoo/branch-filter-design.md`](../../docs/odoo/branch-filter-design.md).

**Status: authored (design verified against Odoo 19 source). NOT deployed.**
No server connection. Follow the Abu Laith pipeline: review → gate → dev → prod (`APPROVE PROD`).

## What it adds
- `almond.branch` — the dimension (name + company; groups N `pos.config`).
- `pos.config.branch_id` — assign a shop to a branch (indexed).
- `pos.order.branch_id` — **stored + indexed** related (`config_id.branch_id`); the
  materialised, indexed column that both powers the filter and removes the per-row
  hop through `pos.config` that slowed the dashboards. Composite index `(branch_id, date_order)`.
- `report.pos.order.branch_id` — injected into the SQL view (`_select`/`_from`), so
  pivots built on the POS Orders report can be filtered by branch too.
- Security: `res.groups.privilege` + a Branch Manager group; POS users get read-only
  (so the filter can list branches); multi-company `ir.rule`.

## Before deploy — confirm on dev-almond (read-only)
1. **Real POS names** → edit `POS_TO_BRANCH` in `hooks.py` (only "Mecca Street",
   "8th Circle" and "event" are guessed; add the rest). Unmapped shops are skipped, never guessed.
2. **pos.config form anchor** — `views/pos_config_views.xml` xpaths `field[@name='name']`;
   confirm it resolves on the v19 POS config form, adjust if needed.

## Verified against Odoo 19 source (`point_of_sale/report/pos_order_report.py`)
- View built from `_select()` + `_from()`; `init()` = `CREATE VIEW (_select _from)`.
- Aliases: `s`=`pos_order`, `l`=`pos_order_line`, `ps`=`pos_session`.
- Base report does **not** join `pos_config` → we add `LEFT JOIN pos_config pc ON pc.id = ps.config_id`.
- `_group_by()` returns `''` and is unused (line-level view) → **no** `_group_by` override.

## Install
```
# dev-almond only, after review/gate:
-u almond_branch   # or install fresh
```
`post_init_map_branches` creates the branches and links each shop. Setting
`config.branch_id` triggers the stored-related recompute on `pos.order`, so existing
orders inherit their branch.

### Optional fast backfill (large DB accelerator)
If the install-time ORM recompute over ~463K `pos.order` rows is slow, the same
result can be set directly (run once, after install, on dev; prod needs `APPROVE PROD`):
```sql
UPDATE pos_order o SET branch_id = c.branch_id
FROM pos_config c
WHERE c.id = o.config_id AND o.branch_id IS DISTINCT FROM c.branch_id;
```

## Wire the dashboard filter (UI, no code)
Dashboard → **Filters → Add → Relation** → model **Branch (`almond.branch`)** →
field-match `branch_id` on each pivot over `pos.order` / `report.pos.order` → Save.
(Editing a dashboard is a WRITE → dev first; prod behind `APPROVE PROD`.)
