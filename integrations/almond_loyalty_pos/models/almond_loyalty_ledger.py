# -*- coding: utf-8 -*-
"""
Server-side record of what happened at the till, keyed by the POS order UUID.

WHY SERVER-SIDE: a member is scanned and a redemption settled while the order
is still a DRAFT that may not exist in the database yet (the POS keeps drafts in
the browser). The browser therefore only gets DISPLAY data; the values that
move points or money (the earn ticket, the member id, the settled value) are
kept here and copied onto ``pos.order`` by the server when the order is paid
(``pos_order.py``). The till can never forge an earn ticket or inflate a
settled redemption value, because it never holds them.

Both models are written only by the controllers (sudo); POS managers can read.
"""
from odoo import fields, models


class AlmondLoyaltyScan(models.Model):
    _name = "almond.loyalty.scan"
    _description = "Almond loyalty: member scanned at a till"
    _order = "id desc"

    order_uuid = fields.Char(required=True, index=True, readonly=True,
                             help="pos.order.uuid of the order the member was attached to.")
    active = fields.Boolean(default=True,
                            help="Only the latest scan of an order is active; detaching the member archives it.")
    session_id = fields.Many2one("pos.session", readonly=True, index=True)
    config_id = fields.Many2one("pos.config", readonly=True)
    user_id = fields.Many2one("res.users", readonly=True, default=lambda self: self.env.user)
    member_id = fields.Char(readonly=True, index=True)
    mode = fields.Selection([("pay", "Pay"), ("earn", "Earn"), ("corporate", "Corporate"),
                             ("redeem", "Redeem")], readonly=True)
    earns_points = fields.Boolean(readonly=True)
    # Bearer value for this member's earn: system-only, never sent to the till.
    earn_ticket = fields.Char(readonly=True, groups="base.group_system")
    corporate_name = fields.Char(readonly=True)
    corporate_percent = fields.Float(readonly=True, digits=(5, 2))
    # A redeem scan reveals the member's live code; kept to settle it
    # server-side without the till ever holding it (system-only).
    redemption_code = fields.Char(readonly=True, groups="base.group_system")
    redemption_value = fields.Float(readonly=True, digits=(16, 3))


class AlmondLoyaltyRedemption(models.Model):
    _name = "almond.loyalty.redemption"
    _description = "Almond loyalty: redemption settled at a till"
    _order = "id desc"

    order_uuid = fields.Char(required=True, index=True, readonly=True)
    session_id = fields.Many2one("pos.session", readonly=True, index=True)
    config_id = fields.Many2one("pos.config", readonly=True)
    user_id = fields.Many2one("res.users", readonly=True, default=lambda self: self.env.user)
    member_id = fields.Char(readonly=True, index=True)
    code = fields.Char(readonly=True, help="Spent code (single use), kept for reconciliation with the BFF.")
    method = fields.Selection([("scan", "From the member scan"), ("code", "Code typed"),
                               ("token", "Redeem QR")], readonly=True)
    value_jod = fields.Float(readonly=True, digits=(16, 3), required=True)
    points = fields.Float(readonly=True)
    pos_order_id = fields.Many2one("pos.order", readonly=True, index="btree_not_null",
                                   help="Filled when the order is paid.")
