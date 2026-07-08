# Design — `almond_branch`: a "Branch" dimension + dashboard filter

**Status: DESIGN ONLY** (authored via the ignify Odoo-19 skill, routed by Abu Laith).
No server calls, nothing deployed. Every WRITE/DEPLOY step is flagged in §7.

## Problem
Standard dashboard filter = a **Global Filter** (type: Date / **Relation** / Text).
Branches = POS shops (`pos.config`, 14 of them), but several are **pairs of one
physical branch** (Mecca Street + Mecca Street 2, 8th Circle + 8th Circle 2, …).
A plain `pos.config` filter can't group a pair. We need a real **Branch** dimension
that one Relation filter can span, and it must also be **fast** (463K pos.order).

## Core idea
`almond.branch` groups N `pos.config`. Put `branch_id` on `pos.config`, propagate it
as a **stored + indexed related** field on `pos.order`, and inject it into the
`report.pos.order` **SQL view**. Then a Relation global filter (model `almond.branch`)
matches the pivots' `branch_id`. **The same stored+indexed `branch_id` on pos.order
also fixes the earlier dashboard slowness** (no per-row hop through pos.config).

## Module layout
```
almond_branch/
├── __manifest__.py            # post_init_hook: post_init_map_branches
├── models/ almond_branch.py · pos_config.py · pos_order.py · report_pos_order.py
├── security/ ir.model.access.csv · almond_branch_security.xml
├── views/ almond_branch_views.xml · pos_config_views.xml
├── data/ almond_branch_data.xml          # 9 branch records (noupdate)
├── hooks.py                              # name-based POS→branch mapping (pairs merged)
└── migrations/19.0.1.0.0/post-migration.py  # fast SQL backfill of 463K rows
```

## 1) Model + pos.config link
```python
class AlmondBranch(models.Model):
    _name = 'almond.branch'; _description = 'Branch (groups multiple POS shops)'
    name = fields.Char(required=True, translate=True)
    company_id = fields.Many2one('res.company', required=True, index=True,
                                 default=lambda s: s.env.company)
    active = fields.Boolean(default=True)
    pos_config_ids = fields.One2many('pos.config', 'branch_id')
    _unique_name_company = models.Constraint('UNIQUE(name, company_id)',
        'A branch with this name already exists for this company.')

class PosConfig(models.Model):
    _inherit = 'pos.config'
    branch_id = fields.Many2one('almond.branch', string='Branch', index=True,
        domain="[('company_id','=',company_id)]")
```
Odoo-19: `models.Constraint` (not `_sql_constraints`); M2O is **not** auto-indexed →
`index=True` required; `pos.config` is `_inherit` → no new ACL.

## 2) The crux
**pos.order — stored + indexed related** (materialises the column, backfilled on install):
```python
class PosOrder(models.Model):
    _inherit = 'pos.order'
    branch_id = fields.Many2one('almond.branch', related='config_id.branch_id',
                                store=True, index=True, readonly=True)
    _branch_date_idx = models.Index('(branch_id, date_order)')  # filter+date aggregate
```
**report.pos.order — it's a SQL view (`_auto=False`)**, so a stored field is impossible;
declare a non-stored field and extend the view SQL:
```python
class ReportPosOrder(models.Model):
    _inherit = 'report.pos.order'
    branch_id = fields.Many2one('almond.branch', readonly=True)   # maps a view column
    def _select(self): return super()._select() + ", pc.branch_id AS branch_id"
    def _from(self):   return super()._from() + " LEFT JOIN pos_config pc ON pc.id = ps.config_id"
    # NO _group_by override — see verified notes.
```
✅ **VERIFIED against Odoo 19 official source (`point_of_sale/report/pos_order_report.py`):**
- The view is built from separate `_select()` / `_from()` methods; `init()` runs
  `CREATE VIEW … (_select() _from())`. Overriding these two is the correct seam.
- **Correction #1 — the report does NOT join `pos_config`.** It joins `pos_session AS ps`
  and exposes `ps.config_id`. So the join goes off the **session**:
  `LEFT JOIN pos_config pc ON pc.id = ps.config_id` (NOT `s.config_id`).
  Aliases: `s` = `pos_order`, `l` = `pos_order_line`, `ps` = `pos_session`.
- **Correction #2 — do NOT override `_group_by()`.** In v19 it returns `""` and `init()`
  never concatenates it — the view is **line-level** (`1 AS nbr_lines`, `l.id AS id`),
  no GROUP BY. A group-by override is a no-op / risk.
The view recomputes at read time → **no backfill** needed for the report (only pos.order).

## 3) Security (ACL for the new model only)
`ir.model.access.csv`: rows for `almond.branch` × (branch user RO, branch manager RW,
`point_of_sale.group_pos_user` RO so the filter can list branches). No rows for the
`_inherit` models. Multi-company `ir.rule` (global) on `almond.branch`.
Groups via **`res.groups.privilege`** (Odoo-19 replaces `category_id`).

## 4) Dashboard filter (UI, no code)
Open dashboard → **Filters → Add → Relation** → related model **Branch (`almond.branch`)**
→ **field-match** it to `branch_id` on every pivot built on `pos.order`/`report.pos.order`
→ Save. Selecting a branch pushes `branch_id in [ids]` → includes all its POS in one click.
*(Editing a dashboard = WRITE → dev first; prod needs APPROVE PROD.)*

## 5) Data — map 14 POS → 9 branches (pairs merged)
`data/almond_branch_data.xml` creates 9 branches (noupdate). `hooks.py` maps by name
(idempotent), merging "…2" pairs, and sets each branch's company from its shop:
```python
POS_TO_BRANCH = {'Mecca Street':'branch_mecca_street','Mecca Street 2':'branch_mecca_street',
 '8th Circle':'branch_8th_circle','8th Circle 2':'branch_8th_circle', ... 'event':'branch_event'}
```
Unmapped configs are **skipped, never guessed**. Optional fast backfill:
```sql
UPDATE pos_order o SET branch_id = c.branch_id FROM pos_config c
 WHERE c.id = o.config_id AND o.branch_id IS DISTINCT FROM c.branch_id;
```

## 6) Performance
Indexes: `almond.branch.company_id`, `pos.config.branch_id`, `pos.order.branch_id`,
composite `(branch_id, date_order)` on pos.order. **This single stored+indexed
`branch_id` fixes BOTH the branch filter and the dashboard slowness.** Don't over-index
(pos.order.line 994K is untouched by this design).

## 7) Abu Laith ship pipeline (WRITE/DEPLOY flagged)
1. introspect — ✅ DONE against Odoo 19 source: `_select`/`_from` seam, `ps`=pos_session/`s`=pos_order aliases, no existing pos_config join, no `_group_by`, `pos.config` has no `branch_id`, `res.groups.privilege`+`privilege_id`, `models.Index`/`models.Constraint` all confirmed. Still to confirm on dev: real POS shop names (for the pairs map).
2. author (ignify) — local files.
3. review (tuanle `/odoo-review`).
4. gate (tuanle `/odoo-gate`).
5. **install/update on dev-almond** — WRITE(dev) → explicit "deploy to dev".
6. wire+test filter on a dev dashboard copy — WRITE(dev).
7. promote to prod (module update + dashboard edit) — **WRITE(prod) → `APPROVE PROD`**.

## 8) Phase 2 (optional) — unified filter incl. accounting
`account.move` has no branch. Recommended: **Analytic account per branch** (default the
analytic distribution from the shop) → accounting dashboards filter by analytic; no schema
change. Same `almond.branch` backs both, so one Relation filter spans POS + accounting.
Ship only after Phase 1 is validated on dev.
