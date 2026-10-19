import type { Lang, LoyaltyBalance, Tier, TierId } from '@/types';
import { progressToNextTier, tierName, tiers } from '@almond/shared/loyalty';
import { formatJODNeeded, formatNumber } from '@almond/shared/lib/format';

/**
 * THE ONE PLACE THAT DECIDES WHICH PROGRESS SENTENCE A MEMBER SEES.
 *
 * Owner, 2026-10-16: make the remaining spend OR visits clear. Spend remains
 * the primary sentence. The optional alternative is read ONLY from a real
 * standing's guaranteed paid-day count; it is never a conversion from spend
 * at the measured basket. The top rung has no visits door. The tier screen
 * explains the rolling window and distinct paid Amman days beside the count.
 *
 * ── WHY IT PREFERS THE BALANCE'S OWN `nextTier` ─────────────────────────────
 *
 * `progressToNextTier(windowSpend)` is a projection over SPEND ALONE. It cannot
 * see the 4-visits door (config.TIER2_VISITS_ALTERNATIVE) and it cannot see the
 * floor a ratcheted member holds, so on its own it tells a member with 4
 * visit-days and 12 JOD that they are 2 visits from the 4% rung they are
 * ALREADY BEING PAID AT. `balance.nextTier` comes from `standing()` in
 * loyalty/window.ts, which knows both. The projection stays as the fallback for
 * the producers that genuinely have nothing else (a guest figure, the website).
 *
 * ── WHY THE ×2 IS ON ONE KEY AND THE ×1.5 IS ON NONE ────────────────────────
 *
 * Approved copy rule: «المضاعف ×2 يُذكر مرة واحدة فقط — عند الترقية إلى 4%.
 * تكراره يُفقده أثره» — the multiplier is said exactly once, at the promotion to
 * 4%; repeating it spends it. Selecting on `next.id` makes that structural
 * rather than editorial: `loyalty.toPlus` is the only key carrying ×2 and it is
 * only reachable when the next rung IS `plus`. C9 in bff/test/copy.test.ts pins
 * it, and the second step's real value (×1.5) is never spoken at all.
 */

export interface TierProgressCopy {
  /** Primary spend key. The optional paid-day alternative has its own key;
   *  no key presents the old basket-based visits projection as a target. */
  key: 'loyalty.toPlus' | 'loyalty.toTop';
  /** `jod` is ALREADY FORMATTED for `lang` — the caller interpolates it into a
   *  sentence and must not re-decide the decimals or the numerals. */
  params: { jod: string; tier: string };
  /** Present only for the real visits door, never a projected basket count. */
  visitsAlternative?: {
    key: 'loyalty.visitDaysAlternative';
    params: { count: number; visits: string; tier: string };
  };
  /** The rung being moved toward, for the caller's own styling. */
  next: Tier;
}

/** Only the fields the copy needs, so a caller can pass a whole
 *  `LoyaltyBalance` or the bare spend figure the website has. */
export type TierProgressInput = Pick<LoyaltyBalance, 'windowSpend'> &
  Partial<Pick<LoyaltyBalance, 'tier' | 'nextTier'>>;

const rungById = (id: TierId | string): Tier =>
  tiers.find((t) => t.id === id) ?? tiers[tiers.length - 1];

/**
 * The sentence, or `null` at the top of the ladder — where a progress bar with
 * no destination reads as a broken one.
 */
export function tierProgressCopy(
  balance: TierProgressInput,
  lang: Lang,
): TierProgressCopy | null {
  let next: Tier;
  let jodRemaining: number;

  if (balance.nextTier !== undefined) {
    // A real standing. `null` here MEANS the top rung — not "unknown".
    if (balance.nextTier === null) return null;
    next = rungById(balance.nextTier.id);
    jodRemaining = balance.nextTier.jodRemaining;
  } else {
    // No standing available. The held rung still settles the top of the
    // ladder, because a ratcheted member's spend cannot — and it must be
    // compared by POSITION, not against the last rung only: a member holding
    // `plus` by floor whose window rolled to 0 would otherwise be pointed at
    // the 4% rung they are already paid at, beside a badge reading 4%.
    const curIdx = tiers.findIndex((t) => t.id === balance.tier);
    const projected = progressToNextTier(balance.windowSpend);
    if (!projected) return null;
    if (curIdx >= 0 && tiers.findIndex((t) => t.id === projected.next.id) <= curIdx) return null;
    next = projected.next;
    jodRemaining = projected.jodRemaining;
  }

  // Rounded UP (formatJODNeeded): spending exactly the figure shown must reach
  // the rung. Rounded to nearest, 18.512 read 18.51 and left the member on
  // 19.998 at 2% (review of PRs #103 and #104, item 5).
  const params = { jod: formatJODNeeded(jodRemaining, lang), tier: tierName(next, lang) };
  const actual = balance.nextTier;
  const visitsAlternative: TierProgressCopy['visitsAlternative'] =
    next.id === tiers[1].id && actual?.visitsGuaranteed === true &&
    Number.isInteger(actual.visitsRemaining) && actual.visitsRemaining > 0
      ? {
          key: 'loyalty.visitDaysAlternative',
          params: {
            count: actual.visitsRemaining,
            visits: formatNumber(actual.visitsRemaining, lang),
            tier: params.tier,
          },
        }
      : undefined;
  // ×2 lives on this key and nowhere else — see the header. Selecting on
  // `next.id` keeps that structural rather than editorial, and the second
  // step's real value (×1.5) is never spoken at all.
  if (next.id === tiers[1].id) return { key: 'loyalty.toPlus', params, next, visitsAlternative };
  return { key: 'loyalty.toTop', params, next };
}
