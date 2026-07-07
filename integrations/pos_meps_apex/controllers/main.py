# -*- coding: utf-8 -*-
"""
Thin server endpoint the POS frontend calls. The browser never sees the
SecureKey or the gateway — it only asks Odoo to run a SALE on a payment method,
and Odoo (server) does the signed ApexECR cloud call.
"""
from odoo import http
from odoo.http import request


class PosMepsApexController(http.Controller):

    @http.route("/pos_meps_apex/sale", type="json", auth="user")
    def sale(self, payment_method_id, amount, reference=None, **kw):
        pm = request.env["pos.payment.method"].sudo().browse(int(payment_method_id))
        if not pm or pm.use_payment_terminal != "meps_apex":
            return {"approved": False, "error": "Invalid MEPS payment method"}
        client = request.env["pos_meps_apex.client"].sudo()
        try:
            return client.sale(
                mid=pm.meps_mid, tid=pm.meps_tid, amount=amount, reference=reference
            )
        except Exception as exc:  # noqa: BLE001
            return {"approved": False, "error": str(exc)}
