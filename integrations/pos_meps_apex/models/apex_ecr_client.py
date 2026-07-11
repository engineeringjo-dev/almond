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
import json
import logging
import uuid
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

    def _encode_amount(self, amount):
        """Wire format for the amount (config: pos_meps_apex.amount_encoding)."""
        a = float(amount or 0.0)
        if self._param("pos_meps_apex.amount_encoding", "decimal3") == "int1000":
            return str(int(round(a * 1000)))   # integer minor units (fils): 1.500 -> "1500"
        return "%.3f" % a                        # decimal string: "1.500"

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

    def status(self, mid, tid, reference):
        """Query the outcome of a prior transaction — timeout/UNKNOWN recovery."""
        if self._mode() != "live":
            return {"approved": True, "state": "approved", "reference": reference, "mock": True}
        req = {"action": "STATUS", "mid": mid, "tid": tid,
               "reference": reference, "timestamp": amman_iso()}
        # TODO(Apex): confirm the status/inquiry endpoint + response fields.
        req["signature"] = self._sign(req, self._secure_key(mid))
        try:
            resp = requests.post(self._gateway_url(), json=req, timeout=60)
            resp.raise_for_status()
            return self._parse_response(resp.json())
        except Exception as exc:  # noqa: BLE001
            _logger.exception("ApexECR STATUS failed")
            raise UserError(_("MEPS status query failed: %s") % exc)

    # ------------- dispatch (with idempotency ledger) -------------
    def _run(self, action, mid, tid, amount, currency, reference, original_rrn=None):
        Txn = self.env["pos_meps_apex.txn"].sudo()
        mode = self._mode()

        # Stable idempotency key. The POS SHOULD pass one (stable across retries);
        # a generated fallback keeps the ledger valid but can't dedupe a real retry.
        if not reference:
            reference = "auto-%s" % uuid.uuid4().hex
            _logger.warning("ApexECR %s without a POS reference -> idempotency is best-effort", action)

        prior = Txn.search([("reference", "=", reference), ("action", "=", action)], limit=1)
        # Already charged for this key -> return the prior result, never re-charge.
        if prior and prior.state == "approved":
            _logger.info("ApexECR idempotent hit: %s %s already approved", action, reference)
            return prior._as_result()
        # A charging action left in limbo -> the terminal MAY have charged. Stop.
        if prior and action in ("SALE", "REFUND") and prior.state in ("pending", "unknown"):
            raise UserError(_(
                "A previous MEPS %s for reference %s is unresolved (%s). "
                "Check the terminal or run a status query before charging again."
            ) % (action, reference, prior.state))

        txn = prior or Txn.create({
            "reference": reference, "action": action, "mode": mode,
            "mid": mid, "tid": tid, "amount": float(amount or 0.0), "currency": currency,
        })

        req = self._build_request(action, mid, tid, amount, currency, reference, original_rrn)
        txn.write({"state": "pending", "request_json": json.dumps(req, default=str)})
        try:
            result = self._mock_response(action, req) if mode != "live" else self._live_call(req, mid)
        except Exception:
            txn._mark_unknown()   # ambiguous outcome: block silent re-charge next time
            raise
        txn._record_result(result)
        return result

    # ================= APEX-SPECIFIC (the only TODOs) =================
    def _build_request(self, action, mid, tid, amount, currency, reference, original_rrn):
        body = {
            "action": action,
            "mid": mid,
            "tid": tid,
            "amount": self._encode_amount(amount),   # config-driven (decimal3 / int1000)
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
