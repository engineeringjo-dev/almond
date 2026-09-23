/**
 * The Idempotency-Key lifetime, shared by BOTH backends so they cannot
 * disagree about when a key stops protecting a retry.
 *
 * 24 hours is Stripe's replay window: long enough to cover a phone that lost
 * signal overnight, short enough that the table does not grow without bound —
 * a member sending a fresh key per request (which is what the header is FOR)
 * would otherwise keep every financial POST they ever made.
 */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** How often, at most, a backend deletes expired keys. Expiry is enforced at
 *  READ regardless; the sweep only reclaims space. */
export const IDEMPOTENCY_SWEEP_EVERY_MS = 60_000;

/** A key created at `createdAtMs` no longer protects anything at `at`. */
export const idempotencyExpired = (createdAtMs: number, at: Date): boolean =>
  at.getTime() - createdAtMs > IDEMPOTENCY_TTL_MS;
