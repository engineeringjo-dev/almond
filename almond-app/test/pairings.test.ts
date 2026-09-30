import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { addSheetToCart, quickAdd, quickAddPrice, sheetTotal, togglePairing } from '@/lib/pairings';
import { getComboUpsell, getItemPairings } from '@/lib/recommendations';
import { useCartStore, computeTotals } from '@/stores/cartStore';
import { menuItems } from '@almond/shared/menu';
import { itemKind } from '@almond/shared/lib/categoryKind';

/**
 * P1-P3 — «يُطلب عادةً مع»: A PAIRING IS ADDED ONCE, AT THE PRICE THE BUTTON SAID.
 *
 * Measured before this fix: two taps on «كرواسون باللوز» put two croissants in
 * the cart while the sheet's button still read the drink alone (10.200 JOD
 * shown, 15.700 JOD in the cart). These are outcome tests against the real
 * cart store: what the customer is charged versus what they were shown.
 */

// A real drink from the bundled menu that has pairings — no hand-built fixture.
const drink = menuItems.find(
  (m) => itemKind(m.id) === 'drink' && m.sizes.length > 0 && getItemPairings(m, 4).length >= 2,
);

// The real cart store persists through AsyncStorage, whose web build wants a
// window.localStorage — the same shim comboOffer.test.ts uses.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}
beforeAll(() => {
  (globalThis as unknown as { window: unknown }).window = { localStorage: new MemoryStorage() };
});

beforeEach(() => {
  useCartStore.getState().clear();
});

describe('P1 a chip toggles; it never adds by itself', () => {
  it('a second tap takes the pairing back off', () => {
    const once = togglePairing([], 'p-1');
    expect(once).toEqual(['p-1']);
    expect(togglePairing(once, 'p-1')).toEqual([]);
  });

  it('any number of taps stages a pairing at most once', () => {
    let staged: string[] = [];
    for (let i = 0; i < 7; i++) staged = togglePairing(staged, 'p-1');
    expect(staged).toEqual(['p-1']);
  });
});

describe('P2 «أضف للسلة» adds what the button totalled — no more, no less', () => {
  it('found a drink with pairings to test against', () => {
    expect(drink, 'no drink in the bundled menu has pairings').toBeDefined();
  });

  it('the cart subtotal equals the CTA total, with each staged pairing once', () => {
    if (!drink) return;
    const [a, b] = getItemPairings(drink, 4);
    const size = drink.sizes[0];
    const qty = 2;
    const staged = [a, b];

    const shown = sheetTotal(size.price, qty, staged);
    addSheetToCart(useCartStore.getState().addItem, { item: drink, size, customizations: [], qty }, staged);

    const items = useCartStore.getState().items;
    expect(items.find((l) => l.itemId === a.id)?.qty).toBe(1);
    expect(items.find((l) => l.itemId === b.id)?.qty).toBe(1);
    expect(items.find((l) => l.itemId === drink.id)?.qty).toBe(qty);
    expect(computeTotals(items, 0).subtotal).toBeCloseTo(shown, 6);
  });

  it('with nothing staged, only the item goes in', () => {
    if (!drink) return;
    addSheetToCart(useCartStore.getState().addItem, { item: drink, size: drink.sizes[0], customizations: [], qty: 1 }, []);
    expect(useCartStore.getState().items.map((l) => l.itemId)).toEqual([drink.id]);
  });
});

describe('P3 the chip quotes the price the cart will charge', () => {
  it('quickAddPrice is the first size — the size a one-tap add uses', () => {
    for (const item of menuItems.slice(0, 200)) {
      if (item.sizes.length === 0) continue;
      expect(quickAddPrice(item), item.id).toBe(item.sizes[0].price);
    }
  });
});

describe('P4 the cart combo banner charges exactly what it names', () => {
  it('one tap adds the named item, once, at the price on the banner', () => {
    if (!drink) return;
    const { addItem } = useCartStore.getState();
    addItem(drink, drink.sizes[0], [], 1);
    const upsell = getComboUpsell(useCartStore.getState().items);
    expect(upsell, 'a lone drink should be offered the food half of the combo').not.toBeNull();
    if (!upsell) return;

    const before = computeTotals(useCartStore.getState().items, 0).subtotal;
    quickAdd(addItem, upsell.item);
    const items = useCartStore.getState().items;
    const added = items.filter((l) => l.itemId === upsell.item.id);

    expect(added).toHaveLength(1);
    expect(added[0].qty).toBe(1);
    expect(added[0].nameAr).toBe(upsell.item.nameAr);
    expect(computeTotals(items, 0).subtotal - before).toBeCloseTo(quickAddPrice(upsell.item), 6);
  });
});
