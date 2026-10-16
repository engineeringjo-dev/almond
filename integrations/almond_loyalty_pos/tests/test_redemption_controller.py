"""Controller contract tests with small ORM doubles, not an installed Odoo.
The real PostgreSQL UNIQUE constraint and live POS persistence still need dev Odoo.
"""
import importlib.util
import sys
import types
import unittest
from contextlib import nullcontext
from unittest.mock import Mock, patch

from test_client import ADDON, C

ROOT = "almond_loyalty_pos_controller_test"
for suffix, path in (("", ADDON), (".models", ADDON / "models"), (".controllers", ADDON / "controllers")):
    module = types.ModuleType(ROOT + suffix)
    module.__path__ = [str(path)]
    sys.modules[module.__name__] = module
sys.modules[ROOT + ".models.almond_loyalty_client"] = C


class UniqueViolation(Exception):
    pass


http = types.SimpleNamespace(Controller=object, route=lambda *args, **kwargs: lambda function: function)
request = types.SimpleNamespace(env=None)
odoo = types.ModuleType("odoo")
odoo._ = lambda value, **kwargs: value
odoo.http = http
odoo_http = types.ModuleType("odoo.http")
odoo_http.request = request
errors = types.ModuleType("psycopg2.errors")
errors.UniqueViolation = UniqueViolation
spec = importlib.util.spec_from_file_location(ROOT + ".controllers.main", ADDON / "controllers/main.py")
controller = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {"odoo": odoo, "odoo.http": odoo_http, "psycopg2": types.ModuleType("psycopg2"), "psycopg2.errors": errors}):
    spec.loader.exec_module(controller)


class Rows:
    def __init__(self, rows=()):
        self.rows = list(rows)
        self.created = []

    def sudo(self):
        return self

    def search(self, domain, limit=None):
        found = [row for row in self.rows if getattr(row, "active", True) and all(
            getattr(row, name, None) == value for name, operator, value in domain if operator == "="
        )]
        return found[0] if found else None

    def create(self, values):
        self.created.append(dict(values))
        row = types.SimpleNamespace(**values)
        self.rows.append(row)
        return row


class TestReceiptController(unittest.TestCase):
    def setUp(self):
        self.scan = types.SimpleNamespace(order_uuid="order-a", session_id=1, mode="redeem", member_id="member-a",
                                          redemption_id="redemption-a", redemption_settlement_token="server-only-receipt")
        self.scans = Rows([self.scan])
        self.ledger = Rows()
        env = {"almond.loyalty.scan": self.scans, "almond.loyalty.redemption": self.ledger}
        class Env(dict):
            cr = types.SimpleNamespace(savepoint=lambda: nullcontext())
        request.env = Env(env)
        self.api = Mock()
        self.api.settle_redemption.return_value = C.SettleResult(
            value_jod=2, points=200, member_id="member-a", code=None, redemption_id="redemption-a",
        )
        self.handler = controller.AlmondLoyaltyController()
        self.handler._almond_session = lambda session_id: types.SimpleNamespace(
            id=1, config_id=types.SimpleNamespace(id=7, almond_loyalty_enabled=True),
        )
        self.handler._client = lambda: self.api

    def settle(self, **kwargs):
        return self.handler.settle(session_id=1, order_uuid="order-a", **kwargs)

    def test_scan_receipt_stays_server_side_and_same_order_recovery_creates_one_audit(self):
        first = self.settle(from_scan=True)
        second = self.settle(from_scan=True)
        self.assertEqual(first, second)
        self.assertEqual(first, {"ok": True, "redemptionId": "redemption-a", "valueJod": 2, "points": 200})
        self.assertEqual(len(self.ledger.created), 1)
        self.api.settle_redemption.assert_called_once_with(
            settlement_token="server-only-receipt", pos_order_ref="order-a",
            idempotency_key=C.redemption_attempt_key("order-a", "settlementToken", "server-only-receipt"),
        )
        self.assertNotIn("server-only-receipt", str(first))
        self.assertEqual(self.scan.redemption_settlement_token, "server-only-receipt")

    def test_actual_scan_response_excludes_the_receipt_but_server_record_keeps_it(self):
        class Earlier:
            def filtered(self, predicate):
                return self
            def write(self, values):
                pass
        self.scans.search = Mock(return_value=Earlier())
        self.api.scan.return_value = C.ScanResult(
            member_id="member-a", mode="redeem", earns_points=True,
            redemption={"id": "redemption-a", "settlementToken": "server-only-receipt",
                        "presentationExpiresAt": "2026-10-16T12:00:00Z", "valueJod": 2, "points": 200},
        )
        response = self.handler.scan(session_id=1, order_uuid="order-a", token="raw-qr")
        self.assertTrue(response["ok"])
        self.assertEqual(self.scans.created[0]["redemption_settlement_token"], "server-only-receipt")
        self.assertEqual(response["redemption"]["presentationExpiresAt"], "2026-10-16T12:00:00Z")
        self.assertNotIn("server-only-receipt", str(response))
        self.assertNotIn("redemption_code", self.scans.created[0])

    def test_typed_code_and_old_scan_without_receipt_never_reach_api(self):
        self.assertEqual(self.settle(code="ABCD-EFGH")["error"], "redemption_barcode_required")
        self.scan.redemption_settlement_token = None
        self.assertFalse(self.settle(from_scan=True)["ok"])
        self.api.settle_redemption.assert_not_called()
        self.assertEqual(self.ledger.created, [])

    def test_existing_identity_for_another_order_or_another_original_receipt_cannot_recover_value(self):
        attempt = C.redemption_attempt_key("order-a", "settlementToken", "server-only-receipt")
        for order, key in (("order-b", attempt), ("order-a", "different-original-attempt")):
            self.ledger.rows = [types.SimpleNamespace(redemption_id="redemption-a", order_uuid=order,
                                                      settlement_key=key, value_jod=2, points=200)]
            self.assertFalse(self.settle(from_scan=True)["ok"])
        self.api.settle_redemption.assert_not_called()
        self.assertEqual(self.ledger.created, [])

    def test_expired_receipt_mismatched_identity_and_unique_race_never_return_tender(self):
        self.api.settle_redemption.side_effect = C.TokenExpiredError("expired")
        self.assertEqual(self.settle(from_scan=True)["error"], "qr_expired")
        self.api.settle_redemption.side_effect = None
        self.api.settle_redemption.return_value = C.SettleResult(2, 200, "member-a", None, "other-redemption")
        self.assertFalse(self.settle(from_scan=True)["ok"])
        self.api.settle_redemption.return_value = C.SettleResult(2, 200, "member-a", None, "redemption-a")
        self.ledger.create = Mock(side_effect=UniqueViolation())
        self.assertEqual(self.settle(from_scan=True)["error"], "qr_used")
        self.assertEqual(self.ledger.created, [])

    def test_same_original_raw_qr_retains_same_order_body_and_attempt_key(self):
        first = self.settle(token=" original-raw-qr ")
        second = self.settle(token="original-raw-qr")
        self.assertEqual(first, second)
        self.assertEqual(len(self.ledger.created), 1)
        for call in self.api.settle_redemption.call_args_list:
            self.assertEqual(call.kwargs, {"token": "original-raw-qr", "pos_order_ref": "order-a",
                                          "idempotency_key": C.redemption_attempt_key("order-a", "token", "original-raw-qr")})


if __name__ == "__main__":
    unittest.main()
