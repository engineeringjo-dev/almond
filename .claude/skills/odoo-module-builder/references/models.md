# Model Definition

Source: `addons/utm/models/utm_tag.py` in `github.com/odoo/odoo`, branch `19.0`.

```python
# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from random import randint

from odoo import fields, models


class UtmTag(models.Model):
    """Model of categories of utm campaigns, i.e. marketing, newsletter, ..."""

    _name = 'utm.tag'
    _description = 'UTM Tag'
    _order = 'name'

    def _default_color(self):
        return randint(1, 11)

    name = fields.Char(required=True, translate=True)
    color = fields.Integer(
        string='Color Index', default=lambda self: self._default_color(),
        help='Tag color. No color means no display in kanban to distinguish internal tags from public categorization tags.')

    _name_uniq = models.Constraint(
        'unique (name)',
        'Tag name already exists!',
    )
```

Notes:
- `_name`, `_description` are mandatory on every concrete model.
- `models.Constraint(sql, message)` assigned to a class attribute is the
  modern (17.0+) way to declare a SQL constraint. The older
  `_sql_constraints = [('name_uniq', 'unique(name)', 'message')]` list form
  still works and is common in older/inherited code — recognize both, prefer
  the new form for new models.
- No type hints, no `from __future__ import annotations` — core itself does
  not require these. Add them only if the project you're working in already
  uses that style; don't impose it unprompted.

## Cron-called method pattern (batched with per-item commit)

Source: `addons/project/models/project_task_type.py`.

```python
def _send_rating_all(self):
    stages = self.search([
        ('rating_active', '=', True),
        ('rating_status', '=', 'periodic'),
        ('rating_request_deadline', '<=', fields.Datetime.now())
    ])
    for stage in stages:
        stage.project_ids.task_ids._send_task_rating_mail()
        stage._compute_rating_request_deadline()
        self.env.cr.commit()
```

`self.env.cr.commit()` inside a loop is a deliberate, accepted pattern
**only** inside cron/batch jobs, so a crash partway through doesn't roll back
everything already processed. Never do this in request-handling
(controller/API) code.

## Standard model skeleton for a new module

Use this as the shape for a typical business-document model (draft → done
workflow, company-scoped, chatter-enabled). Adapt fields to the task — don't
keep fields the model doesn't need.

```python
from odoo import api, fields, models, Command, _
from odoo.exceptions import UserError, ValidationError


class MyModel(models.Model):
    _name = 'my_module.my_model'
    _description = 'My Model'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'
    _check_company_auto = True

    name = fields.Char(string='Name', required=True, tracking=True)
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        'res.company', string='Company',
        default=lambda self: self.env.company, required=True, index=True,
    )
    partner_id = fields.Many2one('res.partner', string='Partner', check_company=True)
    line_ids = fields.One2many('my_module.my_model.line', 'parent_id', string='Lines', copy=True)
    state = fields.Selection(
        [('draft', 'Draft'), ('confirmed', 'Confirmed'), ('done', 'Done'), ('cancelled', 'Cancelled')],
        string='Status', default='draft', required=True, tracking=True, copy=False,
    )
    total_amount = fields.Float(string='Total', compute='_compute_total_amount', store=True)

    @api.depends('line_ids.amount')
    def _compute_total_amount(self):
        for record in self:
            record.total_amount = sum(record.line_ids.mapped('amount'))

    @api.constrains('total_amount')
    def _check_total_amount(self):
        for record in self:
            if record.total_amount < 0:
                raise ValidationError(_("Amount must be positive."))

    _name_uniq = models.Constraint(
        'unique(company_id, name)',
        'Name must be unique per company!',
    )

    @api.model_create_multi
    def create(self, vals_list):
        return super().create(vals_list)

    def action_confirm(self):
        self.write({'state': 'confirmed'})

    def action_done(self):
        for record in self:
            if not record.line_ids:
                raise UserError(_("Cannot complete without lines."))
        self.write({'state': 'done'})

    def action_cancel(self):
        self.write({'state': 'cancelled'})

    def action_draft(self):
        self.write({'state': 'draft'})
```

`check_company=True` on relational fields plus `_check_company_auto = True`
lets Odoo auto-generate the multi-company consistency check instead of
hand-writing it.
