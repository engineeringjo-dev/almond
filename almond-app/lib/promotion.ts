import type { Lang, LoyaltyBalance, Tier } from '@/types';
import { tierName, tiers } from '@almond/shared/loyalty';

/**
 * THE PROMOTION CELEBRATION — «🎉 مبروك! خصمك تضاعف».
 *
 * Approved copy, carried over from W4's sheet 9:
 *   «🎉 مبروك! خصمك تضاعف — صرت على ٤٪ · وباقي لك ٧ زيارات للـ٦٪»
 *   "🎉 Your cashback just DOUBLED — you are on 4% · 7 more visits to reach 6%"
 *
 * It was the one piece of W4 that did not ship, for a stated reason
 * (FINAL.md §4.5): `standing()` returns held/floor/qualified and carries no
 * "changed since the member last looked" bit, and there is no notification
 * pipeline. This module is that bit. It is pure, and it is the whole decision:
 * the store underneath it only reads and writes a string, and the banner above
 * it only renders what this returns.
 *
 * ── WHY THE "LAST RUNG SHOWN" IS DEVICE STATE, NOT SERVER STATE ─────────────
 *
 * `standing()` is a pure recomputation of `max(floor, live window)` on every
 * read — it deliberately mutates nothing (D11), which is exactly why it cannot
 * remember anything. Putting the memory on the server means a new column on
 * `Member`, a new field on the `Backend` interface, an Odoo field that does not
 * exist, and a decision about WHEN the server marks it seen — which the server
 * cannot know, because it never learns that a screen was rendered. The fact
 * being remembered is not "what rate is this member paid" (the server owns
 * that, and this module never second-guesses it); it is "what rate has this
 * member been SHOWN", which is a property of a display surface. It belongs
 * where the display is.
 *
 * The cost is honest and bounded: a member on two devices is congratulated on
 * both, and a reinstall re-baselines and therefore MISSES a celebration that
 * landed while the app was gone. Both failures are in the safe direction — a
 * second «مبروك» is a pleasantry, a false one is not — and the baseline rule
 * below is what makes the reinstall silent instead of wrong.
 *
 * ── WHY A BRAND-NEW MEMBER IS NEVER CELEBRATED ──────────────────────────────
 *
 * Starting on 2% is not a promotion; it is the entry rung, and every member has
 * always been on it. So the FIRST observation is a BASELINE, never a
 * celebration: `seenRungId: ''` (nothing recorded) is a distinct state from
 * `seenRungId: 'base'` (recorded, on the entry rung). That same rule covers the
 * member who installs the app already holding 4%: their first observation
 * records 4% silently, and the next celebration they see will be a real one.
 *
 * ── WHY IT FIRES ON A RISE IN THE RUNG PAID, AND ONLY ONCE ──────────────────
 *
 * The event is "your cashback changed", so the trigger is the rung the member
 * is PAID at — `balance.tier`, which IS `standing().held` = max(floor, live
 * window). A live window that re-qualifies a rung the member already holds
 * changes nothing they are paid and is not a promotion; there is no demotion,
 * so re-qualification is the normal state of a promoted member and celebrating
 * it would fire every quarter forever.
 *
 * `seenRungId` is therefore a HIGH-WATER MARK — the same shape as the floor
 * itself, and for the same reason. It only ever rises. A rung that reads LOWER
 * than the mark (possible for a member whose floor was never materialised by a
 * write and whose window then rolled off) neither celebrates nor lowers the
 * mark, so one promotion can never be celebrated twice.
 */

/** What is persisted per member, per device. Two independent facts:
 *  the high-water mark (fire-once) and the celebration owed (survive-restart). */
export interface PromotionRecord {
  /** The best rung this member has been SHOWN on this device. `''` means
   *  NOTHING has been recorded yet — see the baseline rule above. It is not
   *  `'base'`, and the two must never be conflated. */
  seenRungId: string;
  /** A celebration detected and not yet dismissed. It is stored rather than
   *  derived because the member has to be able to see it days later: the rise
   *  happens at a till, and the next time the app is opened the standing looks
   *  exactly like that of a member who has been on 4% for a year. */
  pending: { fromId: string; toId: string } | null;
}

export const NO_PROMOTION_RECORD: PromotionRecord = { seenRungId: '', pending: null };

const rungIndex = (id: string): number => tiers.findIndex((t) => t.id === id);
const rungById = (id: string): Tier | undefined => tiers.find((t) => t.id === id);

/**
 * Fold one observation of the rung the member is PAID at into the record.
 *
 * Total and pure: every input returns a record, and the same input twice
 * returns the same record — which is what makes "fires once" a property of the
 * function rather than of the caller's discipline.
 */
export function observeRung(prev: PromotionRecord, currentRungId: string): PromotionRecord {
  const curIdx = rungIndex(currentRungId);
  // An id the ramp does not carry: a retired tier on an old wire body, or a
  // field the parser let through. rungById() elsewhere falls back to the entry
  // rung so a member is still PAID; here the safe fallback is silence — there
  // is nothing to congratulate someone on if we cannot name it.
  if (curIdx < 0) return prev;

  if (prev.seenRungId === '') {
    // BASELINE. First sight of this member on this device, at whatever rung
    // they are already on. Never a celebration.
    return { seenRungId: currentRungId, pending: null };
  }

  const seenIdx = rungIndex(prev.seenRungId);
  // A mark we cannot place is treated as no mark at all, and re-baselines.
  if (seenIdx < 0) return { seenRungId: currentRungId, pending: null };

  if (curIdx <= seenIdx) {
    // Unchanged, or lower than the high-water mark. Not a promotion, and the
    // mark does NOT come down with it — otherwise a window that rolled off and
    // then re-qualified would replay the same «مبروك».
    return prev;
  }

  return { seenRungId: currentRungId, pending: { fromId: prev.seenRungId, toId: currentRungId } };
}

/** The member has seen it. The mark stays; only the owed celebration clears. */
export function dismissPromotion(prev: PromotionRecord): PromotionRecord {
  return prev.pending === null ? prev : { ...prev, pending: null };
}

// ---------------------------------------------------------------------------
// Persistence shape
// ---------------------------------------------------------------------------

/** What actually goes on disk. The member id travels with it so a second
 *  account signing in on the same handset is BASELINED rather than handed the
 *  first one's celebration — the record is about a person, the device is not. */
export interface StoredPromotion extends PromotionRecord {
  userId: string;
}

export function serialisePromotion(userId: string, record: PromotionRecord): string {
  return JSON.stringify({ userId, ...record } satisfies StoredPromotion);
}

/**
 * Read the blob back for `userId`. Anything unreadable, or written for a
 * different member, returns NO_PROMOTION_RECORD — which re-baselines silently
 * instead of celebrating, because a corrupt record must never be able to
 * manufacture a promotion.
 */
export function parsePromotion(raw: string | null | undefined, userId: string): PromotionRecord {
  if (!raw) return NO_PROMOTION_RECORD;
  try {
    const v = JSON.parse(raw) as Partial<StoredPromotion> | null;
    if (!v || typeof v !== 'object') return NO_PROMOTION_RECORD;
    if (v.userId !== userId) return NO_PROMOTION_RECORD;
    if (typeof v.seenRungId !== 'string' || rungIndex(v.seenRungId) < 0) return NO_PROMOTION_RECORD;
    const p = v.pending;
    const pending =
      p && typeof p === 'object'
      && typeof p.fromId === 'string' && typeof p.toId === 'string'
      && rungIndex(p.toId) > rungIndex(p.fromId)
        ? { fromId: p.fromId, toId: p.toId }
        : null;
    return { seenRungId: v.seenRungId, pending };
  } catch {
    return NO_PROMOTION_RECORD;
  }
}

// ---------------------------------------------------------------------------
// The copy
// ---------------------------------------------------------------------------

/**
 * Which celebration sentence, and its second clause.
 *
 * TWO STATES, because the approved copy only describes one of them. Its second
 * clause names the NEXT rung and a visits count, and at the top of the ladder
 * there is no next rung: a member promoted to 6% must be congratulated without
 * being pointed anywhere.
 *
 * ── THE MULTIPLIER RULE IS STRUCTURAL HERE TOO ──────────────────────────────
 *
 * «المضاعف ×2 يُذكر مرة واحدة فقط — عند الترقية إلى 4%. تكراره يُفقده أثره»,
 * and ×1.5 is never said at all. `loyalty.toPlus` (the PROGRESS sentence) is
 * the one key carrying the literal "×2" and C9 in bff/test/copy.test.ts pins
 * that; this sentence says the doubling in WORDS instead («تضاعف» / "DOUBLED"),
 * which is the approved wording and adds no second "×2" for C9 to find.
 *
 * The doubling claim is gated on the arithmetic, not on the rung's name: it is
 * said only when the rate reached really is twice the rate left behind. Today
 * that is exactly base→plus (1.0 → 2.0). A member who jumps base→top in one
 * invoice tripled, so they get the top-rung sentence, not a false "doubled".
 * Any other rise a future ramp could produce returns null — no celebration
 * rather than a wrong one, and a fourth rung has to bring its own key.
 */
export interface PromotionCopy {
  key: 'loyalty.promotedDoubled' | 'loyalty.promotedTop';
  params: { tier: string };
  /** The "· N more visits to reach 6%" clause, or null where there is no rung
   *  above. Rendered as a second line, never concatenated into `key`. */
  next: { key: 'loyalty.promotedNext'; params: { visits: number; tier: string } } | null;
}

export function promotionCopy(
  pending: PromotionRecord['pending'],
  nextTier: LoyaltyBalance['nextTier'],
  lang: Lang,
): PromotionCopy | null {
  if (!pending) return null;
  const reached = rungById(pending.toId);
  const from = rungById(pending.fromId);
  if (!reached || !from) return null;

  const params = { tier: tierName(reached, lang) };

  // The top rung first, so a base→top jump is never described as a doubling.
  if (reached.id === tiers[tiers.length - 1].id) {
    return { key: 'loyalty.promotedTop', params, next: null };
  }
  // Two ramp entries compared to decide a SENTENCE. No invoice, no grant, and
  // no points: the rates themselves are computeEarn's business only (§7 T7).
  if (reached.multiplier !== from.multiplier * 2) return null;

  /**
   * The second clause. Its count comes off the member's real standing
   * (`standing().next.visitsRemaining`) and is never computed here — a second
   * projection is exactly the defect FINAL.md §2.1 removed.
   *
   * It is HEDGED ("about" / «تقريباً») on purpose. The visits door
   * (config.TIER2_VISITS_ALTERNATIVE) opens the second rung only; the rung
   * above this one has no door at all, so `visitsGuaranteed` is false here by
   * construction and the count is a projection at the measured 5.85 JOD basket.
   * The approved line reads «وباقي لك ٧ زيارات للـ٦٪» flat, and stating an
   * unguaranteed count declaratively is the promise a member holds us to: a
   * member 60 JOD in who returns for a 2.500 JOD americano is still on 4%. The
   * hedge is the same one `loyalty.toTop` already carries for the same number.
   */
  const up = nextTier ? rungById(nextTier.id) : undefined;
  const next =
    nextTier && up && nextTier.visitsRemaining > 0
      ? {
          key: 'loyalty.promotedNext' as const,
          params: { visits: nextTier.visitsRemaining, tier: tierName(up, lang) },
        }
      : null;

  return { key: 'loyalty.promotedDoubled', params, next };
}
