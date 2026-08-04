from odoo import fields, models


class PosOrder(models.Model):
    _inherit = 'pos.order'

    # Stored related: materialises the column so the dashboard filter and
    # aggregations hit an index instead of hopping through pos.config per row.
    # No field-level index=True: the composite below leads with branch_id and
    # already serves single-column branch_id lookups (avoids a redundant btree).
    branch_id = fields.Many2one(
        'almond.branch', string='Branch',
        related='config_id.branch_id', store=True, readonly=True,
    )

    # Composite index for the common "one branch, over a date range" aggregate;
    # its branch_id prefix also covers plain branch_id filtering.
    _branch_date_idx = models.Index('(branch_id, date_order)')
