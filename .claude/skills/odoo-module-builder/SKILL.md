---
name: odoo-module-builder
description: Scaffold and write new Odoo modules (targeting 19.0, applicable back to 17.0) the standard/correct way — manifest, models, security, list/search views with filters, cron jobs, server actions, menus — using patterns copied verbatim from the official odoo/odoo GitHub repo, not invented from scratch. Use when the user asks to create a new Odoo module/addon, add a scheduled action/cron, add a search view with filters, add a server action or workflow button, or wants an Odoo module reviewed for standard-compliance.
---

# Odoo Module Builder

You are building a new Odoo module (or a piece of one — a cron, a view, an
action) and must follow Odoo's own conventions, not a plausible-looking
approximation of them.

**Core rule: don't invent XML/Python shapes from memory.** Odoo's view and
action syntax has changed across versions (e.g. `<tree>` → `<list>`,
`attrs="{...}"` → direct `invisible="python_expr"`). This skill's
`references/` files are copied verbatim from shipped Odoo core addons so you
copy a shape that is *known to work*, then adapt names/fields to the task.

## Workflow

1. **Detect the target version.** Read `__manifest__.py` in the working
   module (the `version` key's first number is the Odoo version). If there
   is no existing module, ask the user or default to 19.0.
2. **Don't reinvent the wheel.** Before writing new logic, check whether
   Odoo core or OCA already solves this:
   - Core: `https://github.com/odoo/odoo/tree/<version>.0/addons`
   - OCA: `https://github.com/OCA` (search by keyword)
   If a similar model/view/cron already exists, read it and adapt it instead
   of writing from a blank page.
3. **Scaffold in this order** (matches core's own `data` load order — later
   files may reference records defined earlier):
   ```
   __manifest__.py
   __init__.py
   models/__init__.py, models/<model>.py
   security/<module>_groups.xml       (if custom groups needed)
   security/ir.model.access.csv       (mandatory — every model needs a row)
   security/ir_rule.xml               (if record rules needed)
   data/ir_cron_data.xml              (if scheduled actions needed)
   data/ir_action_data.xml            (if server actions needed)
   views/<model>_views.xml            (list/search/form + act_window)
   views/menus.xml
   ```
4. **Pull the concrete pattern from `references/`** for whichever piece
   you're writing (see table below) instead of guessing the XML shape.
5. **Verify before calling it done:**
   - Every model has an `ir.model.access.csv` row (Odoo silently denies
     access otherwise — a very common bug).
   - Every window action referenced by a menu item actually exists.
   - `<list>` not `<tree>` for new top-level list views in 17.0+.
   - `invisible="python_expr"` / `readonly="python_expr"` directly on the
     field/button, not `attrs="{...}"` (removed in 17.0+).
   - Cron `code` state records set both `interval_number` and
     `interval_type`.

## Reference files (real Odoo core code, cited by source path)

| Need | File |
|------|------|
| Manifest, module layout, load order | `references/module-structure.md` |
| Model definition, fields, constraints, CRUD overrides | `references/models.md` |
| List view, search view, filters, group-by | `references/views-search-filters.md` |
| Form view, buttons, statusbar, chatter | `references/form-views.md` |
| Scheduled actions / cron jobs | `references/cron-jobs.md` |
| Server actions, object/action buttons | `references/server-actions.md` |
| Security: groups, ACL csv, record rules | `references/security.md` |
| Full pre-flight checklist | `references/checklist.md` |

Each reference file states the exact `addons/...` source path in the
`odoo/odoo` repo it was copied from, so you can re-fetch or diff against
upstream at any time (`https://github.com/odoo/odoo/blob/19.0/<path>`).

## Version notes

- **17.0+**: `<list>` replaces `<tree>` for list views; `attrs=`/`states=`
  removed in favor of direct `invisible=`/`readonly=`/`required=` Python
  expressions on any element.
- **19.0**: `res.groups.privilege` groups related `res.groups` into a single
  dropdown in Settings; `models.Constraint(...)` field-style declaration is
  now preferred over the old `_sql_constraints = [...]` list (both still
  work).
- If unsure which syntax applies, check `references/*.md` first — they're
  dated to the 19.0 branch but each snippet's shape is noted where it
  differs from older versions.
