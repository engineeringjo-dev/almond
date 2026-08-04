# -*- coding: utf-8 -*-
from odoo import api, models


class LoyaltyCard(models.Model):
    _inherit = "loyalty.card"

    @api.model_create_multi
    def create(self, vals_list):
        return super(
            LoyaltyCard, self.with_context(mail_create_nosubscribe=True)
        ).create(vals_list)
