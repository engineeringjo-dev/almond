# Pre-flight Checklist for a New Module

Run through this before considering the module done.

## Structure
- [ ] `__manifest__.py` version prefix matches target Odoo series (`19.0.x.y.z`)
- [ ] `depends` lists every module whose model/view/group you reference
- [ ] `data` list order respects dependency order (groups → ACL → rules →
      cron/actions → views → menus) — see `module-structure.md`

## Models
- [ ] `_name` and `_description` set on every model
- [ ] SQL constraints via `models.Constraint(...)` (or `_sql_constraints`)
      for any uniqueness/invariant enforceable at the DB level
- [ ] `@api.constrains` for anything not expressible as a SQL constraint

## Security
- [ ] `security/ir.model.access.csv` has at least one row per model —
      missing this means **silent** access denial, not an error
- [ ] Any custom `res.groups` are defined before the ACL/rules that
      reference them in the `data` list
- [ ] Record rules use `global="True"` only when the AND-combination
      semantics are actually intended

## Views
- [ ] List views use `<list>`, not `<tree>` (17.0+)
- [ ] `invisible="python_expr"` / `readonly="python_expr"` used directly on
      elements — no `attrs="{...}"` dict (removed in 17.0+)
- [ ] Search view exists for any model users will look up by more than id
- [ ] Every `ir.actions.act_window` referenced by a menu item is defined
      before the menu XML is loaded
- [ ] `view_mode` on window actions lists every view type actually needed,
      default view first

## Automation
- [ ] Cron records set both `interval_number` and `interval_type`
- [ ] Cron records default to `active eval="False"` if they shouldn't run
      until the feature is configured
- [ ] Long-running cron/batch methods commit periodically
      (`self.env.cr.commit()`) so a crash doesn't lose all progress
- [ ] Server actions only used for menu/list/automation-level triggers —
      single-record workflow transitions use a `type="object"` form button
      instead

## Before writing anything from scratch
- [ ] Checked `https://github.com/odoo/odoo/tree/<version>.0/addons` for an
      existing model/view/cron doing something similar
- [ ] Checked OCA (`https://github.com/OCA`) for a community module already
      solving this
- [ ] If something similar exists, inherited/extended it rather than
      duplicating logic
