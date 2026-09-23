# -*- coding: utf-8 -*-
"""
Plain-``unittest`` tests for the Odoo-free parts of almond_loyalty_pos:
the HTTP client (against the stdlib mock BFF) and the outbox/money policy.

    python3 -m unittest discover integrations/almond_loyalty_pos/tests -v

No Odoo needed. These are NOT Odoo tests: there is deliberately no
``tests/__init__.py`` so Odoo's test loader never picks this file up (it
expects odoo.tests cases). Odoo-side tests (TransactionCase for the paid
hook / outbox cron, a POS tour for the button) are a TODO for Ishbek — see
README "What is TODO".
"""
import importlib
import io
import logging
import sys
import threading
import types
import unittest
from pathlib import Path

import requests

ADDON = Path(__file__).resolve().parents[1]

# Import models/almond_loyalty_client.py + almond_loyalty_policy.py as a
# package WITHOUT executing models/__init__.py (that one imports odoo).
_PKG = "almond_loyalty_pos_models_standalone"
if _PKG not in sys.modules:
    pkg = types.ModuleType(_PKG)
    pkg.__path__ = [str(ADDON / "models")]
    sys.modules[_PKG] = pkg
client_mod = importlib.import_module(_PKG + ".almond_loyalty_client")
policy = importlib.import_module(_PKG + ".almond_loyalty_policy")

_MOCK_DIR = str(ADDON / "mock")
if _MOCK_DIR not in sys.path:
    sys.path.insert(0, _MOCK_DIR)
import almond_bff_mock  # noqa: E402

KEY = "k3y-SUPER-secret-0123456789"


class MockServerCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = almond_bff_mock.make_server(port=0, pos_key=KEY)
        cls.base = "http://127.0.0.1:%d" % cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        # The mock is on 127.0.0.1; never route it through an env proxy.
        cls.http = requests.Session()
        cls.http.trust_env = False

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.server.state.delay = 0.0
        self.server.state.fail_next = None

    def client(self, key=KEY, timeout=2.0):
        return client_mod.AlmondLoyaltyClient(self.base, key, timeout=timeout, session=self.http)

    def mint(self, member="m1", mode="pay", **extra):
        body = {"memberId": member, "mode": mode}
        body.update(extra)
        return self.http.post(self.base + "/__mock/token", json=body, timeout=5).json()


class TestScan(MockServerCase):
    def test_scan_pay_member_earns(self):
        token = self.mint("m-pay", "pay")["token"]
        res = self.client().scan(token)
        self.assertEqual(res.member_id, "m-pay")
        self.assertEqual(res.mode, "pay")
        self.assertTrue(res.earns_points)
        self.assertTrue(res.earn_ticket)
        self.assertIsNone(res.corporate)
        self.assertIsNone(res.redemption)

    def test_scan_corporate_member_earns_nothing(self):
        token = self.mint("m-corp", "corporate", percentOff=15)["token"]
        res = self.client().scan(token)
        self.assertFalse(res.earns_points)
        self.assertIsNone(res.earn_ticket)
        self.assertEqual(res.corporate["percentOff"], 15)

    def test_scan_redeem_carries_redemption(self):
        minted = self.mint("m-red", "redeem", redemptionValueJod=2.5)
        res = self.client().scan(minted["token"])
        self.assertEqual(res.mode, "redeem")
        self.assertEqual(res.redemption["valueJod"], 2.5)
        self.assertEqual(res.redemption["code"], minted["code"])

    def test_token_is_single_use(self):
        token = self.mint("m-once")["token"]
        self.client().scan(token)
        with self.assertRaises(client_mod.ConflictError) as ctx:
            self.client().scan(token)
        self.assertEqual(ctx.exception.status, 409)

    def test_expired_token_is_401_but_not_key_rejected(self):
        token = self.mint("m-old", ttl=-1)["token"]
        with self.assertRaises(client_mod.AuthError) as ctx:
            self.client().scan(token)
        self.assertFalse(ctx.exception.key_rejected)


class TestErrors(MockServerCase):
    def test_bad_key_is_auth_error_key_rejected(self):
        token = self.mint()["token"]
        with self.assertRaises(client_mod.AuthError) as ctx:
            self.client(key="wrong-key").scan(token)
        self.assertEqual(ctx.exception.status, 401)
        self.assertTrue(ctx.exception.key_rejected)
        self.assertEqual(policy.decide(ctx.exception, attempts=1), policy.RETRY)

    def test_timeout_is_unavailable_and_retryable(self):
        self.server.state.delay = 1.0
        with self.assertRaises(client_mod.UnavailableError) as ctx:
            self.client(timeout=0.2).reverse_earn("REF-timeout", "refund")
        self.assertTrue(ctx.exception.retryable)
        self.assertEqual(policy.decide(ctx.exception, attempts=1), policy.RETRY)

    def test_connection_refused_is_unavailable(self):
        dead = client_mod.AlmondLoyaltyClient("http://127.0.0.1:9", KEY, timeout=0.5, session=self.http)
        with self.assertRaises(client_mod.UnavailableError):
            dead.reverse_earn("REF-x", "refund")

    def test_5xx_is_unavailable(self):
        self.server.state.fail_next = 503
        with self.assertRaises(client_mod.UnavailableError) as ctx:
            self.client().reverse_earn("REF-5xx", "refund")
        self.assertEqual(ctx.exception.status, 503)

    def test_https_required_for_remote_hosts(self):
        with self.assertRaises(client_mod.ConfigError):
            client_mod.AlmondLoyaltyClient("http://api.example.com", KEY)
        with self.assertRaises(client_mod.ConfigError):
            client_mod.AlmondLoyaltyClient("https://api.example.com", "")
        # https remote and http localhost are fine
        client_mod.AlmondLoyaltyClient("https://api.example.com", KEY)
        client_mod.AlmondLoyaltyClient("http://localhost:8898", KEY)


class TestEarnReverse(MockServerCase):
    def _ticket(self, member):
        return self.client().scan(self.mint(member)["token"]).earn_ticket

    def test_earn_success_and_idempotent_replay(self):
        ticket = self._ticket("m-earn")
        first = self.client().earn(ticket, "Shop/0001", "mecca-st", 4.5, "2026-09-23T10:00:00Z")
        self.assertEqual(first.points_earned, 45.0)
        self.assertFalse(first.replay)
        again = self.client().earn(ticket, "Shop/0001", "mecca-st", 4.5)
        self.assertTrue(again.replay)
        self.assertEqual(again.points_earned, 45.0)

    def test_409_is_not_retried(self):
        ticket = self._ticket("m-409")
        self.client().earn(ticket, "Shop/0409", "mecca-st", 3.0)
        before = self.server.state.requests.get("/v1/pos/earn", 0)
        with self.assertRaises(client_mod.ConflictError) as ctx:
            self.client().earn(ticket, "Shop/0409", "mecca-st", 9.0)  # same ref, other amount
        after = self.server.state.requests.get("/v1/pos/earn", 0)
        self.assertEqual(after - before, 1, "client must not retry on its own")
        self.assertEqual(policy.decide(ctx.exception, attempts=1), policy.FAIL)

    def test_reverse(self):
        ticket = self._ticket("m-rev")
        self.client().earn(ticket, "Shop/0777", "khalda", 2.0)
        res = self.client().reverse_earn("Shop/0777", "refund Shop/0778")
        self.assertEqual(res.reversed_points, 20.0)
        self.assertEqual(res.shortfall, 0.0)
        with self.assertRaises(client_mod.NotFoundError) as ctx:
            self.client().reverse_earn("Shop/never", "refund")
        self.assertEqual(policy.decide(ctx.exception, attempts=1), policy.FAIL)


class TestSettle(MockServerCase):
    def test_settle_by_code_once(self):
        code = self.mint("m-code", "redeem", redemptionValueJod=1.75)["code"]
        res = self.client().settle_redemption(code=" " + code.lower() + " ")
        self.assertEqual(res.value_jod, 1.75)
        with self.assertRaises(client_mod.NotFoundError):
            self.client().settle_redemption(code=code)

    def test_settle_by_redeem_token(self):
        self.mint("m-tok", "redeem", redemptionValueJod=3.0)
        token = self.mint("m-tok", "redeem")["token"]
        res = self.client().settle_redemption(token=token)
        self.assertEqual(res.value_jod, 3.0)

    def test_settle_needs_exactly_one(self):
        with self.assertRaises(client_mod.BadRequestError):
            self.client().settle_redemption()
        with self.assertRaises(client_mod.BadRequestError):
            self.client().settle_redemption(token="a", code="b")


class TestSecretsNeverLogged(MockServerCase):
    def test_key_and_member_values_absent_from_logs_errors_and_repr(self):
        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        handler.setLevel(logging.DEBUG)
        root = logging.getLogger()
        old_level = root.level
        root.addHandler(handler)
        root.setLevel(logging.DEBUG)  # includes urllib3 debug lines
        errors = []
        try:
            minted = self.mint("m-log", "redeem", redemptionValueJod=1.0)
            token, code = minted["token"], minted["code"]
            res = self.client().scan(token)
            ticket = res.earn_ticket
            self.client().earn(ticket, "Shop/LOG1", "mecca-st", 1.0)
            calls = (
                (0.0, lambda: self.client().scan(token)),                   # 409 replay
                (0.0, lambda: self.client().settle_redemption(code=code)),  # ok
                (0.0, lambda: self.client().settle_redemption(code=code)),  # 404
                (0.6, lambda: self.client(timeout=0.2).earn(ticket, "Shop/LOG2", "b", 1.0)),  # timeout
            )
            for delay, call in calls:
                self.server.state.delay = delay
                try:
                    call()
                except client_mod.AlmondLoyaltyError as exc:
                    errors.append(exc)
                finally:
                    self.server.state.delay = 0.0
            try:
                client_mod.AlmondLoyaltyClient(self.base, "wrong-" + KEY, session=self.http).scan("x.y")
            except client_mod.AlmondLoyaltyError as exc:
                errors.append(exc)
        finally:
            root.removeHandler(handler)
            root.setLevel(old_level)
        self.assertGreaterEqual(len(errors), 3)
        blob = stream.getvalue() + "\n".join(
            "%s %r %s %s" % (e, e, e.api_code, e.api_message) for e in errors
        )
        blob += repr(self.client()) + str(self.client()) + repr(res)
        self.assertIn("/v1/pos/scan", blob)  # we did log something
        for secret in (KEY, token, code, ticket):
            self.assertNotIn(secret, blob)


class TestPolicy(unittest.TestCase):
    def test_backoff_doubles_and_caps(self):
        self.assertEqual(policy.backoff_seconds(1), 60)
        self.assertEqual(policy.backoff_seconds(2), 120)
        self.assertEqual(policy.backoff_seconds(5), 960)
        self.assertEqual(policy.backoff_seconds(50), policy.DEFAULT_MAX_DELAY)

    def test_decide(self):
        E = client_mod
        self.assertEqual(policy.decide(E.ConflictError("x", 409), 1), policy.FAIL)
        self.assertEqual(policy.decide(E.BadRequestError("x", 400), 1), policy.FAIL)
        self.assertEqual(policy.decide(E.NotFoundError("x", 404), 1), policy.FAIL)
        self.assertEqual(policy.decide(E.UnavailableError("x"), 1), policy.RETRY)
        self.assertEqual(policy.decide(E.AuthError("x", 401), 1), policy.RETRY)
        self.assertEqual(policy.decide(E.ConfigError("x"), 1), policy.RETRY)
        self.assertEqual(policy.decide(E.UnavailableError("x"), policy.DEFAULT_MAX_ATTEMPTS), policy.FAIL)

    def test_paid_total_excludes_redemption_and_nets_change(self):
        # 5.000 cash tendered, 0.750 change (negative line), 2.000 via Almond redemption
        self.assertEqual(policy.paid_total([(5.0, False), (-0.75, False), (2.0, True)]), 4.25)
        self.assertEqual(policy.paid_total([(2.0, True)]), 0.0)
        self.assertEqual(policy.paid_total([]), 0.0)

    def test_redemption_mismatch(self):
        self.assertFalse(policy.redemption_mismatch(2.0, 2.0))
        self.assertFalse(policy.redemption_mismatch(1.5, 2.0))   # capped at the bill: fine
        self.assertTrue(policy.redemption_mismatch(2.5, 2.0))    # charged more than settled
        self.assertTrue(policy.redemption_mismatch(1.0, 0.0))    # method used, nothing settled

    def test_normalize_code(self):
        self.assertEqual(client_mod.normalize_redemption_code(" ab2c-d3ef "), "AB2C-D3EF")
        self.assertEqual(client_mod.normalize_redemption_code("ab2c d3ef"), "AB2CD3EF")


if __name__ == "__main__":
    unittest.main()
