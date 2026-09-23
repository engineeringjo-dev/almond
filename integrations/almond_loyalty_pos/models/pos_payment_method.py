# -*- coding: utf-8 -*-
from odoo import api, fields, models


class PosPaymentMethod(models.Model):
    _inherit = "pos.payment.method"

    almond_is_redemption = fields.Boolean(
        "Almond redemption",
        help="Payment lines on this method are Almond loyalty redemptions (points turned into money off the bill). "
             "The POS adds them only after the Almond API settled the redemption; the method is hidden from the "
             "normal payment buttons. Book it to the loyalty LIABILITY account (outstanding account), not to a "
             "sales discount — confirm with the accountant.",
    )

    @api.model
    def _load_pos_data_fields(self, config):
        # Same pattern as pos_adyen in 19.0: this model loads an explicit field list.
        params = super()._load_pos_data_fields(config)
        params += ["almond_is_redemption"]
        return params
