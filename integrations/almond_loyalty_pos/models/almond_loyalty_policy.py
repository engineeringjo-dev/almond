# -*- coding: utf-8 -*-
"""
Outbox + money rules — pure functions, NO Odoo imports (unit-tested alone).

Kept out of the Odoo models so the decisions that cost money (what is retried,
what is given up and why, what "paid total" and "paid at" mean) are testable
without a database.
"""
from collections import namedtuple
from datetime import timezone

from .almond_loyalty_client import (
    AuthError,
    BadRequestError,
    ClientValidationError,
    ConfigError,
    ConflictError,
    NotFoundError,
    PaidAtOutsideWindowError,
    PosKeyInvalidError,
    PosOrderConflictError,
    TicketExpiredError,
    TicketInvalidError,
    TicketUsedError,
    TokenExpiredError,
    TokenInvalidError,
    TokenReplayError,
)

# Outbox decisions
RETRY = "retry"   # keep pending, try again after backoff
FAIL = "fail"     # stop; the reason is recorded for a human

# Why a row failed — shown to operators (outbox list / form).
KIND_CONFIG = "config"        # the till's POS key / URL is wrong: fix Settings, then "Retry now"
KIND_TICKET = "ticket"        # member QR / earn ticket refused (invalid, expired, already used)
KIND_CONFLICT = "conflict"    # same posOrderRef already reported with other member/amount/branch
KIND_WINDOW = "window"        # paidAt outside [scan − 30 min, scan + 6 h]
KIND_REJECTED = "rejected"    # 400 validation / 404 unknown ref / refused before sending
KIND_EXHAUSTED = "exhausted"  # retryable, but gave up after DEFAULT_MAX_ATTEMPTS
FAILURE_KINDS = (KIND_CONFIG, KIND_TICKET, KIND_CONFLICT, KIND_WINDOW, KIND_REJECTED, KIND_EXHAUSTED)

Outcome = namedtuple("Outcome", "decision kind")

DEFAULT_BASE_DELAY = 60           # seconds: 1st retry after 1 min
DEFAULT_MAX_DELAY = 6 * 3600      # never wait more than 6 h between tries
DEFAULT_MAX_ATTEMPTS = 25         # ~4 days at the cap, then give up (state=failed)

JOD_DIGITS = 3


def backoff_seconds(attempts, base=DEFAULT_BASE_DELAY, cap=DEFAULT_MAX_DELAY):
    """Delay before the next try, after ``attempts`` failed tries (>= 1).

    1 -> 60 s, 2 -> 120 s, 3 -> 240 s ... capped at 6 h. No jitter: one cron
    worker drains the queue serially, so there is no thundering herd to break.
    """
    attempts = max(1, int(attempts or 1))
    return int(min(cap, base * (2 ** (attempts - 1))))


def classify(exc, attempts, max_attempts=DEFAULT_MAX_ATTEMPTS):
    """What the outbox does with a failed row, and why.

    FAIL, never retried (retrying the same body gets the same answer):
      * pos_key_invalid / unknown 401 / local config gap  -> KIND_CONFIG
        (operators fix the key/URL, then press "Retry now")
      * token_* / ticket_invalid / ticket_expired / ticket_used -> KIND_TICKET
      * pos_order_conflict / other 409                     -> KIND_CONFLICT
      * paid_at_outside_ticket_window                       -> KIND_WINDOW
      * 400 validation / 404 / refused before sending       -> KIND_REJECTED
    RETRY with backoff: rate_limited (429), 5xx, timeout, connection, bad body,
    and any unexpected exception — until ``max_attempts``, then KIND_EXHAUSTED.
    """
    if isinstance(exc, (PosKeyInvalidError, ConfigError)):
        return Outcome(FAIL, KIND_CONFIG)
    if isinstance(exc, (TokenInvalidError, TokenExpiredError, TokenReplayError,
                        TicketInvalidError, TicketExpiredError, TicketUsedError)):
        return Outcome(FAIL, KIND_TICKET)
    if isinstance(exc, AuthError):  # a 401/403 code this build does not know: a key problem
        return Outcome(FAIL, KIND_CONFIG)
    if isinstance(exc, (PosOrderConflictError, ConflictError)):
        return Outcome(FAIL, KIND_CONFLICT)
    if isinstance(exc, PaidAtOutsideWindowError):
        return Outcome(FAIL, KIND_WINDOW)
    if isinstance(exc, (BadRequestError, NotFoundError, ClientValidationError)):
        return Outcome(FAIL, KIND_REJECTED)
    # UnavailableError (incl. RateLimitedError, ProtocolError) and anything unexpected
    if attempts >= max_attempts:
        return Outcome(FAIL, KIND_EXHAUSTED)
    return Outcome(RETRY, None)


def decide(exc, attempts, max_attempts=DEFAULT_MAX_ATTEMPTS):
    """RETRY or FAIL (see :func:`classify`)."""
    return classify(exc, attempts, max_attempts).decision


def paid_total(payments):
    """JOD actually collected in money, tax-inclusive, EXCLUDING any amount
    settled with an Almond redemption.

    ``payments`` is an iterable of ``(amount, is_almond_redemption)``. Odoo
    records the cash change as a separate NEGATIVE ``pos.payment`` line
    (``is_change``), so a plain sum already nets the change out.
    Never negative (a refund is handled by the reverse path, not by earn).
    """
    total = sum(float(amount or 0.0) for amount, is_redemption in payments if not is_redemption)
    return max(0.0, round(total, JOD_DIGITS))


def redemption_mismatch(paid_by_redemption, settled_total, tolerance=0.0005):
    """True when the till charged MORE to the Almond redemption payment method
    than the BFF actually settled for this order (a cashier typing an amount
    on that method, or a settle that was never made). Less is fine: a
    redemption bigger than the bill is capped at the bill."""
    return round(float(paid_by_redemption or 0.0) - float(settled_total or 0.0), JOD_DIGITS) > tolerance


def payment_time(date_order, payment_dates=()):
    """When the order was actually PAID — the latest of ``date_order`` and the
    payment lines' dates.

    Odoo 19 (verified in 19.0 source): the till sets ``date_order`` to "now"
    at validation (``OrderPaymentValidation.finalizeValidation``) and the
    server re-stamps it when that order is the one being synced; an order paid
    in the back office keeps its original ``date_order`` but gets fresh
    ``pos.payment.payment_date`` values — hence the max.
    """
    stamps = [d for d in (date_order, *payment_dates) if d]
    return max(stamps) if stamps else None


def iso_utc(dt):
    """Datetime -> '2026-09-23T07:15:02Z'. Odoo stores NAIVE UTC datetimes;
    an aware one is converted to UTC. The explicit 'Z' is required by the BFF
    (a naive paidAt is refused)."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
