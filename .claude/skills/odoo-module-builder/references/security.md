# Security: Groups, ACL, Record Rules

## Access control list — `security/ir.model.access.csv`

Source: `addons/utm/security/ir.model.access.csv`.

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_utm_campaign_user,access_utm_campaign_user,model_utm_campaign,base.group_user,1,1,1,0
access_utm_campaign_system,utm.campaign.system,model_utm_campaign,base.group_system,1,1,1,1
access_utm_tag_user,utm.tag,model_utm_tag,base.group_user,1,0,0,0
access_utm_tag_system,utm.tag,model_utm_tag,base.group_system,1,1,1,1
```

**Every model needs at least one row here, or all access is silently
denied** (Odoo's default is zero access, not full access) — this is one of
the most common "why doesn't my button/menu show up" bugs.

- `model_id:id` = `model_<model_name_with_underscores>` (no module prefix
  needed if the model is defined in the same module).
- `group_id:id` = empty means "all authenticated users"; usually you still
  want at least `base.group_user`.
- Give broader (`base.group_system` / a custom manager group) rows full
  `1,1,1,1` and narrower (`base.group_user`) rows restricted perms
  (e.g. no `perm_unlink`) as shown above.

## Custom groups — `security/<module>_security.xml`

Source: `addons/project/security/project_security.xml`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>

    <record model="res.groups.privilege" id="res_groups_privilege_project">
        <field name="name">Project</field>
        <field name="sequence">3</field>
        <field name="category_id" ref="base.module_category_services"/>
    </record>

    <record id="group_project_user" model="res.groups">
        <field name="name">User</field>
        <field name="comment">User: Can manage tasks in projects shared with them.</field>
        <field name="sequence">10</field>
        <field name="implied_ids" eval="[(4, ref('base.group_user'))]"/>
        <field name="privilege_id" ref="res_groups_privilege_project"/>
    </record>

    <record id="group_project_manager" model="res.groups">
        <field name="name">Administrator</field>
        <field name="comment">Administrator: Can manage projects and stages, with access to reporting and configuration.</field>
        <field name="sequence">20</field>
        <field name="privilege_id" ref="res_groups_privilege_project"/>
        <field name="implied_ids" eval="[(4, ref('project.group_project_user')), (4, ref('mail.group_mail_canned_response_admin'))]"/>
        <field name="user_ids" eval="[(4, ref('base.user_root')), (4, ref('base.user_admin'))]"/>
    </record>

</odoo>
```

- `res.groups.privilege` groups related `res.groups` records into one
  exclusive "privilege ladder" shown as a single dropdown in
  Settings > Users & Companies > Users (17.0+ pattern; replaces flat
  category display). Only needed if you're introducing a multi-level
  permission ladder (User/Manager/...) for a new app — a single flat group
  doesn't need a `privilege_id`.
- `implied_ids` auto-grants the listed groups whenever this group is
  granted — use it to build the ladder (`Manager` implies `User`).

## Record rule (row-level security) example

Common multi-company pattern:

```xml
<record id="rule_my_model_company" model="ir.rule">
    <field name="name">My Model: Multi-Company</field>
    <field name="model_id" ref="model_my_module_my_model"/>
    <field name="global" eval="True"/>
    <field name="domain_force">[
        '|',
        ('company_id', '=', False),
        ('company_id', 'in', company_ids)
    ]</field>
</record>
```

`global="True"` record rules are combined with AND across all applicable
rules; non-global rules for the same model are combined with OR within their
group. Know which one you want before adding a rule — mixing them up is a
common source of "users can see more/less than intended" bugs.
