import type { Lang, LoyaltyBalance, Tier, TierId } from '@/types';
import { progressToNextTier, tierName, tiers } from '@almond/shared/loyalty';

/**
 * THE ONE PLACE THAT DECIDES WHICH PROGRESS SENTENCE A MEMBER SEES.
 *
 * The whole tier mechanic rests on one line of copy, and the brief is explicit
 * about its unit: «باقي لك 3 زيارات ويتضاعف خصمك ×2» — "3 more visits and your
 * cashback DOUBLES". "20 JOD in 90 days" is not a sayable sentence; "3 more
 * visits" is. Three screens rendered three different versions of it (the home
 * card, the /loyalty ladder and the rewards carousel), all three in dinars, and
 * all three gated on `remaining <= 30` — a threshold 1.5× LARGER than the whole
 * 20 JOD it was meant to be near, so every member was told "One step away" from
 * zero spend. One function, three call sites, one sentence.
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
 * ── WHY SOME SENTENCES PROMISE AND OTHERS HEDGE ─────────────────────────────
 *
 * Only the second rung has a visits DOOR (config.TIER2_VISITS_ALTERNATIVE): N
 * more qualifying days promotes the member at any basket size. Above it the
 * only route is 65 JOD of spend, so a visit count there is a projection at the
 * measured 5.85 JOD basket and nothing honours it — a member on 60 JOD who is
 * told "just one more visit" and returns for a 2.50 JOD americano is still paid
 * 4%. The producer says which it handed us (`visitsGuaranteed`), and an ABSENT
 * flag is read as NOT guaranteed, so the hedged sentence is the default and a
 * promise has to be earned.
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
  /** An i18n key that exists in BOTH locale files — C11 asserts that.
   *  `toPlus` / `oneVisitLeft` state a count the door guarantees; `toTop` /
   *  `nearlyNext` hedge one that only a projection supports. */
  key: 'loyalty.toPlus' | 'loyalty.toTop' | 'loyalty.oneVisitLeft' | 'loyalty.nearlyNext';
  params: { visits: number; tier: string };
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
  let visits: number;
  let guaranteed: boolean;

  if (balance.nextTier !== undefined) {
    // A real standing. `null` here MEANS the top rung — not "unknown".
    if (balance.nextTier === null) return null;
    next = rungById(balance.nextTier.id);
    visits = balance.nextTier.visitsRemaining;
    guaranteed = balance.nextTier.visitsGuaranteed === true;
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
    visits = projected.visitsRemaining;
    guaranteed = projected.visitsGuaranteed;
  }

  const params = { visits, tier: tierName(next, lang) };
  if (guaranteed) {
    // One visit left is its own sentence in both languages: "1 more visits" and
    // «باقي لك 1 زيارات» are both wrong, and this is the moment worth a nudge.
    if (visits <= 1) return { key: 'loyalty.oneVisitLeft', params, next };
    // ×2 lives here and nowhere else — see the header.
    if (next.id === tiers[1].id) return { key: 'loyalty.toPlus', params, next };
  }
  // Not guaranteed: the count is a projection, and both of these keys say so
  // in words ("about", "could"). Never `oneVisitLeft` and never `toPlus` — a
  // hedged ×2 is still a ×2 the member will hold us to.
  if (visits <= 1) return { key: 'loyalty.nearlyNext', params, next };
  return { key: 'loyalty.toTop', params, next };
}
