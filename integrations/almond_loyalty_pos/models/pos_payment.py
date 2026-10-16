# -*- coding: utf-8 -*-
"""A persisted tender identity, not a financial authorization.

Odoo19 serializes Python model fields for ORM/IndexedDB. This identity therefore
survives draft reload independently of the order's transient UI state.
"""
from odoo import api, fields, models


class PosPayment(models.Model):
    _inherit = "pos.payment"

    almond_redemption_id = fields.Char(
        copy=False, index=True,
        help="BFF redemption identity; server-side scan/settlement ledger remains authoritative.",
    )
    _uniq_almond_redemption_id = models.Constraint(
        "UNIQUE(almond_redemption_id)",
        "This Almond redemption already has a payment line.",
    )

    @api.model
    def _load_pos_data_fields(self, config):
        fields_to_load = super()._load_pos_data_fields(config)
        # An empty list means read ALL fields. Appending to that sentinel
        # would accidentally omit amount/method and break normal payments.
        return fields_to_load + ["almond_redemption_id"] if fields_to_load else fields_to_load
