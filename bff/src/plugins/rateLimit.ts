import type { FastifyRequest } from 'fastify';
import { tooManyRequests } from '../http-error';

/**
 * A fixed-window counter per key, in process.
 *
 * WHY NO DEPENDENCY. The OTP caps (auth/otp.ts) and the POS replay guard
 * (pos/token.ts) already keep this kind of state in a Map and say so: correct
 * per instance, not shared, and moving to Redis is one change for all three.
 * A limiter library would be a fourth store with a different lifetime.
 *
 * The limits are read through a getter on every call, not captured at
 * construction, so an operator's env override and a test's config change both
 * take effect without a rebuild.
 */
export interface Limit { max: number; windowSeconds: number }

interface Window { count: number; resetAt: number }

export class FixedWindowLimiter {
  private readonly windows = new Map<string, Window>();
  private lastSweep = 0;

  constructor(readonly name: string, private readonly limit: () => Limit) {}

  private live(key: string, now: number): Window | undefined {
    const w = this.windows.get(key);
    return w && w.resetAt > now ? w : undefined;
  }

  /** Drop expired windows at most once per window length, so the map is
   *  bounded by the keys active in ONE window rather than by every key seen. */
  private sweep(now: number): void {
    if (now - this.lastSweep < this.limit().windowSeconds * 1000) return;
    this.lastSweep = now;
    for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
  }

  /** Refuse if the key has already spent its budget. Counts nothing. */
  check(key: string): void {
    const now = Date.now();
    const w = this.live(key, now);
    if (w && w.count >= this.limit().max) {
      throw tooManyRequests('rate_limited', `too many requests (${this.name}) — try again later`);
    }
  }

  /** Count one event against the key. */
  hit(key: string): void {
    const now = Date.now();
    this.sweep(now);
    const w = this.live(key, now);
    if (w) w.count += 1;
    else this.windows.set(key, { count: 1, resetAt: now + this.limit().windowSeconds * 1000 });
  }

  /** check + hit: the ordinary "N per window" limit. */
  take(key: string): void {
    this.check(key);
    this.hit(key);
  }

  reset(): void { this.windows.clear(); this.lastSweep = 0; }
}

const all: FixedWindowLimiter[] = [];

export function limiter(name: string, limit: () => Limit): FixedWindowLimiter {
  const l = new FixedWindowLimiter(name, limit);
  all.push(l);
  return l;
}

/** A preHandler that spends one unit of `l` for the key `keyOf(req)` returns.
 *  Put it AFTER requireMember when the key is the member. */
export function rateLimit(l: FixedWindowLimiter, keyOf: (req: FastifyRequest) => string) {
  return async (req: FastifyRequest): Promise<void> => { l.take(keyOf(req)); };
}

/** Test-only: forget every window in every limiter. */
export function __resetRateLimits(): void {
  for (const l of all) l.reset();
}
