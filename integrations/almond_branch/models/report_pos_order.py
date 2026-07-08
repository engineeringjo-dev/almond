from odoo import fields, models


class ReportPosOrder(models.Model):
    _inherit = 'report.pos.order'

    # report.pos.order is a SQL view (_auto = False): a stored field is impossible.
    # We declare a non-stored field that MAPS a column we add to the view SQL below.
    branch_id = fields.Many2one('almond.branch', string='Branch', readonly=True)

    # Verified against Odoo 19 source (point_of_sale/report/pos_order_report.py):
    #   - the view is built from _select() + _from(); init() does CREATE VIEW (_select _from)
    #   - aliases: s = pos_order, l = pos_order_line, ps = pos_session
    #   - the base report does NOT join pos_config, so we add it off ps.config_id
    #   - _group_by() returns '' and is unused; the view is line-level -> no group-by override
    def _select(self):
        return super()._select() + ", pc.branch_id AS branch_id"

    def _from(self):
        return super()._from() + " LEFT JOIN pos_config pc ON pc.id = ps.config_id"
