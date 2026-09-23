# -*- coding: utf-8 -*-
from odoo import fields, models


class PosConfig(models.Model):
    _inherit = "pos.config"

    # pos.config loads ALL its fields into the POS (no _load_pos_data_fields
    # override in 19.0), so both fields below reach the till automatically.
    # Neither is a secret.
    almond_loyalty_enabled = fields.Boolean(
        "Almond Loyalty", help="Show the «ألموند» button on this shop's till and send points after payment.",
    )
    almond_loyalty_branch_id = fields.Char(
        "Almond branch id",
        help="The branchId the Almond API knows this shop by (e.g. 'mecca-st'). "
             "Sent with every earn. Several POS shops of one branch share the same id.",
    )
