from odoo import fields, models


class PosOrder(models.Model):
    _inherit = 'pos.order'

    # Stored + indexed related: materialises the column so the dashboard filter and
    # aggregations hit an index instead of hopping through pos.config per row.
    branch_id = fields.Many2one(
        'almond.branch', string='Branch',
        related='config_id.branch_id', store=True, index=True, readonly=True,
    )

    # Composite index for the common "one branch, over a date range" aggregate.
    _branch_date_idx = models.Index('(branch_id, date_order)')
