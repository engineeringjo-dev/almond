# -*- coding: utf-8 -*-
"""
Outbox + money rules — pure functions, NO Odoo imports (unit-tested alone).

Kept out of the Odoo models so the decisions that cost money (what is retried,
what is given up, what "paid total" means) are testable without a database.
"""
from .almond_loyalty_client import (  # noqa: F401  (re-exported for callers)
    AlmondLoyaltyError,
    AuthError,
    BadRequestError,
    ConfigError,
    ConflictError,
    NotFoundError,
    UnavailableError,
)

# Outbox decisions
RETRY = "retry"   # keep pending, try again after backoff
FAIL = "fail"     # stop; a human must look (409, bad request, not found)

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


def decide(exc, attempts, max_attempts=DEFAULT_MAX_ATTEMPTS):
    """What the outbox does with a failed row.

    * ConflictError (409)  -> FAIL, never retry (same ref, different member/amount).
    * BadRequest / NotFound -> FAIL (the same body will be refused again).
    * AuthError (401/403)  -> RETRY with backoff: it is a key/config problem on
      OUR side; once an admin fixes the key the queue drains by itself.
    * ConfigError          -> RETRY (same reasoning: URL/key missing).
    * Unavailable / timeout / 5xx / 429 / unknown -> RETRY.
    Anything retryable becomes FAIL once ``attempts`` reaches ``max_attempts``.
    """
    if isinstance(exc, (ConflictError, BadRequestError, NotFoundError)):
        return FAIL
    if attempts >= max_attempts:
        return FAIL
    return RETRY


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
