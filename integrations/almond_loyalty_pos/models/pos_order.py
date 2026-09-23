# -*- coding: utf-8 -*-
"""
pos.order: loyalty result on the order + the post-payment hook.

HOOK POINTS (verified against the Odoo 19.0 source,
``addons/point_of_sale/models/pos_order.py``):

* ``_process_saved_order(draft)`` — the single place where an order becomes
  paid. Both paths go through it: the till (``sync_from_ui`` ->
  ``_process_order`` -> ``_process_saved_order``) and the back-office payment
  wizard (``pos.make.payment.check`` -> ``order._process_saved_order(False)``).
  By the time ``super()`` returns, ``action_pos_order_paid()`` has set
  ``state='paid'``, ``write()`` has assigned the final ``name`` (our
  posOrderRef), and the payment lines — including the negative cash-change
  line — exist. That is exactly "after payment is confirmed". We only INSERT
  an outbox row here (no network), inside a savepoint, and swallow any error:
  a loyalty problem can never fail the sale.

* ``_process_order(order, existing_order)`` — strips our server-owned
  ``almond_*`` keys from the payload the browser sends. Needed because
  ``pos.order`` loads ALL its fields into the POS (``_load_pos_data_fields``
  returns ``[]``) and the POS serializer sends every non-computed field back,
  as ``false`` when unset (``related_models/serialization.js``) — which would
  otherwise overwrite the server's values.

* ``_load_pos_data_read(records, config)`` — removes ``almond_earn_ticket``
  from every order dict sent to the browser (sync results, ticket screen,
  bus notifications all go through it). The field also has
  ``groups='base.group_system'``; verified in the 19.0 ORM that
  ``read([])`` (what the POS loader calls) silently SKIPS fields the user
  cannot read (``fields_get`` -> ``_has_field_access``) instead of raising, so
  the group does not break POS loading. The pop covers a system admin who
  opens a till.

All new methods are prefixed ``_almond_`` so they cannot collide with another
module's method in the MRO (Almond production runs custom JoFotara modules
that override pos.order; a same-name collision there already cost weeks).
"""
import logging

from markupsafe import Markup

from odoo import _, api, fields, models

from . import almond_loyalty_policy as policy

_logger = logging.getLogger(__name__)

# Fields the SERVER owns; anything the browser sends for them is dropped.
ALMOND_SERVER_FIELDS = (
    "almond_member_id",
    "almond_earn_ticket",
    "almond_earn_state",
    "almond_points_earned",
    "almond_redemption_code",
    "almond_redemption_value",
    "almond_redemption_mismatch",
    "almond_corporate_percent",
)
# Never sent to the browser.
ALMOND_HIDDEN_FROM_POS = ("almond_earn_ticket",)


class PosOrder(models.Model):
    _inherit = "pos.order"

    almond_member_id = fields.Char("Almond member", readonly=True, copy=False, index="btree_not_null")
    almond_earn_ticket = fields.Char(readonly=True, copy=False, groups="base.group_system")
    almond_earn_state = fields.Selection(
        [("none", "No earn"), ("pending", "Pending"), ("sent", "Sent"),
         ("failed", "Failed"), ("reversed", "Reversed")],
        string="Almond points", default="none", readonly=True, copy=False,
    )
    almond_points_earned = fields.Float("Almond points earned", readonly=True, copy=False)
    almond_redemption_code = fields.Char("Almond redemption code", readonly=True, copy=False)
    almond_redemption_value = fields.Float("Almond redemption (JOD)", digits=(16, 3), readonly=True, copy=False)
    almond_redemption_mismatch = fields.Boolean(
        "Almond redemption mismatch", readonly=True, copy=False,
        help="More was charged to the Almond redemption payment method than the Almond API settled "
             "for this order. Check the order and the redemption log.",
    )
    almond_corporate_percent = fields.Float("Almond corporate discount (%)", digits=(5, 2), readonly=True, copy=False)

    # ------------------------------------------------------------ POS I/O
    @api.model
    def _process_order(self, order, existing_order):
        for key in ALMOND_SERVER_FIELDS:
            order.pop(key, None)
        return super()._process_order(order, existing_order)

    @api.model
    def _load_pos_data_read(self, records, config):
        read_records = super()._load_pos_data_read(records, config)
        for rec in read_records:
            for key in ALMOND_HIDDEN_FROM_POS:
                rec.pop(key, None)
        return read_records

    def _process_saved_order(self, draft):
        res = super()._process_saved_order(draft)
        if not draft and self.state in ("paid", "done"):
            self._almond_loyalty_after_paid()
        return res

    # ------------------------------------------------------------ after paid
    def _almond_loyalty_after_paid(self):
        """Never raises. Everything inside a savepoint: on error the loyalty
        writes are rolled back, logged, and the sale commits normally."""
        for order in self:
            try:
                with self.env.cr.savepoint():
                    order._almond_loyalty_link()
            except Exception:  # noqa: BLE001 — graceful degradation is the requirement
                _logger.exception("Almond loyalty: post-payment hook failed for pos.order #%s", order.id)

    def _almond_loyalty_link(self):
        self.ensure_one()
        if not self.config_id.almond_loyalty_enabled:
            return
        Outbox = self.env["almond.loyalty.outbox"]

        # -- Refund: reverse the ORIGINAL order's earn (contract: full reversal)
        origin = self.refunded_order_id
        if origin:
            if origin.almond_earn_state in ("pending", "sent"):
                Outbox._almond_enqueue(
                    "reverse", origin.name,
                    {"reason": "refund %s" % self.name},
                    pos_order=self, origin_order=origin,
                )
            if origin.almond_redemption_value:
                # The API has no "un-settle": a refunded redemption is NOT
                # given back to the member automatically.
                self.message_post(body=_(
                    "The refunded order %(origin)s used an Almond redemption of %(value).3f JOD. "
                    "It is not returned to the member automatically — handle it in the Almond back office.",
                    origin=origin.name, value=origin.almond_redemption_value,
                ))
            return

        scans = self.env["almond.loyalty.scan"].sudo().search([("order_uuid", "=", self.uuid)])  # id desc
        scan = scans[:1]  # latest = the member on the order
        # The earn comes from the latest ticket-bearing scan of THAT member (a
        # redeem-mode scan never carries a ticket; the pay-mode one does).
        earn_scan = scans.filtered(lambda s: s.member_id == scan.member_id and s.earns_points and s.earn_ticket)[:1]
        redemptions = self.env["almond.loyalty.redemption"].sudo().search([("order_uuid", "=", self.uuid)])
        vals = {}

        # -- Redemptions settled for this order (value comes from the API, not the till)
        redemption_payments = self.payment_ids.filtered(lambda p: p.payment_method_id.almond_is_redemption)
        paid_by_redemption = sum(redemption_payments.mapped("amount"))
        settled = sum(redemptions.mapped("value_jod"))
        if redemptions:
            redemptions.write({"pos_order_id": self.id})
            vals["almond_redemption_code"] = ", ".join(c for c in redemptions.mapped("code") if c)
            vals["almond_redemption_value"] = settled
        if policy.redemption_mismatch(paid_by_redemption, settled):
            vals["almond_redemption_mismatch"] = True
            self.message_post(body=Markup("<b>%s</b>") % _(
                "Almond redemption mismatch: %(paid).3f JOD charged to the Almond redemption method, "
                "%(settled).3f JOD settled by the Almond API.",
                paid=paid_by_redemption, settled=settled,
            ))

        # -- Member + earn
        if scan:
            vals["almond_member_id"] = scan.member_id
            vals["almond_corporate_percent"] = scan.corporate_percent
        total = policy.paid_total(
            (p.amount, p.payment_method_id.almond_is_redemption) for p in self.payment_ids
        )
        ticket = earn_scan.earn_ticket if earn_scan else False
        if ticket and total > 0 and self.name and self.name != "/":
            vals.update({"almond_earn_ticket": ticket, "almond_earn_state": "pending"})
            self.sudo().write(vals)  # sudo: almond_earn_ticket is system-only
            Outbox._almond_enqueue("earn", self.name, {
                "earnTicket": ticket,
                "branchId": self.config_id.almond_loyalty_branch_id or None,
                "paidTotal": total,
                "paidAt": self._almond_paid_at(),
            }, pos_order=self)
        else:
            vals["almond_earn_state"] = "none"
            self.sudo().write(vals)  # sudo: almond_earn_ticket is system-only

    def _almond_paid_at(self):
        """The order's PAYMENT time as ISO-8601 UTC with an explicit 'Z'.

        Sent with every earn: the BFF accepts the sale only if it was paid
        within [scan − 30 min, scan + 6 h] of the member's scan, however late
        the outbox delivers it — so this must be when the money was taken,
        never "now". ``date_order`` is re-stamped at validation by the 19.0
        till; ``payment_date`` covers the back-office payment wizard
        (see ``almond_loyalty_policy.payment_time``)."""
        self.ensure_one()
        paid = policy.payment_time(
            self.date_order,
            [p.payment_date for p in self.payment_ids if not p.is_change],
        )
        return policy.iso_utc(paid)
