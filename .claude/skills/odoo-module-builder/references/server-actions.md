# Server Actions (`ir.actions.server`)

Source: `addons/crm/data/ir_action_data.xml`, `odoo/odoo` branch `19.0`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>

    <!--
        'Mark as Lost' in action dropdown
    -->
    <record id="action_your_pipeline" model="ir.actions.server">
        <field name="name">Crm: My Pipeline</field>
        <field name="path">crm</field>
        <field name="model_id" ref="crm.model_crm_team"/>
        <field name="state">code</field>
        <field name="group_ids"  eval="[(4, ref('base.group_user'))]"/>
        <field name="code">action = model.action_your_pipeline()</field>
    </record>

    <record id="action_opportunity_forecast" model="ir.actions.server">
        <field name="name">Crm: Forecast</field>
        <field name="model_id" ref="crm.model_crm_team"/>
        <field name="state">code</field>
        <field name="group_ids"  eval="[(4, ref('base.group_user'))]"/>
        <field name="code">action = model.action_opportunity_forecast()</field>
    </record>

</odoo>
```

## Key takeaways

- `state = 'code'` executes arbitrary Python with `model`/`env`/`record` in
  scope; assign the return value to the `action` variable to have it open a
  client action or window action for the user.
- `group_ids` (an `eval="[(4, ref('group_xml_id'))]"` one2many command)
  restricts who can trigger the action from the UI. Some older modules use a
  plain `groups_id` field name — check the model's field list for your
  target version if unsure.
- `path` sets the URL slug the resulting action opens under.
- `model_id` uses `ref="module.model_<technical_name>"` — same auto-generated
  `ir.model` external id convention as cron jobs.

## When to use `ir.actions.server` vs a `type="object"` form button

- **`ir.actions.server`** — for actions triggered from the Action menu
  (gear icon) on a list/kanban view, from automated rules
  (`base.automation`), or from a menu item directly. Good for bulk
  operations over a recordset (`model` is the full selected recordset).
- **`type="object"` button** (see `references/form-views.md`) — for actions
  triggered by a button on a single record's form view. Simpler and more
  common for workflow transitions (`action_confirm`, `action_done`, ...).

Don't wrap a simple single-record workflow method in an `ir.actions.server`
record just to expose it — put a `type="object"` button directly in the form
view instead; reserve `ir.actions.server` for menu/list-level or
automation-triggered actions.

## Template for a new server action wired to a menu

```xml
<record id="action_my_model_bulk_close" model="ir.actions.server">
    <field name="name">Close Selected</field>
    <field name="model_id" ref="model_my_module_my_model"/>
    <field name="binding_model_id" ref="model_my_module_my_model"/>
    <field name="binding_view_types">list</field>
    <field name="state">code</field>
    <field name="code">action = model.action_bulk_close()</field>
</record>
```

```python
def action_bulk_close(self):
    self.write({'state': 'done'})
```

`binding_model_id` + `binding_view_types` attaches the action to the
Action-menu dropdown on that model's list/form views without needing a
separate menu item.
