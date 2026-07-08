from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    # Many2one is NOT auto-indexed in Odoo 19 -> index=True is required for the filter.
    branch_id = fields.Many2one(
        'almond.branch', string='Branch', index=True,
        domain="[('company_id', '=', company_id)]",
        help="Physical branch this POS shop belongs to. Several shops "
             "(e.g. 'Mecca Street' + 'Mecca Street 2') can share one branch.",
    )
