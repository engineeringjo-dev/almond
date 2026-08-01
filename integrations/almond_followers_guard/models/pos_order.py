# -*- coding: utf-8 -*-
from odoo import api, models


class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.model_create_multi
    def create(self, vals_list):
        # Cashier users create every order; auto-subscribing them as chatter
        # followers produced ~10-15k dead mail.followers rows per trading day.
        return super(
            PosOrder, self.with_context(mail_create_nosubscribe=True)
        ).create(vals_list)
