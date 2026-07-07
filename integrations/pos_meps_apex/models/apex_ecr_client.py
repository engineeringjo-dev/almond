# -*- coding: utf-8 -*-
"""
ApexECR client — the SINGLE isolation point for everything vendor-specific.

Two modes (system param `pos_meps_apex.mode`, default 'mock'):
  * mock  -> returns a canned APPROVED result, NO network. Lets you run the full
             Odoo POS flow (sale -> approval -> pos.payment -> reconcile) TODAY,
             with zero Apex dependency.
  * live  -> signs + POSTs to the Apex cloud gateway.

When Apex hands over ONE real sample, only three private methods change here —
_build_request / _sign / _parse_response — nothing else in the module.

SECURITY: SecureKey + gateway URL are read from ir.config_parameter (server only)
and never reach the browser. Card PAN never touches Odoo (out of PCI scope).
Timestamps carry an explicit Asia/Amman +03:00 offset.
"""
import hashlib
import hmac
import logging
from datetime import datetime, timezone, timedelta

import requests

from odoo import models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

AMMAN = timezone(timedelta(hours=3))  # Asia/Amman = permanent UTC+3


def amman_iso(dt=None):
    """ISO-8601 with an explicit +03:00 offset (never a bare Z)."""
    return (dt or datetime.now(AMMAN)).astimezone(AMMAN).isoformat(timespec="milliseconds")


class ApexEcrClient(models.AbstractModel):
    _name = "pos_meps_apex.client"
    _description = "ApexECR client (server-only, mock/live)"

    # ---------------- config ----------------
    def _param(self, key, default=""):
        return (self.env["ir.config_parameter"].sudo().get_param(key, default) or "").strip()

    def _mode(self):
        return self._param("pos_meps_apex.mode", "mock").lower()

    def _gateway_url(self):
        # TODO(Apex): confirm the external-POS ECR endpoint.
        return self._param(
            "pos_meps_apex.gateway_url",
            "https://gprs.mepspay.com:6610/apex.smartpos.gateway/services.ashx",
        )

    def _secure_key(self, mid):
        key = self._param("pos_meps_apex.securekey.%s" % mid)
        if not key and self._mode() == "live":
            raise UserError(_("MEPS SecureKey not configured for MID %s.") % mid)
        return key

    # ------------- public API (what the controller calls) -------------
    def sale(self, mid, tid, amount, currency="JOD", reference=None):
        return self._run("SALE", mid, tid, amount, currency, reference)

    def refund(self, mid, tid, amount, currency="JOD", reference=None):
        return self._run("REFUND", mid, tid, amount, currency, reference)

    def void(self, mid, tid, reference=None, original_rrn=None):
        return self._run("VOID", mid, tid, 0.0, "JOD", reference, original_rrn)

    # ------------- dispatch -------------
    def _run(self, action, mid, tid, amount, currency, reference, original_rrn=None):
        req = self._build_request(action, mid, tid, amount, currency, reference, original_rrn)
        if self._mode() != "live":
            return self._mock_response(action, req)
        return self._live_call(req, mid)

    # ================= APEX-SPECIFIC (the only TODOs) =================
    def _build_request(self, action, mid, tid, amount, currency, reference, original_rrn):
        body = {
            "action": action,
            "mid": mid,
            "tid": tid,
            "amount": "%.3f" % float(amount),   # JOD X.XXX
            "currency": currency,
            "reference": reference or "",
            "timestamp": amman_iso(),           # +03:00 explicit
        }
        if original_rrn:
            body["originalRrn"] = original_rrn
        return body

    def _sign(self, body, secure_key):
        # ⚠️ TODO(Apex): replace with Apex's exact algorithm/field order.
        canonical = "|".join(str(body[k]) for k in sorted(body))
        return hmac.new(secure_key.encode(), canonical.encode(), hashlib.sha256).hexdigest().upper()

    def _parse_response(self, data):
        # ⚠️ TODO(Apex): map to Apex's real field names.
        return {
            "approved": bool(data.get("approved") or data.get("Approved")),
            "authCode": data.get("authCode") or data.get("AuthCode"),
            "rrn": data.get("rrn") or data.get("RRN"),
            "maskedPan": data.get("maskedPan") or data.get("PAN"),
            "scheme": data.get("scheme") or data.get("CardType"),
            "invoice": data.get("invoice") or data.get("Invoice"),
            "batch": data.get("batch") or data.get("Batch"),
            "raw": data,
        }
    # ===============================================================

    def _live_call(self, req, mid):
        req["signature"] = self._sign(req, self._secure_key(mid))
        try:
            resp = requests.post(self._gateway_url(), json=req, timeout=120)
            resp.raise_for_status()
            return self._parse_response(resp.json())
        except Exception as exc:  # noqa: BLE001
            _logger.exception("ApexECR %s failed", req.get("action"))
            raise UserError(_("MEPS terminal error: %s") % exc)

    def _mock_response(self, action, req):
        """Canned APPROVED result — no network. Deterministic-ish refs."""
        seed = hashlib.sha1(("%s%s" % (req.get("reference"), req.get("timestamp"))).encode()).hexdigest().upper()
        _logger.info("ApexECR MOCK %s -> APPROVED (%s)", action, seed[:6])
        return {
            "approved": True,
            "authCode": "MOCK" + seed[:6],
            "rrn": seed[6:18],
            "maskedPan": "400000******0002",
            "scheme": "VISA",
            "invoice": seed[18:24],
            "batch": "000001",
            "raw": {"mock": True, "action": action, "request": req},
        }
