# -*- coding: utf-8 -*-
"""
Almond loyalty API client — till -> BFF, server-to-server.

DELIBERATELY FREE OF ODOO IMPORTS. Nothing here imports ``odoo``, so this file
is unit-tested on its own (``tests/test_client.py`` loads it by path and runs it
against ``mock/almond_bff_mock.py``). The Odoo side
(``almond_loyalty_service.py``) only builds an instance from
``ir.config_parameter`` and calls it.

The four calls (contract fixed by the BFF, ``bff/src/routes/pos.ts``):

    POST /v1/pos/scan                 {token}
    POST /v1/pos/earn                 {earnTicket, posOrderRef, branchId, paidTotal, paidAt?}
    POST /v1/pos/earn/reverse         {posOrderRef, reason}
    POST /v1/pos/redemption/settle    {token} | {code}

Every request carries ``x-pos-key``. That key is the till's credential:

* it is never logged, never put in an exception message, never in ``repr``;
* it is only sent over HTTPS (plain http is refused except to localhost, so the
  mock works) — a key in a header over plain http is a key given away;
* the member's QR token / redemption code / earn ticket are ALSO never logged
  (they are bearer values for that member).

No retries happen here. Scan/settle are interactive (the cashier retries), and
earn/reverse are retried by the Odoo outbox with backoff
(``almond_loyalty_policy.py``). A client that retried on its own would hide the
409 "same ref, different member/amount" answer behind a loop.
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from urllib.parse import urlsplit

import requests

_logger = logging.getLogger(__name__)

__all__ = [
    "AlmondLoyaltyClient",
    "AlmondLoyaltyError",
    "AuthError",
    "BadRequestError",
    "ConflictError",
    "NotFoundError",
    "UnavailableError",
    "ProtocolError",
    "ConfigError",
    "ScanResult",
    "EarnResult",
    "ReverseResult",
    "SettleResult",
    "SCAN_MODES",
]

SCAN_MODES = ("pay", "earn", "corporate", "redeem")
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
_MAX_API_MESSAGE = 200


# --------------------------------------------------------------------------- #
# Errors — typed so the caller decides retry vs. fail without parsing strings.
# --------------------------------------------------------------------------- #
class AlmondLoyaltyError(Exception):
    """Base error. ``status`` is the HTTP status (None for transport errors).

    ``api_code`` / ``api_message`` are the BFF's ``{error, message}`` body
    (truncated). The message never contains the POS key or any request body.
    """

    retryable = False

    def __init__(self, message, status=None, api_code=None, api_message=None):
        super().__init__(message)
        self.status = status
        self.api_code = api_code
        self.api_message = api_message


class ConfigError(AlmondLoyaltyError):
    """Client mis-configured (no URL, no key, insecure URL). Not retryable
    until an administrator fixes the settings."""


class AuthError(AlmondLoyaltyError):
    """401/403. On /scan and /settle the BFF ALSO answers 401 for a bad,
    expired or malformed member token (``bff/src/pos/token.ts``), so check
    :pyattr:`key_rejected` before telling the cashier "the key is wrong"."""

    @property
    def key_rejected(self):
        # CONTRACT GAP: the BFF distinguishes the two 401s only by message text
        # ('invalid pos key' vs 'pos token expired' / 'bad pos signature' ...).
        # Ask the BFF for a distinct `error` code; until then this is the test.
        return "pos key" in (self.api_message or "").lower()


class ConflictError(AlmondLoyaltyError):
    """409. On /earn: same posOrderRef already earned for a different member
    or amount — NEVER retry. On /scan: the QR was already used (replay)."""


class BadRequestError(AlmondLoyaltyError):
    """400/422 — the request is wrong; retrying the same body will not help."""


class NotFoundError(AlmondLoyaltyError):
    """404. On /settle the BFF gives the SAME answer for "no such code",
    "already settled", "expired" and "not this member" (by design)."""


class UnavailableError(AlmondLoyaltyError):
    """Timeout, connection failure, 5xx, 429. Retryable."""

    retryable = True


class ProtocolError(UnavailableError):
    """2xx with a body we cannot read. Retryable: earn/reverse are idempotent
    on posOrderRef, so re-sending is safe and re-reads the answer."""


# --------------------------------------------------------------------------- #
# Typed results
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class ScanResult:
    member_id: str
    mode: str
    earns_points: bool
    earn_ticket: Optional[str] = None
    redemption: Optional[Dict[str, Any]] = None
    corporate: Optional[Dict[str, Any]] = None
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)

    def __repr__(self):  # never print the earn ticket / redemption code
        return "ScanResult(member_id=%r, mode=%r, earns_points=%r, corporate=%r, redemption=%s)" % (
            self.member_id, self.mode, self.earns_points,
            bool(self.corporate), "yes" if self.redemption else "no",
        )


@dataclass(frozen=True)
class EarnResult:
    pos_order_ref: str
    points_earned: float
    points_balance: Optional[float]
    replay: bool
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)


@dataclass(frozen=True)
class ReverseResult:
    reversed_points: float
    shortfall: float
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)


@dataclass(frozen=True)
class SettleResult:
    value_jod: float
    points: Optional[float]
    member_id: Optional[str]
    code: Optional[str]
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)

    def __repr__(self):
        return "SettleResult(value_jod=%r, points=%r)" % (self.value_jod, self.points)


def normalize_redemption_code(code):
    """'ab2c d3ef' / ' AB2C-D3EF ' -> 'AB2C-D3EF'. Whitespace removed, upper
    case. The dash is kept as typed: the BFF formats codes with it
    (``formatRedemptionCode``); whether it also accepts the bare 8 chars is a
    BFF question (TODO confirm)."""
    return "".join((code or "").split()).upper()


def _num(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ProtocolError("Almond API response: %s is not a number" % name)
    return float(value)


class AlmondLoyaltyClient:
    """Small blocking HTTP client. One instance per call site is fine."""

    def __init__(self, base_url, pos_key, timeout=5.0, session=None,
                 allow_insecure_http=False):
        base_url = (base_url or "").strip().rstrip("/")
        if not base_url:
            raise ConfigError("Almond loyalty API URL is not configured")
        if not pos_key:
            raise ConfigError("Almond loyalty POS key is not configured")
        parts = urlsplit(base_url)
        if parts.scheme not in ("http", "https") or not parts.hostname:
            raise ConfigError("Almond loyalty API URL is not a valid http(s) URL")
        if parts.scheme == "http" and parts.hostname not in _LOCAL_HOSTS and not allow_insecure_http:
            raise ConfigError("Almond loyalty API URL must be https (the POS key travels in a header)")
        self._base_url = base_url
        self.__key = pos_key  # name-mangled: not reachable as client.pos_key
        self._timeout = float(timeout) if timeout and float(timeout) > 0 else 5.0
        self._session = session or requests.Session()

    def __repr__(self):
        return "AlmondLoyaltyClient(base_url=%r, pos_key=***, timeout=%r)" % (self._base_url, self._timeout)

    __str__ = __repr__

    # ------------------------------------------------------------------ calls
    def scan(self, token):
        """Resolve a member QR. The token is SINGLE-USE (60 s): call once and
        keep the result — a second scan of the same token is a 409."""
        if not token:
            raise BadRequestError("empty token")
        data = self._post("/v1/pos/scan", {"token": token})
        member_id = data.get("memberId")
        mode = data.get("mode")
        if not isinstance(member_id, str) or not member_id or mode not in SCAN_MODES:
            raise ProtocolError("Almond API scan response is missing memberId/mode")
        earns = data.get("earnsPoints")
        if not isinstance(earns, bool):
            raise ProtocolError("Almond API scan response is missing earnsPoints")
        corporate = data.get("corporate") or None
        if corporate is not None:
            if not isinstance(corporate, dict):
                raise ProtocolError("Almond API scan response: corporate is not an object")
            _num(corporate.get("percentOff"), "corporate.percentOff")
        redemption = data.get("redemption") or None
        if redemption is not None:
            if not isinstance(redemption, dict):
                raise ProtocolError("Almond API scan response: redemption is not an object")
            _num(redemption.get("valueJod"), "redemption.valueJod")
        ticket = data.get("earnTicket")
        return ScanResult(
            member_id=member_id,
            mode=mode,
            earns_points=earns,
            earn_ticket=ticket if isinstance(ticket, str) and ticket else None,
            redemption=redemption,
            corporate=corporate,
            raw=data,
        )

    def earn(self, earn_ticket, pos_order_ref, branch_id, paid_total, paid_at=None):
        """Award points for a PAID order. Idempotent on ``pos_order_ref``."""
        if not earn_ticket or not pos_order_ref or not branch_id:
            raise BadRequestError("earn needs earnTicket, posOrderRef and branchId")
        body = {
            "earnTicket": earn_ticket,
            "posOrderRef": pos_order_ref,
            "branchId": branch_id,
            "paidTotal": round(float(paid_total), 3),
        }
        if paid_at:
            body["paidAt"] = paid_at
        data = self._post("/v1/pos/earn", body)
        return EarnResult(
            pos_order_ref=str(data.get("posOrderRef") or pos_order_ref),
            points_earned=_num(data.get("pointsEarned"), "pointsEarned"),
            points_balance=(_num(data["pointsBalance"], "pointsBalance")
                            if data.get("pointsBalance") is not None else None),
            replay=bool(data.get("replay")),
            raw=data,
        )

    def reverse_earn(self, pos_order_ref, reason):
        if not pos_order_ref:
            raise BadRequestError("reverse needs posOrderRef")
        data = self._post("/v1/pos/earn/reverse", {"posOrderRef": pos_order_ref, "reason": reason or "refund"})
        return ReverseResult(
            reversed_points=_num(data.get("reversedPoints"), "reversedPoints"),
            shortfall=_num(data.get("shortfall", 0), "shortfall"),
            raw=data,
        )

    def settle_redemption(self, token=None, code=None):
        """Consume a redemption ONCE. Pass exactly one of ``token`` (a
        redeem-mode QR that has NOT been scanned) or ``code``."""
        if bool(token) == bool(code):
            raise BadRequestError("settle needs exactly one of token or code")
        body = {"token": token} if token else {"code": normalize_redemption_code(code)}
        data = self._post("/v1/pos/redemption/settle", body)
        redemption = data.get("redemption") if isinstance(data.get("redemption"), dict) else {}
        value = data.get("valueJod", redemption.get("valueJod"))
        points = data.get("points", redemption.get("points"))
        return SettleResult(
            value_jod=_num(value, "valueJod"),
            points=float(points) if isinstance(points, (int, float)) and not isinstance(points, bool) else None,
            member_id=data.get("memberId") if isinstance(data.get("memberId"), str) else None,
            code=redemption.get("code") if isinstance(redemption.get("code"), str) else None,
            raw=data,
        )

    # -------------------------------------------------------------- transport
    def _post(self, path, body):
        url = self._base_url + path
        started = time.monotonic()
        try:
            resp = self._session.post(
                url,
                json=body,
                headers={"x-pos-key": self.__key, "Accept": "application/json"},
                timeout=self._timeout,
            )
        except requests.Timeout:
            _logger.warning("Almond loyalty %s: timeout after %.1fs", path, self._timeout)
            raise UnavailableError("Almond loyalty API timed out") from None
        except requests.ConnectionError:
            _logger.warning("Almond loyalty %s: connection failed", path)
            raise UnavailableError("Almond loyalty API unreachable") from None
        except requests.RequestException as exc:
            _logger.warning("Almond loyalty %s: transport error %s", path, type(exc).__name__)
            raise UnavailableError("Almond loyalty API transport error") from None

        elapsed_ms = int((time.monotonic() - started) * 1000)
        status = resp.status_code
        data = None
        try:
            data = resp.json()
        except ValueError:
            data = None
        _logger.info("Almond loyalty %s -> %s (%d ms)", path, status, elapsed_ms)

        if 200 <= status < 300:
            if not isinstance(data, dict):
                raise ProtocolError("Almond API returned a non-JSON body", status=status)
            return data

        api_code = api_message = None
        if isinstance(data, dict):
            api_code = str(data.get("error") or "")[:64] or None
            api_message = str(data.get("message") or "")[:_MAX_API_MESSAGE] or None
        msg = "Almond API %s -> HTTP %s%s" % (path, status, (" (%s)" % api_code) if api_code else "")
        kw = {"status": status, "api_code": api_code, "api_message": api_message}
        if status in (401, 403):
            raise AuthError(msg, **kw)
        if status == 409:
            raise ConflictError(msg, **kw)
        if status == 404:
            raise NotFoundError(msg, **kw)
        if status in (400, 410, 422):
            raise BadRequestError(msg, **kw)
        if status == 429 or status >= 500:
            raise UnavailableError(msg, **kw)
        raise BadRequestError(msg, **kw)
