# -*- coding: utf-8 -*-
"""
Almond loyalty API client — till -> BFF, server-to-server.

DELIBERATELY FREE OF ODOO IMPORTS. Nothing here imports ``odoo``, so this file
is unit-tested on its own (``tests/test_client.py`` loads it by path and runs it
against ``mock/almond_bff_mock.py``). The Odoo side
(``almond_loyalty_service.py``) only builds an instance from
``ir.config_parameter`` and calls it.

The four calls (contract: ``bff/src/routes/pos.ts``, ``bff/src/pos/*.ts``):

    POST /v1/pos/scan                 {token}
        -> 200 {memberId, mode, redemption|null, corporate|null, earnsPoints,
                earnTicket|null, earnTicketExpiresIn|null}
    POST /v1/pos/earn                 {earnTicket, posOrderRef, branchId, paidTotal, paidAt}
        -> 201 new grant | 200 replay  {posOrderRef, pointsEarned, pointsBalance, replay}
    POST /v1/pos/earn/reverse         {posOrderRef, reason}
        -> 201 | 200 replay  {posOrderRef, reversedPoints, shortfall, pointsBalance, replay}
    POST /v1/pos/redemption/settle    {token} | {code}
        -> 201 {settled, memberId, valueJod, points, redemption}

Every error body is ``{error: <machine code>, message}``. The client maps the
MACHINE CODE to a typed exception (never the message text) — see
``_ERRORS_BY_CODE``. Unknown codes fall back to the HTTP status.

Every request carries ``x-pos-key``. That key is the till's credential:

* it is never logged, never put in an exception message, never in ``repr``;
* it is only sent over HTTPS (plain http is refused except to localhost, so the
  mock works) — a key in a header over plain http is a key given away;
* the member's QR token / redemption code / earn ticket are ALSO never logged
  (they are bearer values for that member).

No retries happen here. Scan/settle are interactive (the cashier retries), and
earn/reverse are retried by the Odoo outbox with backoff
(``almond_loyalty_policy.py``). A client that retried on its own would hide a
409 conflict behind a loop.
"""
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from urllib.parse import urlsplit

import requests

_logger = logging.getLogger(__name__)

SCAN_MODES = ("pay", "earn", "corporate", "redeem")
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
_MAX_API_MESSAGE = 200

# Server-side limits (bff/src/routes/pos.ts earnBody / reverseBody). Checked
# here so a bad value is refused before it leaves Odoo, with a clear reason.
MAX_EARN_TICKET = 1024
MAX_POS_ORDER_REF = 64
MAX_BRANCH_ID = 64
MAX_PAID_TOTAL = 100_000
MAX_REASON = 200
# ISO-8601 with an EXPLICIT offset ("…Z" or "…+03:00"); a naive time is refused
# by the BFF (it is two different instants in Amman and in UTC).
_ISO_WITH_OFFSET = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$"
)


# --------------------------------------------------------------------------- #
# Errors — typed so the caller decides retry vs. fail without parsing strings.
# --------------------------------------------------------------------------- #
class AlmondLoyaltyError(Exception):
    """Base error. ``status`` is the HTTP status (None for transport/local
    errors). ``api_code`` / ``api_message`` are the BFF's ``{error, message}``
    body (truncated). The message never contains the POS key or any body."""

    retryable = False
    code = None  # the BFF machine code this class stands for, if any

    def __init__(self, message, status=None, api_code=None, api_message=None):
        super().__init__(message)
        self.status = status
        self.api_code = api_code
        self.api_message = api_message


# -- configuration (ours) ----------------------------------------------------
class ConfigError(AlmondLoyaltyError):
    """Client mis-configured locally (no URL, no key, insecure URL)."""


class ClientValidationError(AlmondLoyaltyError):
    """Refused BEFORE sending: the value would break the BFF's schema
    (e.g. a naive paidAt, a posOrderRef longer than 64)."""


# -- status families (fallback when the code is unknown) ----------------------
class AuthError(AlmondLoyaltyError):
    """401/403 with a code this client does not know."""


class ConflictError(AlmondLoyaltyError):
    """409 with a code this client does not know."""


class BadRequestError(AlmondLoyaltyError):
    """400/422 — the request is wrong; retrying the same body will not help.
    Also the BFF's generic schema-validation answer (code ``bad_request``)."""


class NotFoundError(AlmondLoyaltyError):
    """404. On /settle: the SAME answer for no such code / already settled /
    expired / not this member (by design). On /earn/reverse: unknown ref."""


class UnavailableError(AlmondLoyaltyError):
    """Timeout, connection failure, 5xx. Retryable."""

    retryable = True


class ProtocolError(UnavailableError):
    """2xx with a body we cannot read. Retryable: earn/reverse are idempotent
    on posOrderRef, so re-sending is safe and re-reads the answer."""


# -- the BFF's machine codes ---------------------------------------------------
class PosKeyInvalidError(AuthError):
    """401 ``pos_key_invalid`` — the till's x-pos-key is wrong/missing, or the
    BFF has none configured. A MISCONFIGURED TILL: alert operations; never a
    member problem, never fixed by retrying."""

    code = "pos_key_invalid"


class TokenInvalidError(AuthError):
    """401 ``token_invalid`` — member QR malformed, mis-signed or unknown mode."""

    code = "token_invalid"


class TokenExpiredError(AuthError):
    """401 ``token_expired`` — member QR past its 60 s."""

    code = "token_expired"


class TokenReplayError(ConflictError):
    """409 ``pos_token_replay`` — this member QR was already scanned."""

    code = "pos_token_replay"


class TicketInvalidError(AuthError):
    """401 ``ticket_invalid`` — the earn ticket was not signed by this server."""

    code = "ticket_invalid"


class TicketExpiredError(AuthError):
    """401 ``ticket_expired`` — the earn ticket is past its lifetime (7 days)
    and this is a NEW sale (a replay still succeeds)."""

    code = "ticket_expired"


class TicketUsedError(ConflictError):
    """409 ``ticket_used`` — the earn ticket already paid for ANOTHER posOrderRef."""

    code = "ticket_used"


class PosOrderConflictError(ConflictError):
    """409 ``pos_order_conflict`` — this posOrderRef was already reported with
    a different member, amount or branch. NEVER retry."""

    code = "pos_order_conflict"


class PaidAtOutsideWindowError(BadRequestError):
    """400 ``paid_at_outside_ticket_window`` — paidAt is not within
    [scan − 30 min, scan + 6 h] of the member's scan."""

    code = "paid_at_outside_ticket_window"


class RateLimitedError(UnavailableError):
    """429 ``rate_limited`` — per-till / per-key limit. Retry with backoff."""

    code = "rate_limited"


_ERRORS_BY_CODE = {
    cls.code: cls
    for cls in (
        PosKeyInvalidError, TokenInvalidError, TokenExpiredError, TokenReplayError,
        TicketInvalidError, TicketExpiredError, TicketUsedError, PosOrderConflictError,
        PaidAtOutsideWindowError, RateLimitedError,
    )
}

__all__ = [
    "AlmondLoyaltyClient", "AlmondLoyaltyError", "ConfigError", "ClientValidationError",
    "AuthError", "ConflictError", "BadRequestError", "NotFoundError", "UnavailableError",
    "ProtocolError", "PosKeyInvalidError", "TokenInvalidError", "TokenExpiredError",
    "TokenReplayError", "TicketInvalidError", "TicketExpiredError", "TicketUsedError",
    "PosOrderConflictError", "PaidAtOutsideWindowError", "RateLimitedError",
    "ScanResult", "EarnResult", "ReverseResult", "SettleResult", "SCAN_MODES",
    "is_iso_with_offset", "normalize_redemption_code",
]


# --------------------------------------------------------------------------- #
# Typed results
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class ScanResult:
    member_id: str
    mode: str
    earns_points: bool
    earn_ticket: Optional[str] = None
    earn_ticket_expires_in: Optional[int] = None
    redemption: Optional[Dict[str, Any]] = None
    corporate: Optional[Dict[str, Any]] = None
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)

    def __repr__(self):  # never print the earn ticket / redemption code
        return "ScanResult(member_id=%r, mode=%r, earns_points=%r, ticket=%s, corporate=%r, redemption=%s)" % (
            self.member_id, self.mode, self.earns_points, "yes" if self.earn_ticket else "no",
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
    pos_order_ref: str
    reversed_points: float
    shortfall: float
    points_balance: Optional[float]
    replay: bool
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
    case, dash kept as typed (the BFF formats codes with it)."""
    return "".join((code or "").split()).upper()


def is_iso_with_offset(value):
    return isinstance(value, str) and bool(_ISO_WITH_OFFSET.match(value))


def _num(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ProtocolError("Almond API response: %s is not a number" % name)
    return float(value)


def _opt_num(value, name):
    return None if value is None else _num(value, name)


def _check_len(value, name, max_len):
    if not isinstance(value, str) or not value or len(value) > max_len:
        raise ClientValidationError("%s must be 1..%d characters" % (name, max_len))


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
        keep the result — a second scan of the same token is TokenReplayError.

        ``earn_ticket`` is present only for a pay/earn QR of a member who earns
        (never corporate, never a redeem-mode scan)."""
        if not token:
            raise ClientValidationError("empty token")
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
        ticket = ticket if isinstance(ticket, str) and ticket else None
        expires_in = data.get("earnTicketExpiresIn")
        return ScanResult(
            member_id=member_id,
            mode=mode,
            earns_points=earns,
            earn_ticket=ticket,
            earn_ticket_expires_in=(int(_num(expires_in, "earnTicketExpiresIn"))
                                    if ticket and expires_in is not None else None),
            redemption=redemption,
            corporate=corporate,
            raw=data,
        )

    def earn(self, earn_ticket, pos_order_ref, branch_id, paid_total, paid_at):
        """Award points for a PAID order. Idempotent on ``pos_order_ref``:
        a 200 replay is SUCCESS (``result.replay`` is True).

        ``paid_at`` is REQUIRED here (the BFF makes it optional): it must be the
        order's actual payment time, ISO-8601 with an explicit offset. Without
        it the BFF dates the sale at DELIVERY time, and an outbox retry after a
        long outage then falls outside the ticket's sale window."""
        _check_len(earn_ticket, "earnTicket", MAX_EARN_TICKET)
        _check_len(pos_order_ref, "posOrderRef", MAX_POS_ORDER_REF)
        _check_len(branch_id, "branchId", MAX_BRANCH_ID)
        if not is_iso_with_offset(paid_at):
            raise ClientValidationError("paidAt must be ISO-8601 with an explicit offset (Z or +03:00)")
        try:
            total = round(float(paid_total), 3)
        except (TypeError, ValueError):
            raise ClientValidationError("paidTotal is not a number") from None
        if not (0 <= total <= MAX_PAID_TOTAL):
            raise ClientValidationError("paidTotal must be between 0 and %d JOD" % MAX_PAID_TOTAL)
        data = self._post("/v1/pos/earn", {
            "earnTicket": earn_ticket,
            "posOrderRef": pos_order_ref,
            "branchId": branch_id,
            "paidTotal": total,
            "paidAt": paid_at,
        })
        return EarnResult(
            pos_order_ref=str(data.get("posOrderRef") or pos_order_ref),
            points_earned=_num(data.get("pointsEarned"), "pointsEarned"),
            points_balance=_opt_num(data.get("pointsBalance"), "pointsBalance"),
            replay=bool(data.get("replay")),
            raw=data,
        )

    def reverse_earn(self, pos_order_ref, reason):
        """Take back what a sale granted (full reversal). 200 replay = success."""
        _check_len(pos_order_ref, "posOrderRef", MAX_POS_ORDER_REF)
        reason = (reason or "").strip()[:MAX_REASON] or "refund"
        data = self._post("/v1/pos/earn/reverse", {"posOrderRef": pos_order_ref, "reason": reason})
        return ReverseResult(
            pos_order_ref=str(data.get("posOrderRef") or pos_order_ref),
            reversed_points=_num(data.get("reversedPoints"), "reversedPoints"),
            shortfall=_num(data.get("shortfall", 0), "shortfall"),
            points_balance=_opt_num(data.get("pointsBalance"), "pointsBalance"),
            replay=bool(data.get("replay")),
            raw=data,
        )

    def settle_redemption(self, token=None, code=None):
        """Consume a redemption ONCE. Pass exactly one of ``token`` (a
        redeem-mode QR that has NOT been scanned) or ``code``."""
        if bool(token) == bool(code):
            raise ClientValidationError("settle needs exactly one of token or code")
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
        try:
            data = resp.json()
        except ValueError:
            data = None
        _logger.info("Almond loyalty %s -> %s (%d ms)", path, status, elapsed_ms)

        if 200 <= status < 300:
            if not isinstance(data, dict):
                raise ProtocolError("Almond API returned a non-JSON body", status=status)
            return data
        raise self._error_for(path, status, data)

    @staticmethod
    def _error_for(path, status, data):
        api_code = api_message = None
        if isinstance(data, dict):
            api_code = str(data.get("error") or "")[:64] or None
            api_message = str(data.get("message") or "")[:_MAX_API_MESSAGE] or None
        msg = "Almond API %s -> HTTP %s%s" % (path, status, (" (%s)" % api_code) if api_code else "")
        kw = {"status": status, "api_code": api_code, "api_message": api_message}
        cls = _ERRORS_BY_CODE.get(api_code)
        if cls is None:
            if status in (401, 403):
                cls = AuthError
            elif status == 409:
                cls = ConflictError
            elif status == 404:
                cls = NotFoundError
            elif status == 429:
                cls = RateLimitedError
            elif status >= 500:
                cls = UnavailableError
            else:
                cls = BadRequestError
        return cls(msg, **kw)
