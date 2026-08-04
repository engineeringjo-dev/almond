# -*- coding: utf-8 -*-
"""
MEPS ApexECR transaction ledger.

Two jobs:
  1. IDEMPOTENCY — the anti-double-charge guard. Every SALE/REFUND is keyed by a
     stable `reference` (idempotency key from the POS). A retry with the same
     reference never fires a second charge: if the prior attempt is APPROVED we
     return it; if it is PENDING/UNKNOWN (e.g. a timeout where the terminal may
     have charged) we STOP and require a status()/reconcile instead of re-charging.
  2. RECONCILIATION basis — one row per terminal transaction (RRN/auth/batch) to
     later match against the MEPS settlement/SETTLE report.

No card PAN is stored beyond the masked value the terminal returns.
"""
import json

from odoo import fields, models


class ApexTxn(models.Model):
    _name = "pos_meps_apex.txn"
    _description = "MEPS ApexECR transaction (idempotency + reconciliation ledger)"
    _order = "create_date desc"

    reference = fields.Char(required=True, index=True, help="Idempotency key (stable per payment attempt).")
    action = fields.Selection(
        [("SALE", "Sale"), ("REFUND", "Refund"), ("VOID", "Void")],
        required=True, index=True,
    )
    mode = fields.Selection([("mock", "Mock"), ("live", "Live")], required=True)
    mid = fields.Char(string="MID")
    tid = fields.Char(string="TID")
    amount = fields.Float(digits=(16, 3))
    currency = fields.Char(default="JOD")
    state = fields.Selection(
        [("pending", "Pending"), ("approved", "Approved"),
         ("declined", "Declined"), ("unknown", "Unknown (needs reconcile)")],
        default="pending", required=True, index=True,
    )
    auth_code = fields.Char()
    rrn = fields.Char(string="RRN", index=True)
    masked_pan = fields.Char()
    scheme = fields.Char()
    batch = fields.Char()
    invoice = fields.Char()
    request_json = fields.Text()
    response_json = fields.Text()

    # One ledger row per (reference, action): a retry reuses it, never duplicates.
    _uniq_reference_action = models.Constraint(
        "UNIQUE(reference, action)",
        "A MEPS transaction already exists for this reference and action.",
    )

    def _as_result(self, idempotent=True):
        self.ensure_one()
        return {
            "approved": self.state == "approved",
            "state": self.state,
            "authCode": self.auth_code,
            "rrn": self.rrn,
            "maskedPan": self.masked_pan,
            "scheme": self.scheme,
            "invoice": self.invoice,
            "batch": self.batch,
            "reference": self.reference,
            "idempotent": idempotent,
        }

    def _record_result(self, result):
        """Persist the terminal outcome onto the ledger row."""
        self.ensure_one()
        self.write({
            "state": "approved" if result.get("approved") else "declined",
            "auth_code": result.get("authCode"),
            "rrn": result.get("rrn"),
            "masked_pan": result.get("maskedPan"),
            "scheme": result.get("scheme"),
            "invoice": result.get("invoice"),
            "batch": result.get("batch"),
            "response_json": json.dumps(result.get("raw") or result, default=str),
        })

    def _mark_unknown(self):
        """Timeout/transport error: outcome is ambiguous — do NOT auto re-charge."""
        self.ensure_one()
        self.write({"state": "unknown"})
