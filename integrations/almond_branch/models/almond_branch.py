from odoo import fields, models


class AlmondBranch(models.Model):
    _name = 'almond.branch'
    _description = 'Branch (groups multiple POS shops)'
    _order = 'name'

    name = fields.Char(required=True, translate=True)
    company_id = fields.Many2one(
        'res.company', string='Company', required=True, index=True,
        default=lambda self: self.env.company,
    )
    active = fields.Boolean(default=True)
    pos_config_ids = fields.One2many('pos.config', 'branch_id', string='POS Shops')
    pos_config_count = fields.Integer(compute='_compute_pos_config_count')

    # Odoo 19: declarative constraint (replaces _sql_constraints).
    _unique_name_company = models.Constraint(
        'UNIQUE(name, company_id)',
        'A branch with this name already exists for this company.',
    )

    def _compute_pos_config_count(self):
        for branch in self:
            branch.pos_config_count = len(branch.pos_config_ids)
