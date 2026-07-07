# List View & Search View (Filters, Group-by)

## List view + window action

Source: `addons/utm/views/utm_tag_views.xml`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="utm_tag_view_tree" model="ir.ui.view">
        <field name="name">utm.tag.view.list</field>
        <field name="model">utm.tag</field>
        <field name="arch" type="xml">
            <list string="Campaign Tags" editable="top">
                <field name="name"/>
            </list>
        </field>
    </record>

    <record id="action_view_utm_tag" model="ir.actions.act_window">
        <field name="name">Campaign Tags</field>
        <field name="res_model">utm.tag</field>
        <field name="help" type="html">
            <p class="o_view_nocontent_smiling_face">
                Create a Tag
            </p><p>
                Assign tags to your campaigns to organize, filter and track them.
            </p>
        </field>
    </record>
</odoo>
```

> **v17.0+:** list views use the `<list>` root tag, not `<tree>`. `<tree>` is
> legacy and still tolerated for some nested one2many editors, but new
> top-level list views in core are all `<list>`. Always prefer `<list>` for
> new code.

A richer list view with more columns, from `addons/project/views/project_tags_views.xml`:

```xml
<record model="ir.ui.view" id="project_tags_tree_view">
    <field name="name">Tags</field>
    <field name="model">project.tags</field>
    <field name="arch" type="xml">
        <list string="Tags" editable="top" sample="1" multi_edit="1" default_order="name">
            <field name="name"/>
            <field name="color" widget="color_picker" optional="show"/>
        </list>
    </field>
</record>
```

- `optional="show"`/`optional="hide"` lets users toggle a column via the
  column-config gear icon.
- `multi_edit="1"` allows editing the same field across multiple selected
  rows at once.
- `sample="1"` shows demo placeholder rows when the model has no data yet.

## Search view: fields, filters, separators, group-by

Source: `addons/utm/views/utm_campaign_views.xml`.

```xml
<record model="ir.ui.view" id="view_utm_campaign_view_search">
    <field name="name">utm.campaign.view.search</field>
    <field name="model">utm.campaign</field>
    <field name="arch" type="xml">
        <search string="UTM Campaigns">
            <field name="title" string="Campaigns"/>
            <field name="tag_ids"/>
            <field name="user_id"/>
            <field name="is_auto_campaign"/>
            <filter string="My Campaigns" name="filter_assigned_to_me" domain="[('user_id', '=', uid)]"
                help="Campaigns that are assigned to me"/>
            <separator/>
            <filter string="Archived" name="filter_inactive" domain="[('active', '=', False)]"/>
            <group>
                <filter string="Stage" name="group_stage_id"
                    context="{'group_by': 'stage_id'}"/>
                <filter string="Responsible" name="group_user_id"
                    context="{'group_by': 'user_id'}"/>
                <filter string="Tags" name="group_tags_id"
                    context="{'group_by': 'tag_ids'}"/>
            </group>
        </search>
    </field>
</record>
```

## Richer real example — `addons/project` task search

Source: `addons/project/views/project_task_views.xml`. Demonstrates date
range filters, `groups=`, `invisible=`, and nested dropdown filter options.

```xml
<record id="view_task_search_form_base" model="ir.ui.view">
    <field name="name">project.task.view.search.base</field>
    <field name="model">project.task</field>
    <field name="arch" type="xml">
        <search string="Tasks">
            <filter string="Unassigned" name="unassigned" domain="[('user_ids', '=', False)]"/>
            <filter string="Favorite Projects" name="favorite_projects"
                domain="[('project_id.is_favorite', '=', True)]"
                invisible="context.get('default_project_id')"/>
            <filter string="Blocking" name="blocking"
                domain="[('is_closed', '=', False), ('dependent_ids', '!=', False)]"
                groups="project.group_project_task_dependencies"
                invisible="not context.get('allow_task_dependencies', True)"/>
            <filter string="Creation Date" name="creation_date_filter" date="create_date"/>
            <filter string="Open" name="open_tasks" domain="[('is_closed', '=', False)]"/>
            <filter string="Closed" name="closed_tasks" domain="[('is_closed', '=', True)]"/>
            <filter string="Closed On" name="closed_on" domain="[('is_closed', '=', True)]"
                date="date_last_stage_update">
                <filter name="create_date_last_30_days" string="Last 30 Days"
                    domain="[('date_last_stage_update', '&gt;=', 'today -30d +1d')]"/>
                <filter name="create_date_last_365_days" string="Last 365 Days"
                    domain="[('date_last_stage_update', '&gt;=', 'today -365d +1d')]"/>
            </filter>
            <group>
                <filter string="Stage" name="stage" context="{'group_by': 'stage_id'}"/>
                <filter string="Priority" name="groupby_priority" context="{'group_by': 'priority'}"/>
                <filter string="Tags" name="tags" context="{'group_by': 'tag_ids'}"/>
                <filter string="Company" name="company_id" context="{'group_by': 'company_id'}"
                    groups="base.group_multi_company"/>
            </group>
        </search>
    </field>
</record>
```

Key takeaways:
- `date="field_name"` on a `<filter>` turns it into a date-range quick
  filter; nested `<filter>` children become its dropdown options (e.g. "Last
  30 Days").
- `groups="module.group_xml_id"` hides a filter unless the current user has
  that group.
- `invisible="<python expr>"` on filters works exactly like on form/list
  fields in 17.0+ — a direct Python expression, no `attrs=` dict.
- Group-by filters just set `context="{'group_by': 'field_name'}"` — no
  `domain` needed.
- Plain `<separator/>` visually splits filter groups in the dropdown.

## Window action wired to multiple view types

Source: `addons/project/views/project_task_views.xml` (trimmed).

```xml
<record id="act_project_project_2_project_task_all" model="ir.actions.act_window">
    <field name="name">Tasks</field>
    <field name="res_model">project.task</field>
    <field name="view_mode">kanban,list,form,calendar,pivot,graph,activity</field>
</record>
```

`view_mode` is a comma-separated list — the first entry is the default view
opened.
