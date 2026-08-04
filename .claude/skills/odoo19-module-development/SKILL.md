---
name: odoo19-module-development
description: >-
  Odoo 19 authoring REFERENCE, invoked on request by the Abu Laith router (or when
  the user explicitly asks for Odoo 19 syntax). Produces correct Odoo 19 code:
  models, fields, views (<list>, invisible=), security (res.groups.privilege),
  data files, wizards, OWL 2.0 components, reports, migration notes. Load the
  matching references/ file for deep detail. Does NOT auto-connect to any server
  and does NOT auto-fire on file edits; Abu Laith decides when to consult it.
---

# Odoo 19 Module Development

## Overview

Complete guide for building Odoo 19 custom modules. Covers every layer from models to views to security, with Odoo 19-specific syntax changes and real-world patterns from production HR/ERP modules.

For deep-dive API reference on any specific topic, read the corresponding guide from `references/`.

## Quick Reference — Topic Index

| Topic          | Reference File                        | When to Use                                          |
| -------------- | ------------------------------------- | ---------------------------------------------------- |
| Actions        | `references/odoo-19-actions.md`       | Window actions, server actions, cron jobs, menus      |
| API Decorators | `references/odoo-19-decorator.md`     | @api.depends, @api.constrains, @api.ondelete         |
| Controllers    | `references/odoo-19-controller.md`    | HTTP endpoints, routes, web controllers              |
| Data Files     | `references/odoo-19-data.md`          | XML/CSV data, sequences, cron, noupdate              |
| Fields         | `references/odoo-19-field.md`         | Field types, attributes, relational fields           |
| Manifest       | `references/odoo-19-manifest.md`      | __manifest__.py configuration                        |
| Migration      | `references/odoo-19-migration.md`     | Pre/post migration scripts, version upgrades         |
| Mixins         | `references/odoo-19-mixins.md`        | mail.thread, mail.activity.mixin, tracking           |
| Models & ORM   | `references/odoo-19-model.md`         | CRUD, search, domains, recordsets, _read_group       |
| OWL Components | `references/odoo-19-owl.md`           | Frontend OWL components, hooks, services             |
| Performance    | `references/odoo-19-performance.md`   | N+1 prevention, batch ops, optimization              |
| Reports        | `references/odoo-19-reports.md`       | QWeb PDF/HTML reports, paper formats                 |
| Security       | `references/odoo-19-security.md`      | Groups, ACL, record rules, privilege system          |
| Testing        | `references/odoo-19-testing.md`       | TransactionCase, HttpCase, mocking                   |
| Transactions   | `references/odoo-19-transaction.md`   | Savepoints, UniqueViolation, serialization           |
| Translation    | `references/odoo-19-translation.md`   | i18n, PO files, translatable fields                  |
| Views & XML    | `references/odoo-19-view.md`          | List/form/search/kanban views, xpath inheritance     |

## Odoo 19 Breaking Changes (MUST KNOW)

These changes will cause errors if you use old syntax:

| Change                | Old (Odoo 17-)                       | New (Odoo 19)                                       |
| --------------------- | ------------------------------------ | --------------------------------------------------- |
| List view tag         | `<tree>`                             | `<list>`                                            |
| Dynamic attributes    | `attrs="{'invisible': [...]}"` | `invisible="..."` (direct expression)               |
| Delete validation     | Override `unlink()`                  | `@api.ondelete(at_uninstall=False)`                 |
| Field aggregation     | `group_operator=`                    | `aggregator=`                                       |
| SQL constraints       | `_sql_constraints = [...]`           | `models.Constraint(...)`                            |
| DB indexes            | `index=True` only                    | `models.Index(...)` declarative                     |
| Security groups       | `category_id` on `res.groups`        | `privilege_id` + `res.groups.privilege`             |
| Kanban template       | `t-name="kanban-box"`                | `t-name="card"`                                     |
| QWeb output           | `t-esc`                              | `t-out`                                             |
| Private methods       | `_` prefix convention                | `@api.private` decorator (enforced)                 |
| read_group            | `read_group()`                       | `_read_group()` / `formatted_read_group()`          |
| Batch create          | Single dict                          | List of dicts: `create([{...}, {...}])`             |
| Search view grouping  | `<group expand='0'>` wrapper         | Place `<filter>` elements directly in `<search>`   |

## Module Structure

```
my_module/
├── __init__.py              # from . import models[, controllers, wizard]
├── __manifest__.py          # Module metadata
├── models/
│   ├── __init__.py          # from . import model_file
│   └── my_model.py
├── views/
│   ├── my_model_views.xml   # List, form, search, kanban views
│   └── menu.xml             # Menus (or inline in views file)
├── security/
│   ├── ir.model.access.csv  # Model-level ACL
│   └── my_module_security.xml  # Groups, privileges, record rules
├── data/
│   ├── ir_sequence_data.xml # Sequences
│   └── ir_cron_data.xml     # Scheduled actions
├── wizard/
│   ├── __init__.py
│   └── my_wizard.py
├── controllers/
│   ├── __init__.py
│   └── my_controller.py
├── static/
│   ├── description/
│   │   └── icon.png         # Module icon (128x128)
│   └── src/
│       ├── js/
│       ├── xml/
│       └── scss/
├── report/
│   └── my_report.xml
└── tests/
    ├── __init__.py
    └── test_my_model.py
```

## __manifest__.py

```python
{
    'name': 'My Module',
    'version': '19.0.1.0.0',
    'category': 'Human Resources',
    'author': 'Your Name',
    'website': 'https://example.com',
    'summary': 'One-line summary',
    'description': """
        Detailed description.
    """,
    'depends': ['base', 'hr', 'mail'],
    'data': [
        # Load order matters: security → data → views → menus
        'security/my_module_security.xml',
        'security/ir.model.access.csv',
        'data/ir_sequence_data.xml',
        'data/ir_cron_data.xml',
        'views/my_model_views.xml',
        'views/menu.xml',
        'wizard/my_wizard_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'my_module/static/src/js/my_component.js',
            'my_module/static/src/xml/my_component.xml',
            'my_module/static/src/scss/my_style.scss',
        ],
    },
    'external_dependencies': {'python': ['requests']},
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
```

## Model Definition

```python
from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError

class MyModel(models.Model):
    _name = 'my.model'
    _description = 'My Model'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'date_start desc, id desc'
    _rec_name = 'display_name'

    # === Basic Fields ===
    name = fields.Char(string='Name', required=True, copy=False,
                       default=lambda self: _('New'), tracking=True)
    description = fields.Text(string='Description')
    active = fields.Boolean(default=True)

    # === Relational Fields ===
    employee_id = fields.Many2one('hr.employee', string='Employee',
                                   required=True, tracking=True, index=True,
                                   domain="[('company_id', 'in', [company_id, False])]")
    department_id = fields.Many2one('hr.department',
                                     related='employee_id.department_id', store=True)
    line_ids = fields.One2many('my.model.line', 'parent_id', string='Lines')
    tag_ids = fields.Many2many('my.model.tag', string='Tags')

    # === Selection / State ===
    state = fields.Selection([
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('done', 'Done'),
    ], string='State', default='draft', tracking=True)

    # === Date Fields ===
    date_start = fields.Date(string='Start Date', required=True)
    date_end = fields.Date(string='End Date')

    # === Computed Fields ===
    days_remaining = fields.Integer(compute='_compute_days_remaining', store=False)
    total_amount = fields.Float(compute='_compute_total', store=True, digits=(10, 2))

    # === SQL Constraint (Odoo 19 syntax) ===
    _check_dates = models.Constraint(
        'CHECK(date_end IS NULL OR date_end >= date_start)',
        'End date must be after start date!',
    )

    # === Compute Methods ===
    @api.depends('date_end')
    def _compute_days_remaining(self):
        today = fields.Date.today()
        for rec in self:
            if rec.date_end:
                rec.days_remaining = (rec.date_end - today).days
            else:
                rec.days_remaining = 0

    @api.depends('line_ids.amount')
    def _compute_total(self):
        for rec in self:
            rec.total_amount = sum(rec.line_ids.mapped('amount'))

    # === Onchange ===
    @api.onchange('employee_id')
    def _onchange_employee_id(self):
        if self.employee_id:
            self.department_id = self.employee_id.department_id

    # === Constraints ===
    @api.constrains('date_start', 'date_end')
    def _check_date_range(self):
        for rec in self:
            if rec.date_end and rec.date_end < rec.date_start:
                raise ValidationError(_('End date must be after start date.'))

    # === Delete Validation (Odoo 19) ===
    @api.ondelete(at_uninstall=False)
    def _unlink_if_draft(self):
        if any(rec.state != 'draft' for rec in self):
            raise UserError(_('Cannot delete non-draft records.'))

    # === CRUD Overrides ===
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('name') or vals['name'] == _('New'):
                vals['name'] = self.env['ir.sequence'].next_by_code('my.model')
        return super().create(vals_list)

    # === Action Methods (called from buttons) ===
    def action_confirm(self):
        for rec in self:
            rec.state = 'confirmed'

    def action_done(self):
        for rec in self:
            rec.state = 'done'
```

## Views XML

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- List View (NOT <tree>) -->
    <record id="view_my_model_list" model="ir.ui.view">
        <field name="name">my.model.list</field>
        <field name="model">my.model</field>
        <field name="arch" type="xml">
            <list string="My Models"
                  decoration-info="state == 'draft'"
                  decoration-success="state == 'done'"
                  multi_edit="1" sample="1">
                <field name="name"/>
                <field name="employee_id" widget="many2one_avatar_employee"/>
                <field name="date_start"/>
                <field name="total_amount" optional="show"/>
                <field name="state" widget="badge"
                       decoration-info="state == 'draft'"
                       decoration-success="state == 'done'"/>
            </list>
        </field>
    </record>

    <!-- Form View -->
    <record id="view_my_model_form" model="ir.ui.view">
        <field name="name">my.model.form</field>
        <field name="model">my.model</field>
        <field name="arch" type="xml">
            <form string="My Model">
                <header>
                    <button name="action_confirm" type="object"
                            string="Confirm" class="btn-primary"
                            invisible="state != 'draft'"/>
                    <button name="action_done" type="object"
                            string="Done"
                            invisible="state != 'confirmed'"/>
                    <field name="state" widget="statusbar"
                           statusbar_visible="draft,confirmed,done"/>
                </header>
                <sheet>
                    <div class="oe_button_box" name="button_box">
                        <button name="action_view_lines" type="object"
                                class="oe_stat_button" icon="fa-list">
                            <field name="line_count" widget="statinfo"
                                   string="Lines"/>
                        </button>
                    </div>
                    <widget name="web_ribbon" title="Done"
                            bg_color="text-bg-success"
                            invisible="state != 'done'"/>
                    <div class="oe_title">
                        <label for="name"/>
                        <h1><field name="name" readonly="id"/></h1>
                    </div>
                    <group>
                        <group string="Employee Info">
                            <field name="employee_id"/>
                            <field name="department_id"/>
                        </group>
                        <group string="Dates">
                            <field name="date_start"/>
                            <field name="date_end"/>
                            <field name="days_remaining"/>
                        </group>
                    </group>
                    <notebook>
                        <page string="Lines">
                            <field name="line_ids">
                                <list editable="bottom">
                                    <field name="description"/>
                                    <field name="amount"/>
                                </list>
                            </field>
                            <group class="oe_subtotal_footer">
                                <field name="total_amount"/>
                            </group>
                        </page>
                        <page string="Notes">
                            <field name="description" placeholder="Notes..."/>
                        </page>
                    </notebook>
                </sheet>
                <chatter/>
            </form>
        </field>
    </record>

    <!-- Search View (NO <group expand='0'> in Odoo 19) -->
    <record id="view_my_model_search" model="ir.ui.view">
        <field name="name">my.model.search</field>
        <field name="model">my.model</field>
        <field name="arch" type="xml">
            <search string="Search">
                <field name="name"/>
                <field name="employee_id"/>
                <filter string="Draft" name="draft"
                        domain="[('state', '=', 'draft')]"/>
                <filter string="Done" name="done"
                        domain="[('state', '=', 'done')]"/>
                <separator/>
                <filter string="Employee" name="group_employee"
                        context="{'group_by': 'employee_id'}"/>
                <filter string="State" name="group_state"
                        context="{'group_by': 'state'}"/>
            </search>
        </field>
    </record>

    <!-- Window Action -->
    <record id="action_my_model" model="ir.actions.act_window">
        <field name="name">My Models</field>
        <field name="res_model">my.model</field>
        <field name="view_mode">list,form,kanban</field>
        <field name="context">{'search_default_group_employee': 1}</field>
        <field name="help" type="html">
            <p class="o_view_nocontent_smiling_face">
                Create your first record!
            </p>
        </field>
    </record>

    <!-- Menu -->
    <menuitem id="menu_root" name="My Module"
              web_icon="my_module,static/description/icon.png"
              groups="group_my_user" sequence="90"/>
    <menuitem id="menu_list" name="Records"
              parent="menu_root" action="action_my_model" sequence="10"/>
</odoo>
```

## Security (Odoo 19 Privilege System)

### security/my_module_security.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Step 1: Create privilege (replaces category_id) -->
    <record id="res_groups_privilege_my_module" model="res.groups.privilege">
        <field name="name">My Module</field>
        <field name="sequence">90</field>
        <field name="category_id" ref="base.module_category_human_resources"/>
    </record>

    <!-- Step 2: Define groups with privilege_id -->
    <record id="group_my_user" model="res.groups">
        <field name="name">User</field>
        <field name="sequence">5</field>
        <field name="privilege_id" ref="res_groups_privilege_my_module"/>
        <field name="implied_ids" eval="[(4, ref('base.group_user'))]"/>
    </record>

    <record id="group_my_manager" model="res.groups">
        <field name="name">Manager</field>
        <field name="sequence">10</field>
        <field name="privilege_id" ref="res_groups_privilege_my_module"/>
        <field name="implied_ids" eval="[(4, ref('group_my_user'))]"/>
    </record>

    <!-- Step 3: Record rules -->
    <data noupdate="1">
        <!-- User sees own records -->
        <record id="rule_my_model_user" model="ir.rule">
            <field name="name">My Model: user own records</field>
            <field name="model_id" ref="model_my_model"/>
            <field name="domain_force">[('create_uid', '=', user.id)]</field>
            <field name="groups" eval="[(4, ref('group_my_user'))]"/>
        </record>

        <!-- Manager sees all -->
        <record id="rule_my_model_manager" model="ir.rule">
            <field name="name">My Model: manager all</field>
            <field name="model_id" ref="model_my_model"/>
            <field name="domain_force">[(1, '=', 1)]</field>
            <field name="groups" eval="[(4, ref('group_my_manager'))]"/>
        </record>

        <!-- Multi-company (global rule) -->
        <record id="rule_my_model_multi_company" model="ir.rule">
            <field name="name">My Model: multi-company</field>
            <field name="model_id" ref="model_my_model"/>
            <field name="global" eval="True"/>
            <field name="domain_force">
                ['|', ('company_id', '=', False), ('company_id', 'in', company_ids)]
            </field>
        </record>
    </data>
</odoo>
```

### security/ir.model.access.csv

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_my_model_user,my.model.user,model_my_model,group_my_user,1,0,0,0
access_my_model_manager,my.model.manager,model_my_model,group_my_manager,1,1,1,1
```

**Critical:** For models defined in OTHER modules, prefix with module name:
```csv
access_hr_employee_user,hr.employee.user,hr.model_hr_employee,group_my_user,1,0,0,0
```

## Common Odoo 19 Pitfalls

### 1. Search View — No `<group expand='0'>`
```xml
<!-- WRONG: causes RELAXNG validation error -->
<search>
  <group expand="0" string="Group By">
    <filter name="group_emp" context="{'group_by': 'employee_id'}"/>
  </group>
</search>

<!-- CORRECT: filters directly in search -->
<search>
  <filter name="group_emp" string="Employee"
          context="{'group_by': 'employee_id'}"/>
</search>
```

### 2. Model Already Exists
```python
# WRONG: creates duplicate model
class ContractType(models.Model):
    _name = 'hr.contract.type'

# CORRECT: extend existing model
class ContractType(models.Model):
    _inherit = 'hr.contract.type'
```

### 3. External ID Prefix
```csv
# WRONG: model defined in 'hr' module
model_id:id
model_hr_employee

# CORRECT: prefix with source module
model_id:id
hr.model_hr_employee
```

### 4. Field Editable on Create, Readonly After Save
```xml
<!-- Use readonly="id" — False when creating (id=0), True after save -->
<field name="employee_id" readonly="id"/>
```

### 5. Multi-Company Consistency
When working with employees, ensure `user.company_id`, `employee.company_id`, and `resource_resource.company_id` all match.

### 6. Computed Field Not Searchable
```python
# Non-stored computed fields need explicit search method
is_expiring = fields.Boolean(
    compute='_compute_is_expiring',
    store=False,
    search='_search_is_expiring'
)

def _search_is_expiring(self, operator, value):
    today = fields.Date.today()
    return [('date_end', '<=', today + timedelta(days=30))]
```

## Naming Conventions

| Entity        | Convention                       | Example                           |
| ------------- | -------------------------------- | --------------------------------- |
| Model name    | Dotted lowercase                 | `my.module.model`                 |
| Python class  | CamelCase                        | `MyModuleModel`                   |
| Field         | snake_case + suffix              | `employee_id`, `line_ids`         |
| Compute       | `_compute_<field>`               | `_compute_total_amount`           |
| Onchange      | `_onchange_<field>`              | `_onchange_employee_id`           |
| Action method | `action_<verb>`                  | `action_confirm`                  |
| Private method| `_<name>` + `@api.private`       | `_set_state`                      |
| View ID       | `view_<model>_<type>`            | `view_my_model_form`              |
| Action ID     | `action_<model>`                 | `action_my_model`                 |
| Menu ID       | `menu_<path>`                    | `menu_my_module_root`             |
| Rule ID       | `rule_<model>_<purpose>`         | `rule_my_model_user`              |
| Group ID      | `group_<module>_<role>`          | `group_my_module_manager`         |

## Data Files

### Sequence
```xml
<data noupdate="1">
    <record id="seq_my_model" model="ir.sequence">
        <field name="name">My Model Sequence</field>
        <field name="code">my.model</field>
        <field name="prefix">MM/</field>
        <field name="padding">4</field>
    </record>
</data>
```

### Cron Job
```xml
<data noupdate="1">
    <record id="cron_check_expiry" model="ir.cron">
        <field name="name">My Model: Check Expiry</field>
        <field name="model_id" ref="model_my_model"/>
        <field name="state">code</field>
        <field name="code">model._cron_check_expiry()</field>
        <field name="interval_number">1</field>
        <field name="interval_type">days</field>
        <field name="active">True</field>
    </record>
</data>
```

## Wizard Pattern

```python
class MyWizard(models.TransientModel):
    _name = 'my.model.wizard'
    _description = 'My Wizard'

    date = fields.Date(required=True, default=fields.Date.context_today)
    note = fields.Text()

    def action_confirm(self):
        active_ids = self.env.context.get('active_ids', [])
        records = self.env['my.model'].browse(active_ids)
        # Process records...
        return {'type': 'ir.actions.act_window_close'}
```

## View Inheritance (xpath)

```xml
<record id="view_partner_form_inherit" model="ir.ui.view">
    <field name="name">res.partner.form.inherit.my_module</field>
    <field name="model">res.partner</field>
    <field name="inherit_id" ref="base.view_partner_form"/>
    <field name="arch" type="xml">
        <xpath expr="//field[@name='phone']" position="after">
            <field name="my_custom_field"/>
        </xpath>
    </field>
</record>
```

## Anti-Patterns to Avoid

| Anti-Pattern                       | Correct Approach                              |
| ---------------------------------- | --------------------------------------------- |
| `<tree>` tag                       | `<list>` tag                                  |
| `attrs="{'invisible': [...]}"` | `invisible="expression"`                      |
| `_sql_constraints = [...]`         | `models.Constraint(...)`                      |
| `category_id` on `res.groups`      | `privilege_id` + `res.groups.privilege`       |
| `t-esc` in templates               | `t-out`                                       |
| `search()` in loop                 | Single `search()` with `IN` domain            |
| `create()` in loop                 | Batch `create([{...}, {...}])`                |
| Override `unlink()` for validation | `@api.ondelete(at_uninstall=False)`           |
| `eval()` for parsing               | `ast.literal_eval()`                          |
| `t-raw` for content                | `t-out` (XSS safe)                            |
| `read_group()`                     | `_read_group()` / `formatted_read_group()`    |
| `getattr(record, field)`           | `record[field]` (__getitem__)                 |

---

## Custom UI with HTML/JS/CSS (Instead of Odoo XML Views)

When building custom dashboards, landing pages, or rich interactive UIs inside Odoo 19 modules, **use HTML + JS + CSS via OWL components and QWeb templates** instead of standard Odoo form/list views.

**REQUIRED:** Use the `ui-ux-pro-max` skill for design system generation before building any custom UI. Run:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system -p "Project Name"
```

### When to Use Custom UI vs Odoo Views

| Use Case                          | Approach                    |
| --------------------------------- | --------------------------- |
| CRUD data management              | Standard Odoo XML views     |
| Dashboard with charts/KPIs        | **Custom HTML/JS/CSS**      |
| Landing page / portal page        | **Custom HTML/JS/CSS**      |
| Complex interactive forms         | **Custom HTML/JS/CSS**      |
| Kanban with rich card layout      | **Custom HTML/JS/CSS**      |
| Simple list/form with filters     | Standard Odoo XML views     |
| Report / PDF generation           | QWeb report templates       |
| Admin settings page               | Standard Odoo XML views     |

### Architecture: Custom UI in Odoo 19

```
my_module/
├── controllers/
│   └── main.py                    # HTTP endpoints serving JSON data
├── static/
│   └── src/
│       ├── js/
│       │   ├── dashboard.js       # OWL component (main UI)
│       │   └── services/          # RPC services for backend calls
│       ├── xml/
│       │   └── dashboard.xml      # QWeb template for OWL component
│       ├── scss/
│       │   └── dashboard.scss     # Custom styles
│       └── css/
│           └── dashboard.css      # Plain CSS (if not using SCSS)
├── views/
│   └── dashboard_views.xml        # ir.actions.client action
└── __manifest__.py                # Register assets in web.assets_backend
```

### Step 1: Design System (REQUIRED before coding)

Use `ui-ux-pro-max` to generate your design system:

```bash
# For a HR dashboard
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "HR dashboard enterprise professional" --design-system -p "HR Dashboard"

# Get stack-specific guidelines
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "dashboard cards charts" --stack html-tailwind

# Get UX best practices
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "animation accessibility loading" --domain ux
```

### Step 2: OWL Component (JS)

```javascript
/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

class MyDashboard extends Component {
    static template = "my_module.Dashboard";
    static props = { ...MyDashboard.props, action: { type: Object, optional: true } };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.state = useState({
            data: [],
            loading: true,
            stats: { total: 0, pending: 0, done: 0 },
        });
        onWillStart(async () => {
            await this.loadData();
        });
    }

    async loadData() {
        this.state.loading = true;
        try {
            // Use ORM service for RPC calls
            const records = await this.orm.searchRead(
                "my.model",
                [["state", "!=", "cancelled"]],
                ["name", "state", "total_amount", "employee_id"],
                { limit: 100, order: "date_start desc" }
            );
            this.state.data = records;
            this.state.stats = {
                total: records.length,
                pending: records.filter(r => r.state === "draft").length,
                done: records.filter(r => r.state === "done").length,
            };
        } finally {
            this.state.loading = false;
        }
    }

    onCardClick(recordId) {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "my.model",
            res_id: recordId,
            views: [[false, "form"]],
            target: "current",
        });
    }
}

// Register as a client action
registry.category("actions").add("my_module.dashboard", MyDashboard);
```

### Step 3: QWeb Template (XML)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="my_module.Dashboard">
        <div class="my_dashboard o_action">
            <!-- Loading State -->
            <div t-if="state.loading" class="d-flex justify-content-center align-items-center"
                 style="min-height: 400px;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>

            <div t-else="" class="container-fluid p-4">
                <!-- KPI Cards Row -->
                <div class="row g-3 mb-4">
                    <div class="col-md-4">
                        <div class="card shadow-sm border-0 h-100 cursor-pointer"
                             style="border-radius: 12px;">
                            <div class="card-body">
                                <div class="text-muted small fw-semibold text-uppercase">Total</div>
                                <div class="fs-2 fw-bold text-primary mt-1">
                                    <t t-out="state.stats.total"/>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card shadow-sm border-0 h-100"
                             style="border-radius: 12px;">
                            <div class="card-body">
                                <div class="text-muted small fw-semibold text-uppercase">Pending</div>
                                <div class="fs-2 fw-bold text-warning mt-1">
                                    <t t-out="state.stats.pending"/>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card shadow-sm border-0 h-100"
                             style="border-radius: 12px;">
                            <div class="card-body">
                                <div class="text-muted small fw-semibold text-uppercase">Done</div>
                                <div class="fs-2 fw-bold text-success mt-1">
                                    <t t-out="state.stats.done"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Data Grid -->
                <div class="row g-3">
                    <t t-foreach="state.data" t-as="record" t-key="record.id">
                        <div class="col-md-6 col-lg-4">
                            <div class="card shadow-sm border-0 h-100 cursor-pointer"
                                 style="border-radius: 12px; transition: transform 0.2s, box-shadow 0.2s;"
                                 t-on-click="() => this.onCardClick(record.id)">
                                <div class="card-body">
                                    <h6 class="card-title fw-bold mb-2">
                                        <t t-out="record.name"/>
                                    </h6>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="badge"
                                              t-attf-class="badge {{ record.state === 'done' ? 'bg-success' : record.state === 'draft' ? 'bg-info' : 'bg-warning' }}">
                                            <t t-out="record.state"/>
                                        </span>
                                        <span class="text-muted">
                                            <t t-out="record.total_amount"/> VND
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </t>
                </div>
            </div>
        </div>
    </t>
</templates>
```

### Step 4: Custom Styles (SCSS)

```scss
// static/src/scss/dashboard.scss
.my_dashboard {
    background: #f8f9fc;
    min-height: 100vh;

    .card {
        transition: transform 0.2s ease, box-shadow 0.2s ease;

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1) !important;
        }
    }

    // KPI cards gradient accent
    .card-body {
        position: relative;

        &::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            border-radius: 12px 12px 0 0;
        }
    }

    // Responsive adjustments
    @media (max-width: 768px) {
        .container-fluid {
            padding: 1rem !important;
        }
    }
}
```

### Step 5: Client Action (XML)

```xml
<!-- views/dashboard_views.xml -->
<odoo>
    <record id="action_my_dashboard" model="ir.actions.client">
        <field name="name">My Dashboard</field>
        <field name="tag">my_module.dashboard</field>
    </record>

    <menuitem id="menu_dashboard" name="Dashboard"
              parent="menu_root" action="action_my_dashboard"
              sequence="1"/>
</odoo>
```

### Step 6: Register Assets in Manifest

```python
'assets': {
    'web.assets_backend': [
        'my_module/static/src/scss/dashboard.scss',
        'my_module/static/src/js/dashboard.js',
        'my_module/static/src/xml/dashboard.xml',
    ],
},
```

### Custom UI Controller Pattern (for REST-like API)

When your custom UI needs data beyond simple ORM calls:

```python
# controllers/main.py
from odoo import http
from odoo.http import request

class MyDashboardController(http.Controller):

    @http.route('/my_module/dashboard/stats', type='json', auth='user')
    def get_dashboard_stats(self):
        """Return aggregated stats for the dashboard."""
        Model = request.env['my.model']
        results = Model._read_group(
            domain=[('state', '!=', 'cancelled')],
            groupby=['state'],
            aggregates=['total_amount:sum', '__count'],
        )
        return {
            'stats': [{
                'state': state,
                'total_amount': total,
                'count': count,
            } for state, total, count in results],
        }
```

### UI Design Rules (from ui-ux-pro-max)

When building custom HTML/JS/CSS UI inside Odoo, follow these rules:

| Rule                      | Do                                                        | Don't                                            |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| Icons                     | Use Font Awesome (bundled in Odoo) or SVG                 | Use emojis as icons                              |
| Colors                    | Use Bootstrap 5 classes (`text-primary`, `bg-success`)    | Hardcode hex colors everywhere                   |
| Spacing                   | Use Bootstrap utilities (`p-4`, `mb-3`, `g-3`)            | Use arbitrary pixel values                       |
| Cards                     | `border-radius: 12px`, `shadow-sm`, hover lift effect     | Flat boxes with no visual hierarchy              |
| Typography                | Use Odoo's default font stack, `fw-bold`/`fw-semibold`    | Import external fonts that clash with Odoo       |
| Hover states              | `transition: transform 0.2s, box-shadow 0.2s`            | Scale transforms that shift layout               |
| Interactive elements      | Add `cursor-pointer` to all clickable cards/buttons       | Leave default cursor on interactive elements     |
| Loading states            | Show spinner or skeleton during async operations          | Show empty screen while loading                  |
| Responsive                | Use Bootstrap grid (`col-md-4`, `col-lg-3`)               | Fixed-width layouts                              |
| Accessibility             | `role`, `aria-label`, min 4.5:1 contrast ratio            | Color as the only indicator                      |
| Dark mode                 | Test with Odoo's dark mode (`o_dark` class on `<body>`)   | Ignore dark mode compatibility                   |
| Contrast (light mode)     | `text-dark` or `#0F172A` for body text                    | Light gray text (`text-muted` for body copy)     |

### Pre-Delivery Checklist for Custom Odoo UI

- [ ] Design system generated via `ui-ux-pro-max` before coding
- [ ] No emojis used as icons — Font Awesome or SVG only
- [ ] All clickable elements have `cursor-pointer`
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Loading spinner shown during async data fetch
- [ ] Works in Odoo dark mode (`o_dark`)
- [ ] Responsive at mobile (375px) and desktop (1440px)
- [ ] Accessible: `aria-label` on icon buttons, color contrast 4.5:1+
- [ ] Uses Bootstrap 5 utilities (not custom CSS for spacing/colors)
- [ ] Assets registered in `__manifest__.py` under `web.assets_backend`
- [ ] Client action registered with `ir.actions.client` and correct `tag`
- [ ] OWL component uses `useService("orm")` for RPC, not raw `fetch()`

---

## Server Access Policy (Almond — OVERRIDDEN, do not auto-SSH)

The original auto-SSH / auto-deploy behavior of this skill is intentionally DISABLED.

- NEVER SSH, scp, deploy, restart, install, or modify any server automatically.
  Being given a host or credentials is NOT authorization to connect.
- Connect ONLY when the Abu Laith router explicitly instructs it for a specific, named task.
- The only auto-permitted inspection target is the DEV branch `dev-almond` using a
  READ-ONLY database user (logs, config, status — no writes).
- Production DB `ag-almond-coffee-house-master1` is OFF-LIMITS. No read or write access
  without an explicit typed token `APPROVE PROD` from Hamza in the same session.
- Deploy (scp module, `-u`/`-i` update, restart) is a separate human-approved step.
  Never infer deploy from context. Require the literal instruction "deploy to <env>",
  and for production also `APPROVE PROD`.
- Before running anything that touches a server, echo the exact command + target host/DB
  and wait for confirmation.

### Troubleshooting Patterns

| Symptom                           | Check                                                    |
| --------------------------------- | -------------------------------------------------------- |
| 502 Bad Gateway                   | `systemctl status odoo` + `tail /var/log/nginx/error.log`|
| Module not found                  | Verify `addons_path` in `odoo.conf` includes custom dir  |
| Access denied / security error    | Check `ir.model.access.csv` loaded + user groups         |
| XML validation error              | `tail -50 /var/log/odoo/odoo-server.log \| grep -i error`|
| Module won't update               | Clear assets: `rm -rf /tmp/odoo-assets-*` + restart      |
| Database locked                   | `sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE state='active';"` |
