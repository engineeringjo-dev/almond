# Form Views: Header, Buttons, Statusbar, Chatter

Source: `addons/utm/views/utm_campaign_views.xml`.

```xml
<record model="ir.ui.view" id="utm_campaign_view_form">
    <field name="name">utm.campaign.view.form</field>
    <field name="model">utm.campaign</field>
    <field name="arch" type="xml">
        <form string="UTM Campaign">
            <header>
                <field name="stage_id" widget="statusbar" options="{'clickable': '1'}"/>
            </header>
            <sheet>
                <div class="oe_button_box d-flex justify-content-end" name="button_box">
                </div>
                <widget name="web_ribbon" title="Archived" bg_color="text-bg-danger" invisible="active"/>
                <group id="top-group">
                    <field name="active" invisible="1"/>
                    <field class="text-break" name="title" string="Campaign Name" placeholder="e.g. Black Friday"/>
                    <field name="user_id" widget="many2one_avatar_user" domain="[('share', '=', False)]"/>
                    <field name="tag_ids" widget="many2many_tags" options="{'color_field': 'color', 'no_create_edit': True}"/>
                </group>
                <notebook>
                </notebook>
            </sheet>
        </form>
    </field>
</record>
```

## Workflow buttons in the header (`type="object"` vs `type="action"`)

Source: `addons/crm/views/crm_lead_views.xml`.

```xml
<header>
    <button name="action_set_won_rainbowman" string="Won"
        type="object" class="oe_highlight" data-hotkey="w" title="Mark as won"
        invisible="won_status == 'won' or type == 'lead' or not active"/>
    <button name="%(crm.action_crm_lead2opportunity_partner)d" string="Convert to Opportunity"
        type="action" class="oe_highlight" invisible="type == 'opportunity' or not active"/>
    <button name="action_restore" string="Restore" type="object"
        invisible="won_status != 'lost'"/>
</header>
```

- `type="object"` calls a Python method **by name** on the current record —
  no XML id needed. This is the standard shape for workflow buttons
  (`action_confirm`, `action_done`, `action_cancel`, ...).
- `type="action"` calls an **existing** `ir.actions.*` record via external id
  using the `%(module.xml_id)d` placeholder syntax.
- `invisible="<python expr>"` is the 17.0+ direct-expression syntax. **Do
  not** use the old `attrs="{'invisible': [...]}"` dict syntax — it was
  removed.

## Stat-button pattern (button in the `button_box`)

Source: `addons/crm/views/crm_lead_views.xml`.

```xml
<div class="oe_button_box" name="button_box">
    <button name="action_schedule_meeting" type="object"
        class="oe_stat_button" icon="fa-calendar">
        <div class="o_stat_info">
            <span class="o_stat_text">Meeting</span>
        </div>
    </button>
</div>
```

## Full form skeleton for a draft→done workflow model

```xml
<record id="my_model_view_form" model="ir.ui.view">
    <field name="name">my_module.my_model.form</field>
    <field name="model">my_module.my_model</field>
    <field name="arch" type="xml">
        <form string="My Model">
            <header>
                <button name="action_confirm" string="Confirm" type="object"
                        class="btn-primary" invisible="state != 'draft'"/>
                <button name="action_done" string="Done" type="object"
                        invisible="state != 'confirmed'"/>
                <button name="action_cancel" string="Cancel" type="object"
                        invisible="state in ('done', 'cancelled')"/>
                <field name="state" widget="statusbar" statusbar_visible="draft,confirmed,done"/>
            </header>
            <sheet>
                <div class="oe_button_box" name="button_box"/>
                <widget name="web_ribbon" title="Archived" bg_color="bg-danger" invisible="active"/>
                <div class="oe_title">
                    <h1><field name="name" placeholder="Name..."/></h1>
                </div>
                <group>
                    <group>
                        <field name="partner_id"/>
                    </group>
                    <group>
                        <field name="company_id" groups="base.group_multi_company"/>
                        <field name="total_amount"/>
                    </group>
                </group>
                <notebook>
                    <page string="Lines" name="lines">
                        <field name="line_ids">
                            <list editable="bottom">
                                <field name="sequence" widget="handle"/>
                                <field name="name"/>
                                <field name="amount"/>
                            </list>
                        </field>
                    </page>
                </notebook>
            </sheet>
            <div class="oe_chatter">
                <field name="message_follower_ids"/>
                <field name="activity_ids"/>
                <field name="message_ids"/>
            </div>
        </form>
    </field>
</record>
```

Note the nested one2many editor here also uses `<list>`, matching the
top-level rule — `<tree>` is not the modern shape even nested.
