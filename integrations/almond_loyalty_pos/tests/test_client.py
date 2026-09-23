# -*- coding: utf-8 -*-
"""
Plain-``unittest`` tests for the Odoo-free parts of almond_loyalty_pos:
the HTTP client (against the stdlib mock BFF, which mirrors
bff/src/routes/pos.ts) and the outbox/money policy.

    python3 -m unittest discover integrations/almond_loyalty_pos/tests -v

No Odoo needed. These are NOT Odoo tests: there is deliberately no
``tests/__init__.py`` so Odoo's test loader never picks this file up (it
expects odoo.tests cases). Odoo-side tests are a TODO — see README.
"""
import importlib
import io
import logging
import sys
import threading
import types
import unittest
from datetime import datetime, timedelta, timezone
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
C = importlib.import_module(_PKG + ".almond_loyalty_client")
policy = importlib.import_module(_PKG + ".almond_loyalty_policy")

_MOCK_DIR = str(ADDON / "mock")
if _MOCK_DIR not in sys.path:
    sys.path.insert(0, _MOCK_DIR)
import almond_bff_mock  # noqa: E402

KEY = "k3y-SUPER-secret-0123456789"
HOUR = 3600


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def now_iso(offset_seconds=0):
    return iso(datetime.now(timezone.utc) + timedelta(seconds=offset_seconds))


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
        return C.AlmondLoyaltyClient(self.base, key, timeout=timeout, session=self.http)

    def mint(self, member="m1", mode="pay", **extra):
        body = {"memberId": member, "mode": mode}
        body.update(extra)
        return self.http.post(self.base + "/__mock/token", json=body, timeout=5).json()

    def ticket(self, member):
        return self.client().scan(self.mint(member)["token"]).earn_ticket

    def age_ticket(self, ticket, seconds):
        self.http.post(self.base + "/__mock/age_ticket", json={"earnTicket": ticket, "seconds": seconds}, timeout=5)

    def requests_to(self, path):
        return self.server.state.requests.get(path, 0)

    def assertOutcome(self, exc, decision, kind):
        self.assertEqual(policy.classify(exc, attempts=1), (decision, kind))


# --------------------------------------------------------------------------- scan
class TestScan(MockServerCase):
    def test_pay_member_gets_ticket_with_lifetime(self):
        res = self.client().scan(self.mint("m-pay", "pay")["token"])
        self.assertEqual((res.member_id, res.mode, res.earns_points), ("m-pay", "pay", True))
        self.assertTrue(res.earn_ticket)
        self.assertEqual(res.earn_ticket_expires_in, 7 * 24 * HOUR)

    def test_corporate_member_no_ticket(self):
        res = self.client().scan(self.mint("m-corp", "corporate", percentOff=15)["token"])
        self.assertFalse(res.earns_points)
        self.assertIsNone(res.earn_ticket)
        self.assertIsNone(res.earn_ticket_expires_in)
        self.assertEqual(res.corporate["percentOff"], 15)

    def test_corporate_member_showing_pay_qr_still_no_ticket(self):
        self.mint("m-corp2", "corporate", percentOff=10)
        res = self.client().scan(self.mint("m-corp2", "pay")["token"])
        self.assertIsNone(res.earn_ticket)

    def test_redeem_scan_has_redemption_but_never_a_ticket(self):
        minted = self.mint("m-red", "redeem", redemptionValueJod=2.5)
        res = self.client().scan(minted["token"])
        self.assertEqual(res.mode, "redeem")
        self.assertTrue(res.earns_points)          # the member earns...
        self.assertIsNone(res.earn_ticket)         # ...but only through a pay-mode scan
        self.assertEqual(res.redemption["valueJod"], 2.5)
        self.assertEqual(res.redemption["code"], minted["code"])

    def test_token_replay_409(self):
        token = self.mint("m-once")["token"]
        self.client().scan(token)
        with self.assertRaises(C.TokenReplayError) as ctx:
            self.client().scan(token)
        self.assertEqual((ctx.exception.status, ctx.exception.api_code), (409, "pos_token_replay"))

    def test_token_expired_401(self):
        with self.assertRaises(C.TokenExpiredError) as ctx:
            self.client().scan(self.mint("m-old", ttl=-1)["token"])
        self.assertEqual(ctx.exception.status, 401)

    def test_token_invalid_401(self):
        for bad in ("not-a-token", "aaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbb"):
            with self.assertRaises(C.TokenInvalidError):
                self.client().scan(bad)


# --------------------------------------------------------------------------- errors / transport
class TestErrors(MockServerCase):
    def test_pos_key_invalid_on_every_route_is_config_failure(self):
        bad = self.client(key="wrong-key")
        calls = (
            lambda: bad.scan(self.mint()["token"]),
            lambda: bad.earn("t", "Shop/K", "mecca-st", 1.0, now_iso()),
            lambda: bad.reverse_earn("Shop/K", "refund"),
            lambda: bad.settle_redemption(code="AAAA-BBBB"),
        )
        for call in calls:
            with self.assertRaises(C.PosKeyInvalidError) as ctx:
                call()
            self.assertEqual((ctx.exception.status, ctx.exception.api_code), (401, "pos_key_invalid"))
            self.assertOutcome(ctx.exception, policy.FAIL, policy.KIND_CONFIG)

    def test_rate_limited_429_retries(self):
        self.server.state.fail_next = 429
        with self.assertRaises(C.RateLimitedError) as ctx:
            self.client().settle_redemption(code="AAAA-BBBB")
        self.assertEqual((ctx.exception.status, ctx.exception.api_code), (429, "rate_limited"))
        self.assertOutcome(ctx.exception, policy.RETRY, None)

    def test_timeout_is_unavailable_and_retryable(self):
        self.server.state.delay = 1.0
        with self.assertRaises(C.UnavailableError) as ctx:
            self.client(timeout=0.2).reverse_earn("REF-timeout", "refund")
        self.assertOutcome(ctx.exception, policy.RETRY, None)

    def test_connection_refused_is_unavailable(self):
        dead = C.AlmondLoyaltyClient("http://127.0.0.1:9", KEY, timeout=0.5, session=self.http)
        with self.assertRaises(C.UnavailableError):
            dead.reverse_earn("REF-x", "refund")

    def test_5xx_is_unavailable(self):
        self.server.state.fail_next = 503
        with self.assertRaises(C.UnavailableError) as ctx:
            self.client().reverse_earn("REF-5xx", "refund")
        self.assertEqual(ctx.exception.status, 503)
        self.assertOutcome(ctx.exception, policy.RETRY, None)

    def test_unknown_codes_fall_back_to_status(self):
        err = C.AlmondLoyaltyClient._error_for("/x", 401, {"error": "something_new", "message": "m"})
        self.assertIs(type(err), C.AuthError)
        self.assertOutcome(err, policy.FAIL, policy.KIND_CONFIG)
        err = C.AlmondLoyaltyClient._error_for("/x", 409, {"error": "brand_new_409"})
        self.assertIs(type(err), C.ConflictError)
        self.assertOutcome(err, policy.FAIL, policy.KIND_CONFLICT)
        err = C.AlmondLoyaltyClient._error_for("/x", 429, None)
        self.assertIsInstance(err, C.RateLimitedError)

    def test_https_required_for_remote_hosts(self):
        with self.assertRaises(C.ConfigError):
            C.AlmondLoyaltyClient("http://api.example.com", KEY)
        with self.assertRaises(C.ConfigError):
            C.AlmondLoyaltyClient("https://api.example.com", "")
        C.AlmondLoyaltyClient("https://api.example.com", KEY)
        C.AlmondLoyaltyClient("http://localhost:8898", KEY)
        self.assertOutcome(C.ConfigError("x"), policy.FAIL, policy.KIND_CONFIG)


# --------------------------------------------------------------------------- earn / reverse
class TestEarn(MockServerCase):
    def test_grant_201_then_replay_200_is_success(self):
        t = self.ticket("m-earn")
        first = self.client().earn(t, "Shop/0001", "mecca-st", 4.5, now_iso())
        self.assertEqual((first.points_earned, first.replay), (45.0, False))
        again = self.client().earn(t, "Shop/0001", "mecca-st", 4.5, now_iso())
        self.assertEqual((again.points_earned, again.replay), (45.0, True))

    def test_paid_at_is_always_sent_with_an_offset(self):
        t = self.ticket("m-paidat")
        amman_now = datetime.now(timezone(timedelta(hours=3))).isoformat(timespec="seconds")
        self.client().earn(t, "Shop/PA1", "mecca-st", 1.0, amman_now)
        sent = self.server.state.last_body["/v1/pos/earn"]["paidAt"]
        self.assertTrue(C.is_iso_with_offset(sent))
        self.assertTrue(sent.endswith("+03:00"))

    def test_naive_or_missing_paid_at_refused_before_sending(self):
        t = self.ticket("m-naive")
        before = self.requests_to("/v1/pos/earn")
        for bad in ("2026-09-23T10:15:00", "", None, "2026-09-23 10:15:00Z"):
            with self.assertRaises(C.ClientValidationError):
                self.client().earn(t, "Shop/N1", "mecca-st", 1.0, bad)
        self.assertEqual(self.requests_to("/v1/pos/earn"), before, "must not reach the API")
        self.assertOutcome(C.ClientValidationError("x"), policy.FAIL, policy.KIND_REJECTED)

    def test_client_limits(self):
        t = self.ticket("m-lim")
        for args in ((t, "R" * 65, "b", 1.0), (t, "Shop/L", "B" * 65, 1.0), (t, "Shop/L", "b", -1),
                     (t, "Shop/L", "b", 100001), ("x" * 1025, "Shop/L", "b", 1.0)):
            with self.assertRaises(C.ClientValidationError):
                self.client().earn(*args, paid_at=now_iso())

    def test_pos_order_conflict_is_not_retried(self):
        t = self.ticket("m-409")
        self.client().earn(t, "Shop/0409", "mecca-st", 3.0, now_iso())
        for kw in ({"paid_total": 9.0, "branch_id": "mecca-st"}, {"paid_total": 3.0, "branch_id": "khalda"}):
            before = self.requests_to("/v1/pos/earn")
            with self.assertRaises(C.PosOrderConflictError) as ctx:
                self.client().earn(t, "Shop/0409", paid_at=now_iso(), **kw)
            self.assertEqual(self.requests_to("/v1/pos/earn") - before, 1, "client must not retry on its own")
            self.assertEqual(ctx.exception.status, 409)
            self.assertOutcome(ctx.exception, policy.FAIL, policy.KIND_CONFLICT)

    def test_ticket_used_on_another_ref(self):
        t = self.ticket("m-used")
        self.client().earn(t, "Shop/U1", "mecca-st", 1.0, now_iso())
        with self.assertRaises(C.TicketUsedError) as ctx:
            self.client().earn(t, "Shop/U2", "mecca-st", 1.0, now_iso())
        self.assertEqual(ctx.exception.status, 409)
        self.assertOutcome(ctx.exception, policy.FAIL, policy.KIND_TICKET)

    def test_ticket_invalid(self):
        with self.assertRaises(C.TicketInvalidError) as ctx:
            self.client().earn("forged.ticket", "Shop/I1", "mecca-st", 1.0, now_iso())
        self.assertEqual(ctx.exception.status, 401)
        self.assertOutcome(ctx.exception, policy.FAIL, policy.KIND_TICKET)

    def test_ticket_expired_on_new_sale_but_replay_still_succeeds(self):
        t = self.ticket("m-exp")
        self.client().earn(t, "Shop/E1", "mecca-st", 2.0, now_iso())
        self.age_ticket(t, 8 * 24 * HOUR)   # scanned 8 days ago -> ticket past its 7 days
        paid = now_iso(-8 * 24 * HOUR)       # the sale was paid at scan time
        replay = self.client().earn(t, "Shop/E1", "mecca-st", 2.0, paid)
        self.assertTrue(replay.replay)
        t2 = self.ticket("m-exp2")
        self.age_ticket(t2, 8 * 24 * HOUR)
        with self.assertRaises(C.TicketExpiredError) as ctx:
            self.client().earn(t2, "Shop/E2", "mecca-st", 2.0, now_iso(-8 * 24 * HOUR))
        self.assertEqual(ctx.exception.status, 401)
        self.assertOutcome(ctx.exception, policy.FAIL, policy.KIND_TICKET)

    def test_sale_window(self):
        # scanned 7 h ago: paid now is > scan + 6 h
        t = self.ticket("m-win")
        self.age_ticket(t, 7 * HOUR)
        with self.assertRaises(C.PaidAtOutsideWindowError) as ctx:
            self.client().earn(t, "Shop/W1", "mecca-st", 1.0, now_iso())
        self.assertEqual((ctx.exception.status, ctx.exception.api_code), (400, "paid_at_outside_ticket_window"))
        self.assertOutcome(ctx.exception, policy.FAIL, policy.KIND_WINDOW)
        # ...but the same late DELIVERY with the real payment time (5 h after scan) is fine
        ok = self.client().earn(t, "Shop/W1", "mecca-st", 1.0, now_iso(-2 * HOUR))
        self.assertFalse(ok.replay)
        # paid 31 min before the scan: refused; 29 min before: fine
        t2 = self.ticket("m-win2")
        with self.assertRaises(C.PaidAtOutsideWindowError):
            self.client().earn(t2, "Shop/W2", "mecca-st", 1.0, now_iso(-31 * 60))
        self.client().earn(t2, "Shop/W2", "mecca-st", 1.0, now_iso(-29 * 60))

    def test_paid_at_in_future_is_400_validation(self):
        t = self.ticket("m-fut")
        with self.assertRaises(C.BadRequestError) as ctx:
            self.client().earn(t, "Shop/F1", "mecca-st", 1.0, now_iso(HOUR))
        self.assertEqual(ctx.exception.api_code, "bad_request")
        self.assertNotIsInstance(ctx.exception, C.PaidAtOutsideWindowError)
        self.assertOutcome(ctx.exception, policy.FAIL, policy.KIND_REJECTED)


class TestReverse(MockServerCase):
    def test_reverse_201_then_replay_200_and_earn_replay_after_reversal(self):
        t = self.ticket("m-rev")
        self.client().earn(t, "Shop/0777", "khalda", 2.0, now_iso())
        first = self.client().reverse_earn("Shop/0777", "refund Shop/0778")
        self.assertEqual((first.reversed_points, first.shortfall, first.replay), (20.0, 0.0, False))
        self.assertEqual(first.points_balance, 0.0)
        again = self.client().reverse_earn("Shop/0777", "refund Shop/0778")
        self.assertTrue(again.replay)
        self.assertEqual(again.reversed_points, 20.0)
        # an outbox retry of the ORIGINAL earn after the reversal is still a replay (success)
        self.assertTrue(self.client().earn(t, "Shop/0777", "khalda", 2.0, now_iso()).replay)

    def test_reverse_unknown_ref_404_fails(self):
        with self.assertRaises(C.NotFoundError) as ctx:
            self.client().reverse_earn("Shop/never", "refund")
        self.assertOutcome(ctx.exception, policy.FAIL, policy.KIND_REJECTED)

    def test_reason_trimmed_to_200(self):
        t = self.ticket("m-reason")
        self.client().earn(t, "Shop/RS", "khalda", 1.0, now_iso())
        self.client().reverse_earn("Shop/RS", "x" * 500)
        self.assertEqual(len(self.server.state.last_body["/v1/pos/earn/reverse"]["reason"]), 200)


# --------------------------------------------------------------------------- settle
class TestSettle(MockServerCase):
    def test_settle_by_code_once(self):
        code = self.mint("m-code", "redeem", redemptionValueJod=1.75)["code"]
        res = self.client().settle_redemption(code=" " + code.lower() + " ")
        self.assertEqual(res.value_jod, 1.75)
        with self.assertRaises(C.NotFoundError):
            self.client().settle_redemption(code=code)

    def test_settle_by_redeem_token(self):
        self.mint("m-tok", "redeem", redemptionValueJod=3.0)
        res = self.client().settle_redemption(token=self.mint("m-tok", "redeem")["token"])
        self.assertEqual(res.value_jod, 3.0)

    def test_scanned_redeem_token_cannot_settle_again(self):
        minted = self.mint("m-scan-then-settle", "redeem", redemptionValueJod=1.0)
        self.client().scan(minted["token"])
        with self.assertRaises(C.TokenReplayError):
            self.client().settle_redemption(token=minted["token"])

    def test_settle_needs_exactly_one(self):
        with self.assertRaises(C.ClientValidationError):
            self.client().settle_redemption()
        with self.assertRaises(C.ClientValidationError):
            self.client().settle_redemption(token="a", code="b")


# --------------------------------------------------------------------------- secrets
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
            res = self.client().scan(self.mint("m-log", "pay")["token"])
            ticket = res.earn_ticket
            self.client().earn(ticket, "Shop/LOG1", "mecca-st", 1.0, now_iso())
            calls = (
                (0.0, lambda: self.client().scan(token)),                   # ok (redeem)
                (0.0, lambda: self.client().scan(token)),                   # 409 replay
                (0.0, lambda: self.client().settle_redemption(code=code)),  # ok
                (0.0, lambda: self.client().settle_redemption(code=code)),  # 404
                (0.0, lambda: self.client().earn(ticket, "Shop/LOG3", "b", 1.0, now_iso())),  # ticket_used
                (0.6, lambda: self.client(timeout=0.2).earn(ticket, "Shop/LOG2", "b", 1.0, now_iso())),
            )
            for delay, call in calls:
                self.server.state.delay = delay
                try:
                    call()
                except C.AlmondLoyaltyError as exc:
                    errors.append(exc)
                finally:
                    self.server.state.delay = 0.0
            try:
                C.AlmondLoyaltyClient(self.base, "wrong-" + KEY, session=self.http).scan("x.y")
            except C.AlmondLoyaltyError as exc:
                errors.append(exc)
        finally:
            root.removeHandler(handler)
            root.setLevel(old_level)
        self.assertGreaterEqual(len(errors), 4)
        blob = stream.getvalue() + "\n".join(
            "%s %r %s %s" % (e, e, e.api_code, e.api_message) for e in errors
        )
        blob += repr(self.client()) + str(self.client()) + repr(res)
        self.assertIn("/v1/pos/scan", blob)  # we did log something
        for secret in (KEY, token, code, ticket):
            self.assertNotIn(secret, blob)


# --------------------------------------------------------------------------- policy
class TestPolicy(unittest.TestCase):
    def test_backoff_doubles_and_caps(self):
        self.assertEqual(policy.backoff_seconds(1), 60)
        self.assertEqual(policy.backoff_seconds(2), 120)
        self.assertEqual(policy.backoff_seconds(5), 960)
        self.assertEqual(policy.backoff_seconds(50), policy.DEFAULT_MAX_DELAY)

    def test_classify_every_code(self):
        F, R = policy.FAIL, policy.RETRY
        table = [
            (C.PosKeyInvalidError, (F, policy.KIND_CONFIG)),
            (C.ConfigError, (F, policy.KIND_CONFIG)),
            (C.AuthError, (F, policy.KIND_CONFIG)),
            (C.TokenInvalidError, (F, policy.KIND_TICKET)),
            (C.TokenExpiredError, (F, policy.KIND_TICKET)),
            (C.TokenReplayError, (F, policy.KIND_TICKET)),
            (C.TicketInvalidError, (F, policy.KIND_TICKET)),
            (C.TicketExpiredError, (F, policy.KIND_TICKET)),
            (C.TicketUsedError, (F, policy.KIND_TICKET)),
            (C.PosOrderConflictError, (F, policy.KIND_CONFLICT)),
            (C.ConflictError, (F, policy.KIND_CONFLICT)),
            (C.PaidAtOutsideWindowError, (F, policy.KIND_WINDOW)),
            (C.BadRequestError, (F, policy.KIND_REJECTED)),
            (C.NotFoundError, (F, policy.KIND_REJECTED)),
            (C.ClientValidationError, (F, policy.KIND_REJECTED)),
            (C.RateLimitedError, (R, None)),
            (C.UnavailableError, (R, None)),
            (C.ProtocolError, (R, None)),
        ]
        for cls, expected in table:
            self.assertEqual(tuple(policy.classify(cls("x"), 1)), expected, cls.__name__)
        self.assertEqual(policy.classify(RuntimeError("boom"), 1), (R, None))
        self.assertEqual(policy.classify(C.RateLimitedError("x"), policy.DEFAULT_MAX_ATTEMPTS),
                         (F, policy.KIND_EXHAUSTED))
        self.assertEqual(policy.decide(C.PosOrderConflictError("x"), 1), F)

    def test_every_machine_code_is_mapped(self):
        codes = {"pos_key_invalid", "token_invalid", "token_expired", "pos_token_replay", "ticket_invalid",
                 "ticket_expired", "ticket_used", "pos_order_conflict", "paid_at_outside_ticket_window",
                 "rate_limited"}
        status = {"pos_key_invalid": 401, "token_invalid": 401, "token_expired": 401, "pos_token_replay": 409,
                  "ticket_invalid": 401, "ticket_expired": 401, "ticket_used": 409, "pos_order_conflict": 409,
                  "paid_at_outside_ticket_window": 400, "rate_limited": 429}
        for code in codes:
            err = C.AlmondLoyaltyClient._error_for("/x", status[code], {"error": code, "message": "m"})
            self.assertEqual(err.code, code)
            self.assertEqual(err.api_code, code)

    def test_paid_total_excludes_redemption_and_nets_change(self):
        self.assertEqual(policy.paid_total([(5.0, False), (-0.75, False), (2.0, True)]), 4.25)
        self.assertEqual(policy.paid_total([(2.0, True)]), 0.0)
        self.assertEqual(policy.paid_total([]), 0.0)

    def test_redemption_mismatch(self):
        self.assertFalse(policy.redemption_mismatch(2.0, 2.0))
        self.assertFalse(policy.redemption_mismatch(1.5, 2.0))
        self.assertTrue(policy.redemption_mismatch(2.5, 2.0))
        self.assertTrue(policy.redemption_mismatch(1.0, 0.0))

    def test_paid_at_is_payment_time_with_explicit_offset(self):
        created = datetime(2026, 9, 23, 7, 0, 0)       # naive UTC, as Odoo stores it
        validated = datetime(2026, 9, 23, 7, 12, 5)
        wizard_payment = datetime(2026, 9, 23, 9, 30, 0)
        self.assertEqual(policy.payment_time(validated, [datetime(2026, 9, 23, 7, 11)]), validated)
        self.assertEqual(policy.payment_time(created, [wizard_payment]), wizard_payment)
        self.assertEqual(policy.payment_time(created, []), created)
        self.assertIsNone(policy.payment_time(None, []))
        self.assertEqual(policy.iso_utc(validated), "2026-09-23T07:12:05Z")
        amman = datetime(2026, 9, 23, 10, 12, 5, tzinfo=timezone(timedelta(hours=3)))
        self.assertEqual(policy.iso_utc(amman), "2026-09-23T07:12:05Z")
        self.assertTrue(C.is_iso_with_offset(policy.iso_utc(validated)))
        self.assertIsNone(policy.iso_utc(None))

    def test_iso_offset_check(self):
        for ok in ("2026-09-23T07:12:05Z", "2026-09-23T10:12:05+03:00", "2026-09-23T07:12:05.123Z"):
            self.assertTrue(C.is_iso_with_offset(ok), ok)
        for bad in ("2026-09-23T07:12:05", "2026-09-23 07:12:05Z", "2026-09-23", "", None, 5):
            self.assertFalse(C.is_iso_with_offset(bad), bad)

    def test_normalize_code(self):
        self.assertEqual(C.normalize_redemption_code(" ab2c-d3ef "), "AB2C-D3EF")
        self.assertEqual(C.normalize_redemption_code("ab2c d3ef"), "AB2CD3EF")


if __name__ == "__main__":
    unittest.main()
