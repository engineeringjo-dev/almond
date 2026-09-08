import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { comboOfferCopy } from '@/lib/comboOffer';
import { config } from '@/constants/config';
import { useCartStore } from '@/stores/cartStore';
import { getComboStarter } from '@almond/shared/lib/recommendations';
import { comboPairs } from '@almond/shared/lib/combo';
import { itemKind } from '@almond/shared/lib/categoryKind';
import { menuItems } from '@almond/shared/menu';

/**
 * O1-O5 — THE COMBO OFFER ON THE OFFERS PAGE.
 *
 * Until this package the drink+food bonus existed on exactly one surface:
 * `components/cart/CrossSellRow.tsx`, which renders only when the basket
 * already holds one half of the pair. The offer was therefore visible only to a
 * member who had already half-earned it by accident, and the owner went looking
 * for it on the offers page and could not find it.
 *
 * Two of these groups exist because of a defect that actually shipped, not
 * because of a hypothesis:
 *
 *   O2 — the cart banner's label read "50 points" as a hard literal while
 *        `config.COMBO_BONUS_POINTS` was 25. Two days of the app promising
 *        twice what the server granted, in both languages, with the whole suite
 *        green. Every assertion in O2 fails if the count stops following the
 *        dial. (C14 in bff/test/copy.test.ts holds the same line structurally,
 *        over the sources and the locale files.)
 *   O1 — the card's one tap builds a basket. If that basket does not satisfy
 *        `comboPairs()` — the same function the SERVER prices the grant with —
 *        the card promises points the checkout will not pay. So O1 asserts the
 *        suggestion against the real classifier and the real cart store, not
 *        against a hand-built fixture.
 *
 * Outcome tests, in the style of C8/P1: what a member is shown and what lands
 * in their basket, never which branch ran.
 */

// The real cart store persists through AsyncStorage; its web build wants a
// window.localStorage. Same shim promotion.test.ts uses, for the same reason —
// so the code path under test is the app's, not a re-implementation of it.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}
const disk = new MemoryStorage();
beforeAll(() => {
  (globalThis as unknown as { window: unknown }).window = { localStorage: disk };
});

const locale = (lang: 'ar' | 'en'): Record<string, Record<string, string>> =>
  JSON.parse(readFileSync(join(__dirname, '..', 'locales', `${lang}.json`), 'utf8'));

/** Resolve a key the way i18next would, so a missing entry is visible here. */
const value = (lang: 'ar' | 'en', key: string): string | undefined => {
  const [ns, k] = key.split('.');
  return locale(lang)[ns]?.[k];
};

// ---------------------------------------------------------------------------
// O1 — the suggested pair is a pair the SERVER will pay the bonus on.
// ---------------------------------------------------------------------------
describe('O1 the cold-start pair', () => {
  it('exists at all on the shipped menu', () => {
    const s = getComboStarter();
    expect(s, 'the offers card has no pair to suggest').not.toBeNull();
  });

  it('is one drink and one food, by the SAME classifier the grant uses', () => {
    // `itemKind`, not `item.isDrink`. The two disagree on 14 of 83 records —
    // seven 250 g retail bags, a V60 dripper, PAPER FILTERS, three granola cups
    // and a chia pudding — and `comboPairs` counts with `itemKind`. Suggesting
    // a pair the pricing function would not count is the whole failure mode.
    const s = getComboStarter()!;
    expect(itemKind(s.drink.id)).toBe('drink');
    expect(itemKind(s.food.id)).toBe('food');
  });

  it('has a real price on both halves, and unpriced rows exist to get it wrong with', () => {
    // 30 of the 267 shipped items are priced 0.000 — price-on-request rows in
    // the Talabat export. A card whose claim is "you pay the FULL PRICE of
    // both" cannot suggest a half with no price to pay, and a "cheapest" rule
    // without a price floor picks exactly those rows.
    //
    // Stated honestly: the floor does NOT bind on today's menu. The unpriced
    // foods tie on relevance with the croissants that fill the candidate
    // window and are held out of it only by menu order. Both halves of that
    // are asserted, so the day a menu reorder makes the floor load-bearing,
    // this test is already watching the right thing.
    const unpriced = menuItems.filter((m) => Math.min(...m.sizes.map((z) => z.price)) === 0);
    expect(unpriced.length, 'no unpriced rows — the floor guards nothing').toBe(30);
    expect(unpriced.some((m) => itemKind(m.id) === 'food')).toBe(true);

    const s = getComboStarter()!;
    expect(s.drinkSize.price).toBeGreaterThan(0);
    expect(s.foodSize.price).toBeGreaterThan(0);
    // The size offered is the cheapest PRICED size of that item, which is what
    // the reasoning behind the suggestion priced.
    const cheapest = (sizes: { price: number }[]) =>
      Math.min(...sizes.filter((x) => x.price > 0).map((x) => x.price));
    expect(s.drinkSize.price).toBe(cheapest(s.drink.sizes));
    expect(s.foodSize.price).toBe(cheapest(s.food.sizes));
  });

  it('is within reach of the basket a member actually buys', () => {
    // MEASURED member basket: 5.85 JOD. Ranking by relevance alone returns
    // Iced Ruby Latte (3.950) + Avocado & Nabulsi Croissant (4.900) = 8.850 —
    // 51% above it. The combo bonus is a FLAT grant on any pair, so a dearer
    // suggestion is strictly worse value AND less likely to be taken, and the
    // card's whole purpose is to raise the share of invoices that pair.
    const s = getComboStarter()!;
    const total = s.drinkSize.price + s.foodSize.price;
    expect(total).toBeLessThanOrEqual(5.85);
    // ... and not degenerate: it is still a real drink and a real food, not the
    // cheapest two rows on the menu (0.750 mineral water and a 0.000 cake).
    expect(total).toBeGreaterThan(2);
  });

  it('is the same pair on every device and in every process', () => {
    // The menu is static and the ranking is a total order with a stable
    // tie-break, so two members comparing screens see the same suggestion.
    const a = getComboStarter()!;
    const b = getComboStarter()!;
    expect([a.drink.id, a.drinkSize.id, a.food.id, a.foodSize.id])
      .toEqual([b.drink.id, b.drinkSize.id, b.food.id, b.foodSize.id]);
  });

  it('94% of the menu can pair, which is why the card suggests instead of filtering', () => {
    // The number behind the design decision, pinned so a menu change that
    // invalidated it would be seen. 267 items: 69 drink, 182 food, 16 other.
    const kinds = menuItems.map((m) => itemKind(m.id));
    const pairable = kinds.filter((k) => k !== 'other').length;
    expect(menuItems.length).toBe(267);
    expect(kinds.filter((k) => k === 'drink').length).toBe(69);
    expect(kinds.filter((k) => k === 'food').length).toBe(182);
    // A "combo-eligible" menu filter would remove 16 of 267 items and hand the
    // member back the menu they were already looking at.
    expect(pairable / menuItems.length).toBeGreaterThan(0.93);
  });
});

// ---------------------------------------------------------------------------
// O2 — the points count follows the dial. THE DRIFT TEST.
// ---------------------------------------------------------------------------
describe('O2 the count is the config dial, never a literal', () => {
  it('interpolates whatever the dial says — including the value that drifted', () => {
    // 50 → 25 → 50 is the real history of COMBO_BONUS_POINTS. The cart label
    // said 50 throughout. Every one of these must differ.
    for (const points of [25, 50, 137]) {
      const c = comboOfferCopy(points, getComboStarter(), 'en')!;
      expect(c.params.points, `dial ${points}`).toBe(points);
    }
    const a = comboOfferCopy(25, null, 'en')!;
    const b = comboOfferCopy(50, null, 'en')!;
    expect(a.params).not.toEqual(b.params);
  });

  it('the shipped card states the shipped dial', () => {
    // earn-arith-exempt: asserting the LABEL against the dial — no invoice, no grant. §7 T7.
    const shipped = config.COMBO_BONUS_POINTS;
    expect(comboOfferCopy(shipped, getComboStarter(), 'ar')!.params.points).toBe(shipped);
  });

  it('neither locale value carries a digit — the number can only arrive interpolated', () => {
    // This is the shape that makes the drift impossible rather than merely
    // absent: a value with no digit in it cannot state a stale count, and a
    // value with {{points}} cannot state one silently.
    for (const lang of ['ar', 'en'] as const) {
      for (const key of ['offers.comboTitle', 'offers.comboBody']) {
        const v = value(lang, key)!;
        expect(v, `${lang} ${key} is missing`).toBeTruthy();
        expect(v, `${lang} ${key} must interpolate the count`).toContain('{{points}}');
        expect(/[0-9]/.test(v), `${lang} ${key} states a number as a literal: ${v}`).toBe(false);
      }
    }
  });

  it('a dial of zero removes the card rather than offering nothing', () => {
    // The points ARE the offer: BRUNCH_COMBO_DISCOUNT is 0 and the member pays
    // the full price of both halves, so at 0 points there is nothing on offer
    // and "= 0 points 🍽️" is worse than no card at all.
    expect(comboOfferCopy(0, getComboStarter(), 'en')).toBeNull();
    expect(comboOfferCopy(-5, getComboStarter(), 'en')).toBeNull();
    expect(comboOfferCopy(Number.NaN, getComboStarter(), 'en')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// O3 — cold copy: it reads with no basket, in both languages.
// ---------------------------------------------------------------------------
describe('O3 the copy assumes nothing about a basket', () => {
  it('names the example pair in the reader\'s own language', () => {
    const s = getComboStarter()!;
    const en = comboOfferCopy(config.COMBO_BONUS_POINTS, s, 'en')!;
    const ar = comboOfferCopy(config.COMBO_BONUS_POINTS, s, 'ar')!;
    expect(en.example!.params).toEqual({ drink: s.drink.nameEn, food: s.food.nameEn });
    expect(ar.example!.params).toEqual({ drink: s.drink.nameAr, food: s.food.nameAr });
    // Both names are real, non-empty menu strings — an item with a blank
    // Arabic name would render "مثلاً  + ".
    expect(ar.example!.params.drink.trim().length).toBeGreaterThan(0);
    expect(ar.example!.params.food.trim().length).toBeGreaterThan(0);
  });

  it('still explains the offer when the menu can suggest nothing', () => {
    // The offer is real whether or not a pair can be named, so the card
    // degrades to an explainer instead of vanishing over a data problem.
    const c = comboOfferCopy(config.COMBO_BONUS_POINTS, null, 'en')!;
    expect(c.example).toBeNull();
    expect(c.titleKey).toBe('offers.comboTitle');
    expect(c.bodyKey).toBe('offers.comboBody');
  });

  it('every key it returns resolves in BOTH languages', () => {
    const c = comboOfferCopy(config.COMBO_BONUS_POINTS, getComboStarter(), 'en')!;
    for (const key of [c.titleKey, c.bodyKey, c.example!.key, 'offers.comboCta']) {
      for (const lang of ['ar', 'en'] as const) {
        expect(value(lang, key), `${lang} ${key}`).toBeTruthy();
      }
    }
  });

  it('the body states the price honestly — full price, no discount', () => {
    // BRUNCH_COMBO_DISCOUNT has been 0 since 2026-09-04: the member pays both
    // full prices and the points are the entire offer. A card that implied a
    // price break would be the same class of defect as the earn-rate strings
    // W4 deleted, and it is the one claim on this card that costs real money if
    // it is wrong at the till.
    expect(config.BRUNCH_COMBO_DISCOUNT).toBe(0);
    expect(value('en', 'offers.comboBody')).toContain('full price');
    expect(value('ar', 'offers.comboBody')).toContain('كامل');
  });
});

// ---------------------------------------------------------------------------
// O4 — one tap builds a basket the grant actually pays on.
// ---------------------------------------------------------------------------
describe('O4 the basket the card builds', () => {
  beforeEach(() => { useCartStore.getState().clear(); });

  it('earns exactly one pair, through the real cart store and the real counter', () => {
    // The whole chain the button runs: addItem twice, then the same
    // comboPairs() bff/src/pricing.ts calls before computeEarn prices it.
    const s = getComboStarter()!;
    const { addItem } = useCartStore.getState();
    addItem(s.drink, s.drinkSize, [], 1);
    addItem(s.food, s.foodSize, [], 1);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(comboPairs(items), 'the suggested pair must count as a pair').toBe(1);
  });

  it('adds the priced size it advertised, not sizes[0]', () => {
    const s = getComboStarter()!;
    const { addItem } = useCartStore.getState();
    addItem(s.drink, s.drinkSize, [], 1);
    addItem(s.food, s.foodSize, [], 1);
    const items = useCartStore.getState().items;
    const total = items.reduce((sum, l) => sum + l.unitBasePrice * l.qty, 0);
    expect(total).toBeCloseTo(s.drinkSize.price + s.foodSize.price, 6);
    expect(items.every((l) => l.unitBasePrice > 0)).toBe(true);
  });

  it('half the pair alone earns nothing — which is why the card adds both', () => {
    // The cart banner could add ONE item because the basket already held the
    // other half. From Home there is no other half, so a card that added one
    // item would send the member to a cart that earns no bonus at all.
    const s = getComboStarter()!;
    useCartStore.getState().addItem(s.drink, s.drinkSize, [], 1);
    expect(comboPairs(useCartStore.getState().items)).toBe(0);
  });
});
