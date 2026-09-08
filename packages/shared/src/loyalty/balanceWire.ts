import type { LoyaltyBalance, TierId } from '../types';
import { tiers } from './constants';

/**
 * THE WIRE CONTRACT FOR `GET /v1/me/balance`.
 *
 * It exists because the producer (bff/src/routes/me.ts) and the consumer
 * (almond-app's `LoyaltyBalance`) were two hand-written object shapes that had
 * already drifted apart with nothing to notice:
 *
 *   - the route sends `tier` as an OBJECT ({id, nameAr, nameEn, multiplier});
 *     `LoyaltyBalance.tier` is a `TierId` STRING.
 *   - the route sends no `userId`, no `multiplier` and no `cup`, all three of
 *     which `LoyaltyBalance` declared as REQUIRED.
 *   - `loyalty.service.live.ts` cast the response with `apiGet<LoyaltyBalance>`,
 *     i.e. asserted the shape instead of checking it.
 *
 * The damage was silent and it was money-shaped: every consumer resolves the
 * rung by identity with a fallback — `tiers.find(t => t.id === balance.tier) ??
 * tiers[0]` — so an object never matches, everything falls back to the entry
 * rung, and a member the server pays 6% is shown "2%" on four screens and
 * quoted a 2% earn estimate in the cart while being granted 6%. No error is
 * raised anywhere on that path; that is exactly why it survived.
 *
 * So the wire gets a NAME, on both sides:
 *   - the route's handler is annotated `MeBalanceWire`, so a producer-side
 *     drift is a typecheck failure rather than a runtime surprise;
 *   - the client runs `parseMeBalance` before anything reads a field, so a
 *     consumer-side drift is a NAMED THROW at the seam rather than a wrong
 *     number rendered confidently.
 *
 * The wire deliberately keeps `tier` as the object. The rung's NAME is the rate
 * ("٤٪" / "4%") and it is the server that decides what it pays, so the server
 * says it; a client that resolves the name from its own table can disagree with
 * the server about the rate and did. `toLoyaltyBalance` flattens it to the view
 * type the screens use.
 */
export interface MeBalanceWire {
  points: number;
  /** Qualifying spend inside config.TIER_WINDOW_DAYS Amman days, inclusive of
   *  today. Not a lifetime total — see loyalty/window.ts. */
  windowSpend: number;
  /** Distinct qualifying days in that window — the other door to the second
   *  rung, and the unit the progress copy is written in. */
  visitDays: number;
  /** The rung the member is PAID at: max(the floor they hold, what the live
   *  window qualifies for). NOT tierFromSpend(windowSpend). */
  tier: { id: TierId; nameAr: string; nameEn: string; multiplier: number };
  nextTier: {
    id: TierId;
    threshold: number;
    jodRemaining: number;
    visitsRemaining: number;
    /** Is that count the visits door (a guarantee) or a spend projection? Only
     *  a guaranteed count may be stated declaratively. */
    visitsGuaranteed: boolean;
    step: number;
  } | null;
}

/** Thrown by `parseMeBalance` when the body is not the contract above. Named,
 *  so a caller can tell "the server sent something else" from "the network
 *  failed" — the distinction the bare cast destroyed. */
export class BalanceWireError extends Error {
  constructor(public readonly path: string, public readonly detail: string) {
    super(`GET /v1/me/balance: ${path} ${detail}`);
    this.name = 'BalanceWireError';
  }
}

const TIER_IDS: readonly string[] = tiers.map((t) => t.id);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function num(o: Record<string, unknown>, key: string, path: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new BalanceWireError(`${path}${key}`, `expected a finite number, got ${JSON.stringify(v)}`);
  }
  return v;
}

function str(o: Record<string, unknown>, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new BalanceWireError(`${path}${key}`, `expected a non-empty string, got ${JSON.stringify(v)}`);
  }
  return v;
}

function tierId(o: Record<string, unknown>, key: string, path: string): TierId {
  const v = str(o, key, path);
  if (!TIER_IDS.includes(v)) {
    throw new BalanceWireError(`${path}${key}`, `"${v}" is not one of ${TIER_IDS.join(' | ')}`);
  }
  return v as TierId;
}

/**
 * Validate a `GET /v1/me/balance` body. Throws `BalanceWireError` naming the
 * first field that does not match — never returns a partially-trusted object,
 * and never silently coerces, because a silently coerced rung is the defect
 * this whole module exists to stop.
 */
export function parseMeBalance(raw: unknown): MeBalanceWire {
  if (!isRecord(raw)) throw new BalanceWireError('(body)', `expected an object, got ${typeof raw}`);
  const tier = raw.tier;
  if (!isRecord(tier)) {
    // The single most likely drift, and the one that was live: `tier` sent as a
    // bare id string, or the object dropped entirely.
    throw new BalanceWireError('tier', `expected an object {id,nameAr,nameEn,multiplier}, got ${JSON.stringify(tier)}`);
  }
  const next = raw.nextTier;
  if (next !== null && !isRecord(next)) {
    throw new BalanceWireError('nextTier', `expected an object or null, got ${JSON.stringify(next)}`);
  }
  const visitsGuaranteed = next ? next.visitsGuaranteed : undefined;
  if (next && typeof visitsGuaranteed !== 'boolean') {
    // ABSENT IS READ AS FALSE everywhere else in the system (LoyaltyBalance
    // declares it optional so a producer that has not thought about it cannot
    // accidentally promise). Here it is required: this producer HAS thought
    // about it, and dropping it would quietly downgrade every guaranteed
    // sentence to a hedge with nothing to notice.
    throw new BalanceWireError('nextTier.visitsGuaranteed', `expected a boolean, got ${JSON.stringify(visitsGuaranteed)}`);
  }
  return {
    points: num(raw, 'points', ''),
    windowSpend: num(raw, 'windowSpend', ''),
    visitDays: num(raw, 'visitDays', ''),
    tier: {
      id: tierId(tier, 'id', 'tier.'),
      nameAr: str(tier, 'nameAr', 'tier.'),
      nameEn: str(tier, 'nameEn', 'tier.'),
      multiplier: num(tier, 'multiplier', 'tier.'),
    },
    nextTier: next
      ? {
          id: tierId(next, 'id', 'nextTier.'),
          threshold: num(next, 'threshold', 'nextTier.'),
          jodRemaining: num(next, 'jodRemaining', 'nextTier.'),
          visitsRemaining: num(next, 'visitsRemaining', 'nextTier.'),
          visitsGuaranteed: visitsGuaranteed as boolean,
          step: num(next, 'step', 'nextTier.'),
        }
      : null,
  };
}

/**
 * Flatten the wire into the view type the screens read.
 *
 * `userId` is supplied by the caller because the server never sends it: the
 * member IS the JWT subject, so putting an id in the body would only be an
 * opportunity for the two to disagree.
 *
 * `cup` is deliberately absent. The BFF holds no cup state at all, and
 * fabricating `{current: 0, target: N}` here would render a real-looking
 * progress ring for a counter nobody keeps. `LoyaltyBalance.cup` is optional
 * for exactly this reason and its two call sites are guarded.
 */
export function toLoyaltyBalance(wire: MeBalanceWire, userId: string): LoyaltyBalance {
  return {
    userId,
    points: wire.points,
    windowSpend: wire.windowSpend,
    visitDays: wire.visitDays,
    tier: wire.tier.id,
    multiplier: wire.tier.multiplier,
    nextTier: wire.nextTier
      ? {
          id: wire.nextTier.id,
          jodRemaining: wire.nextTier.jodRemaining,
          visitsRemaining: wire.nextTier.visitsRemaining,
          visitsGuaranteed: wire.nextTier.visitsGuaranteed,
          step: wire.nextTier.step,
        }
      : null,
  };
}
