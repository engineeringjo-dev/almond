import type { Lang, LoyaltyBalance, Tier, TierId } from '@/types';
import { progressToNextTier, tierName, tiers } from '@almond/shared/loyalty';
import { formatJOD } from '@almond/shared/lib/format';

/**
 * THE ONE PLACE THAT DECIDES WHICH PROGRESS SENTENCE A MEMBER SEES.
 *
 * 🔴 THE UNIT IS SPEND, AND THAT REVERSES AN EARLIER DECISION ON PURPOSE.
 *
 * Owner, 2026-09-08: «مش عالزيارات بدي spend more هلقد قبل هلقظ وبتنتقل لشريحة
 * ٤% كاشباك» — not visits; say how much more to SPEND to reach 4%.
 *
 * It was visits, from the brief's «باقي لك 3 زيارات ويتضاعف خصمك ×2», on the
 * argument that "20 JOD in 90 days" is not a sayable sentence. What that
 * argument missed is that the visits number was never true: above the second
 * rung there is no visits door at all, so the count was a PROJECTION at the
 * measured 5.85 JOD basket, and a member on 60 JOD told "1 more visit" who
 * returned for a 2.50 JOD americano landed at 62.5 and was still paid 4%. The
 * hedging that existed to cover that (`visitsGuaranteed`, "about", "could") was
 * a way of half-saying a number we could not stand behind.
 *
 * `jodRemaining` has no such problem. It is `threshold − windowSpend`: exact at
 * every rung, on both code paths, with nothing projected. So the sentence gets
 * SHORTER and the hedging is gone rather than reworded.
 *
 * ONE THING IT UNDERSTATES, deliberately. The second rung has a second door —
 * TIER2_VISITS_ALTERNATIVE qualifying days — so a member can arrive there
 * without spending the remaining dinars. Naming the spend is therefore
 * conservative: it never promises a rung the member will not get, it only omits
 * a shortcut they may stumble into. The reverse error (naming the shortcut and
 * missing the spend) is the one that produces a complaint.
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
  /** An i18n key that exists in BOTH locale files — C11 asserts that. Two keys
   *  now, not four: with an exact figure there is nothing to hedge, so the
   *  `oneVisitLeft` / `nearlyNext` pair that softened a projection is gone. */
  key: 'loyalty.toPlus' | 'loyalty.toTop';
  /** `jod` is ALREADY FORMATTED for `lang` — the caller interpolates it into a
   *  sentence and must not re-decide the decimals or the numerals. */
  params: { jod: string; tier: string };
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

  const params = { jod: formatJOD(jodRemaining, lang), tier: tierName(next, lang) };
  // ×2 lives on this key and nowhere else — see the header. Selecting on
  // `next.id` keeps that structural rather than editorial, and the second
  // step's real value (×1.5) is never spoken at all.
  if (next.id === tiers[1].id) return { key: 'loyalty.toPlus', params, next };
  return { key: 'loyalty.toTop', params, next };
}
