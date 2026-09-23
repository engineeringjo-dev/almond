# -*- coding: utf-8 -*-
"""
The only doors the POS browser has to the Almond API.

The browser NEVER sees the x-pos-key, the API URL, the member's earn ticket
or a redemption code read from a scan. It posts here (logged-in POS user,
open session); Odoo calls the API server-to-server and answers with display
data only. Every route answers ``{"ok": true, ...}`` or
``{"ok": false, "error": <code>, "message": <translated text>}`` and never
raises for an API problem, so the till can always carry on selling.

Route type ``jsonrpc``: in 19.0 ``type='json'`` is a deprecated alias
(``odoo/http.py``: "Since 19.0, @route(type='json') is a deprecated alias to
@route(type='jsonrpc')"). The POS calls these with ``rpc()`` from
``@web/core/network/rpc``, which speaks JSON-RPC 2.
"""
import logging

from odoo import _, http
from odoo.http import request

from ..models.almond_loyalty_client import (
    AlmondLoyaltyError,
    AuthError,
    BadRequestError,
    ClientValidationError,
    ConfigError,
    NotFoundError,
    PosKeyInvalidError,
    RateLimitedError,
    TokenExpiredError,
    TokenInvalidError,
    TokenReplayError,
    UnavailableError,
)

_logger = logging.getLogger(__name__)

MAX_TOKEN_LEN = 4096   # a member QR token is ~150 chars; refuse junk early
MAX_CODE_LEN = 32
MAX_UUID_LEN = 64     # pos.order.uuid is a uuid4 string (36 chars)


class AlmondLoyaltyController(http.Controller):

    # ------------------------------------------------------------ helpers
    def _almond_session(self, session_id):
        """The caller must be a POS user with an OPEN session they can see.
        Searched WITHOUT sudo, so multi-company record rules apply."""
        if not request.env.user.has_group("point_of_sale.group_pos_user"):
            return None
        try:
            sid = int(session_id)
        except (TypeError, ValueError):
            return None
        return request.env["pos.session"].search(
            [("id", "=", sid), ("state", "in", ("opening_control", "opened"))], limit=1,
        )

    @staticmethod
    def _valid_uuid(order_uuid):
        return isinstance(order_uuid, str) and 0 < len(order_uuid) <= MAX_UUID_LEN

    def _fail(self, error, message):
        return {"ok": False, "error": error, "message": message}

    def _api_error(self, exc):
        """Map a typed client error (the BFF's machine code) to a short,
        cashier-facing answer — read at the counter, with a queue."""
        if isinstance(exc, (ConfigError, PosKeyInvalidError)):
            if isinstance(exc, PosKeyInvalidError):
                _logger.error("Almond loyalty: the API refused the POS key (pos_key_invalid) — check Settings")
            return self._fail("not_configured", _("Almond loyalty is not configured. Ask the manager."))
        if isinstance(exc, TokenExpiredError):
            return self._fail("qr_expired", _("This QR has expired. Ask the member to refresh it."))
        if isinstance(exc, TokenReplayError):
            return self._fail("qr_used", _("This QR was already used. Ask the member to refresh it."))
        if isinstance(exc, TokenInvalidError):
            return self._fail("invalid_qr", _("This is not a valid Almond QR."))
        if isinstance(exc, RateLimitedError):
            return self._fail("rate_limited", _("Too many attempts. Wait a minute and try again."))
        if isinstance(exc, AuthError):  # unknown 401 code: treat as configuration
            _logger.error("Almond loyalty: unexpected 401 %s", exc.api_code)
            return self._fail("not_configured", _("Almond loyalty is not configured. Ask the manager."))
        if isinstance(exc, NotFoundError):
            return self._fail("refused", _("Refused: the code is used, expired or unknown."))
        if isinstance(exc, (BadRequestError, ClientValidationError)):
            return self._fail("refused", exc.api_message or _("The Almond API refused this request."))
        if isinstance(exc, UnavailableError):
            return self._fail("unavailable", _("Almond is not reachable right now. Continue the sale without it."))
        return self._fail("error", _("Almond loyalty error."))

    def _client(self):
        return request.env["almond.loyalty.service"].sudo()._almond_loyalty_client()

    # ------------------------------------------------------------ routes
    @http.route("/almond_loyalty/scan", type="jsonrpc", auth="user", methods=["POST"])
    def scan(self, session_id=None, order_uuid=None, token=None, **kw):
        """Resolve a member QR and attach the member to the (draft) order.
        Returns display data only; the earn ticket stays on the server."""
        session = self._almond_session(session_id)
        if not session:
            return self._fail("no_session", _("Open a POS session first."))
        config = session.config_id
        if not config.almond_loyalty_enabled:
            return self._fail("disabled", _("Almond loyalty is not enabled on this point of sale."))
        token = (token or "").strip()
        if not self._valid_uuid(order_uuid) or not token or len(token) > MAX_TOKEN_LEN:
            return self._fail("invalid_qr", _("This QR is not valid or has expired. Ask the member to refresh it."))
        try:
            res = self._client().scan(token)
        except AlmondLoyaltyError as exc:
            return self._api_error(exc)

        Scan = request.env["almond.loyalty.scan"].sudo()
        # A redeem visit takes TWO scans of the same member: the redeem QR (no
        # earn ticket, by contract) and a pay QR for the cash part (the only
        # one that carries a ticket). So a new scan archives: every earlier scan
        # of ANOTHER member (member replaced), and earlier scans of the SAME
        # member with the same role (ticket-bearing / redeem).
        earlier = Scan.search([("order_uuid", "=", order_uuid)])
        earlier.filtered(lambda s: (
            s.member_id != res.member_id
            or (res.earn_ticket and s.earn_ticket)
            or (res.mode == "redeem" and s.mode == "redeem")
        )).write({"active": False})
        corporate = res.corporate or {}
        redemption = res.redemption or {}
        Scan.create({
            "order_uuid": order_uuid,
            "session_id": session.id,
            "config_id": config.id,
            "member_id": res.member_id,
            "mode": res.mode,
            "earns_points": res.earns_points,
            "earn_ticket": res.earn_ticket,
            "corporate_name": corporate.get("nameAr") or corporate.get("nameEn"),
            "corporate_percent": float(corporate.get("percentOff") or 0.0),
            "redemption_code": redemption.get("code"),
            "redemption_value": float(redemption.get("valueJod") or 0.0),
        })
        return {
            "ok": True,
            "mode": res.mode,
            # Enough to tell members apart on screen, not the whole id.
            "memberRef": res.member_id[-6:],
            "earnsPoints": bool(res.earns_points and res.earn_ticket),
            # Redeem-mode scans never carry an earn ticket: to earn on the cash
            # part the member must also show their pay QR.
            "needsPayScan": bool(res.mode == "redeem" and res.earns_points),
            "corporate": ({
                "nameAr": corporate.get("nameAr"),
                "nameEn": corporate.get("nameEn"),
                "percentOff": float(corporate.get("percentOff") or 0.0),
            } if res.corporate else None),
            "redemption": ({
                "valueJod": float(redemption.get("valueJod") or 0.0),
                "points": redemption.get("points"),
                "status": redemption.get("status"),
                "expiresIn": redemption.get("expiresIn"),
            } if res.redemption else None),
        }

    @http.route("/almond_loyalty/detach", type="jsonrpc", auth="user", methods=["POST"])
    def detach(self, session_id=None, order_uuid=None, **kw):
        """Cashier removed the member from the order: no earn will be sent."""
        session = self._almond_session(session_id)
        if not session or not self._valid_uuid(order_uuid):
            return self._fail("no_session", _("Open a POS session first."))
        request.env["almond.loyalty.scan"].sudo().search([
            ("order_uuid", "=", order_uuid), ("session_id", "=", session.id),
        ]).write({"active": False})
        return {"ok": True}

    @http.route("/almond_loyalty/settle", type="jsonrpc", auth="user", methods=["POST"])
    def settle(self, session_id=None, order_uuid=None, code=None, token=None, from_scan=False, **kw):
        """Settle (consume) a redemption ONCE, then the till adds a payment line
        for the returned value. Exactly one source:

        * ``from_scan``: the redemption carried by this order's latest
          ``redeem`` scan — settled with the code the SERVER kept. (The QR
          itself cannot be reused: /scan already spent the single-use token.)
        * ``code``: the 9-char code the member reads out (e.g. AB2C-D3EF).
        * ``token``: a redeem-mode QR that has NOT been scanned yet.
        """
        session = self._almond_session(session_id)
        if not session:
            return self._fail("no_session", _("Open a POS session first."))
        config = session.config_id
        if not config.almond_loyalty_enabled:
            return self._fail("disabled", _("Almond loyalty is not enabled on this point of sale."))
        if not self._valid_uuid(order_uuid):
            return self._fail("refused", _("No order."))
        sources = [bool(from_scan), bool(code), bool(token)]
        if sum(sources) != 1:
            return self._fail("refused", _("Scan the redemption QR or type the code."))

        member_id = None
        method = "code" if code else ("token" if token else "scan")
        try:
            client = self._client()
            if from_scan:
                scan = request.env["almond.loyalty.scan"].sudo().search([
                    ("order_uuid", "=", order_uuid), ("session_id", "=", session.id), ("mode", "=", "redeem"),
                ], limit=1)
                if not scan or not scan.redemption_code:
                    return self._fail("refused", _("No redemption on the scanned member."))
                member_id = scan.member_id
                res = client.settle_redemption(code=scan.redemption_code)
            elif code:
                code = str(code).strip()
                if len(code) > MAX_CODE_LEN:
                    return self._fail("refused", _("Refused: the code is used, expired or unknown."))
                res = client.settle_redemption(code=code)
            else:
                token = str(token).strip()
                if len(token) > MAX_TOKEN_LEN:
                    return self._fail("invalid_qr", _("This QR is not valid or has expired. Ask the member to refresh it."))
                res = client.settle_redemption(token=token)
        except AlmondLoyaltyError as exc:
            return self._api_error(exc)

        # The API has consumed the redemption: record it NOW, in this request,
        # whatever happens to the order afterwards (it is the audit trail for
        # a cancelled order too).
        request.env["almond.loyalty.redemption"].sudo().create({
            "order_uuid": order_uuid,
            "session_id": session.id,
            "config_id": config.id,
            "member_id": res.member_id or member_id,
            "code": res.code or (code and code.upper()) or False,
            "method": method,
            "value_jod": res.value_jod,
            "points": res.points or 0.0,
        })
        return {"ok": True, "valueJod": res.value_jod, "points": res.points}
