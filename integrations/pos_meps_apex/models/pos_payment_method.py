# -*- coding: utf-8 -*-
from odoo import fields, models


class PosPaymentMethod(models.Model):
    _inherit = "pos.payment.method"

    # Extend the terminal selector with our provider.
    use_payment_terminal = fields.Selection(
        selection_add=[("meps_apex", "MEPS (Apex ECR)")],
        ondelete={"meps_apex": "set default"},
    )
    # Per-method mapping to the physical terminal (from the MEPS/Apex sheet).
    meps_mid = fields.Char(
        "MEPS MID", help="Merchant ID, e.g. 190028450000000 (branch)."
    )
    meps_tid = fields.Char(
        "MEPS TID", help="Terminal ID of the specific machine, e.g. 19062845."
    )
    # NOTE: the SecureKey is NOT stored here (it would reach the client).
    # It lives in ir.config_parameter as  pos_meps_apex.securekey.<MID>  (server only).
