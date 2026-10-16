import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cartLineFor, lineUnitPrice } from '@almond/shared/cart';
import { getMenu, resetMenuForTests, setMenu } from '@almond/shared/menu/store';
import type { CartCustomization, CartItem, MenuItem } from '@/types';
import { cartEditCollision, draftForCartLine, resolveCartEdit } from '@/lib/cartEdit';
import { useCartStore, computeTotals } from '@/stores/cartStore';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));

// A feed fixture with independently removable sizes, groups and options.
// Every Save exercises the real persisted cart action, not a parallel mock.
const drink: MenuItem = {
  id: 'cart-edit-drink', categoryId: 'coffee', nameAr: 'لاتيه', nameEn: 'Latte', emoji: '', inStock: true, isDrink: true,
  sizes: [
    { id: 'S', nameAr: 'صغير', nameEn: 'Small', price: 2 },
    { id: 'M', nameAr: 'وسط', nameEn: 'Medium', price: 3 },
    { id: 'L', nameAr: 'كبير', nameEn: 'Large', price: 4 },
  ],
  customizations: [
    { id: 'milk', nameAr: 'الحليب', nameEn: 'Milk', multiple: false, options: [
      { id: 'whole', nameAr: 'حليب كامل', nameEn: 'Whole milk', priceDelta: 0 },
      { id: 'oat', nameAr: 'حليب شوفان', nameEn: 'Oat milk', priceDelta: 0.5 },
    ] },
    { id: 'extras', nameAr: 'إضافات', nameEn: 'Extras', multiple: true, options: [
      { id: 'shot', nameAr: 'شوت إضافي', nameEn: 'Extra shot', priceDelta: 0.6 },
      { id: 'vanilla', nameAr: 'فانيلا', nameEn: 'Vanilla', priceDelta: 0.4 },
    ] },
  ],
};
const pairing: MenuItem = {
  id: 'cart-edit-pairing', categoryId: 'coffee', nameAr: 'كرواسون', nameEn: 'Croissant', emoji: '',
  sizes: [{ id: 'M', nameAr: 'عادي', nameEn: 'Regular', price: 2.5 }], customizations: [],
};
const choices = (...ids: string[]): CartCustomization[] => drink.customizations.flatMap((g) =>
  g.options.filter((o) => ids.includes(o.id)).map((o) => ({ groupId: g.id, optionId: o.id, nameAr: o.nameAr, nameEn: o.nameEn, priceDelta: o.priceDelta })),
);
let version = 0;
function menu(items: MenuItem[] = [drink, pairing]) {
  setMenu({ schema: 1, version: `edit-${++version}`, updatedAt: '2026-10-16', categories: [{ id: 'coffee', nameAr: 'القهوة', nameEn: 'Coffee' }], items }, 'server');
}
const line = (qty = 2, ids = ['oat', 'shot', 'vanilla']) => cartLineFor(drink, drink.sizes[1], choices(...ids), qty);
const put = (...items: CartItem[]) => useCartStore.setState({ items });
const save = (original: CartItem, draft = draftForCartLine(original), price = lineUnitPrice(original)) => {
  const resolved = resolveCartEdit(getMenu().items.find((m) => m.id === original.itemId), draft).line;
  const collision = resolved ? cartEditCollision(useCartStore.getState().items, original, resolved) : null;
  return useCartStore.getState().editLine(original, draft, price, collision);
};

beforeEach(() => {
  resetMenuForTests();
  menu();
  useCartStore.setState({ items: [], orderType: 'pickup', branchId: 'saved-branch', branchNames: { nameAr: 'الفرع', nameEn: 'Branch' }, branchPinned: true, branchNotice: null, paymentMethod: 'visa', paidFromBalance: false, promoCode: 'SAVED', promoDiscount: 0.7, curbside: true, carInfo: 'Blue car' });
});
afterEach(resetMenuForTests);

describe('editing the configured line the customer chose', () => {
  it('preloads size, every option and quantity without sharing mutable draft choices', () => {
    const original = line(7);
    const draft = draftForCartLine(original);
    expect(draft).toEqual({ sizeId: 'M', customizations: original.customizations, qty: 7 });
    draft.customizations[0].nameEn = 'Draft only';
    draft.customizations.pop();
    expect(original.customizations).toHaveLength(3);
    expect(original.customizations[0].nameEn).toBe('Oat milk');
    // A quick-add line with no choices must not gain the first radio option.
    expect(draftForCartLine(line(1, [])).customizations).toEqual([]);
  });

  it('replaces once at the new quantity and signature; keeps pairings and checkout preferences', () => {
    const original = line();
    const companion = cartLineFor(pairing, pairing.sizes[0], [], 1);
    put(original, companion);
    const before = useCartStore.getState();
    let updates = 0;
    const unsubscribe = useCartStore.subscribe(() => { updates++; });
    const result = save(original, { sizeId: 'L', customizations: choices('whole', 'shot'), qty: 3 }, 4.6);
    unsubscribe();
    expect(result.saved).toBe(true);
    const after = useCartStore.getState();
    expect(updates).toBe(1);
    expect(after.items).toHaveLength(2);
    expect(after.items[0]).toMatchObject({ lineId: 'cart-edit-drink__L__extras:shot|milk:whole', qty: 3, unitBasePrice: 4 });
    expect(after.items[1]).toBe(companion);
    expect(computeTotals(after.items, 0).subtotal).toBeCloseTo(3 * 4.6 + 2.5);
    const { items: _beforeItems, ...preferencesBefore } = before;
    const { items: _afterItems, ...preferencesAfter } = after;
    expect(preferencesAfter).toEqual(preferencesBefore);
  });

  it('replaces quantity on an unchanged signature instead of appending that quantity', () => {
    const original = line(5);
    put(original);
    expect(save(original, { ...draftForCartLine(original), qty: 2 }).saved).toBe(true);
    expect(useCartStore.getState().items).toEqual([{ ...original, qty: 2 }]);
  });

  it('merges an identical destination once, independently of option order, without capping accumulated quantity', () => {
    const original = line(2, ['whole']);
    const destination = line(99, ['oat', 'shot']);
    put(original, destination);
    const draft = { sizeId: 'M' as const, customizations: choices('oat', 'shot').reverse(), qty: 3 };
    expect(save(original, draft, 4.1).saved).toBe(true);
    expect(useCartStore.getState().items).toHaveLength(1);
    const merged = useCartStore.getState().items[0];
    expect(merged.qty).toBe(102);
    expect(merged.lineId).toBe(destination.lineId);
    expect(computeTotals([merged], 0).subtotal).toBeCloseTo(102 * 4.1);
    expect(save(merged).saved).toBe(true);
    expect(useCartStore.getState().items[0].qty).toBe(102);
  });

  it('keeps differently configured versions of the same product separate', () => {
    const original = line(2, ['whole']);
    const other = line(4, ['oat']);
    put(original, other);
    expect(save(original, { sizeId: 'L', customizations: choices('whole'), qty: 1 }, 4).saved).toBe(true);
    expect(useCartStore.getState().items).toHaveLength(2);
    expect(useCartStore.getState().items[1]).toBe(other);
  });

  it('quotes the full merged quantity at current prices before repricing existing destination units', () => {
    const original = cartLineFor(drink, drink.sizes[0], [], 2);
    const destination = line(3, []);
    put(original, destination);
    menu([{ ...drink, sizes: drink.sizes.map((s) => s.id === 'M' ? { ...s, price: 4 } : s) }, pairing]);
    const draft = { sizeId: 'M' as const, customizations: [], qty: 2 };
    const shown = resolveCartEdit(getMenu().items.find((m) => m.id === drink.id), draft).line!;
    const collision = cartEditCollision(useCartStore.getState().items, original, shown);
    expect(collision).toEqual({ lineId: destination.lineId, destinationQty: 3, destinationUnitPrice: 3, mergedQty: 5, unitPrice: 4, total: 20 });
    // Showing only the edited 2 × 4 would conceal repricing 3 × 3 to 3 × 4.
    expect(useCartStore.getState().editLine(original, draft, 4, null)).toEqual({ saved: false, issue: 'mergeChanged' });
    expect(useCartStore.getState().items).toEqual([original, destination]);
    expect(useCartStore.getState().editLine(original, draft, 4, collision).saved).toBe(true);
    expect(useCartStore.getState().items).toEqual([{ ...shown, qty: 5 }]);
    expect(computeTotals(useCartStore.getState().items, 0).subtotal).toBe(20);
  });

  it.each(['quantity', 'price', 'removed', 'appeared'] as const)('rejects a stale collision notice when the destination %s changes', (change) => {
    const original = cartLineFor(drink, drink.sizes[0], [], 2);
    const destination = line(3, []);
    put(original, ...(change === 'appeared' ? [] : [destination]));
    const draft = { sizeId: 'M' as const, customizations: [], qty: 2 };
    const shown = resolveCartEdit(drink, draft).line!;
    const collision = cartEditCollision(useCartStore.getState().items, original, shown);
    if (change === 'quantity') useCartStore.getState().incLine(destination.lineId);
    if (change === 'price') put(original, { ...destination, unitBasePrice: 4 });
    if (change === 'removed') useCartStore.getState().removeLine(destination.lineId);
    if (change === 'appeared') useCartStore.getState().addLine(destination);
    const beforeSave = useCartStore.getState().items;
    expect(useCartStore.getState().editLine(original, draft, 3, collision)).toEqual({ saved: false, issue: 'mergeChanged' });
    expect(useCartStore.getState().items).toBe(beforeSave);
    // The live cart's updated notice is sufficient for a subsequent Save.
    const refreshed = cartEditCollision(beforeSave, original, shown);
    expect(useCartStore.getState().editLine(original, draft, 3, refreshed).saved).toBe(true);
  });

  it('cannot recreate a removed source or overwrite quantity changed while the sheet was open', () => {
    const original = line();
    put(original);
    useCartStore.getState().incLine(original.lineId);
    const changed = useCartStore.getState().items;
    expect(save(original)).toEqual({ saved: false, issue: 'lineChanged' });
    expect(useCartStore.getState().items).toBe(changed);
    useCartStore.getState().removeLine(original.lineId);
    expect(save(original)).toEqual({ saved: false, issue: 'lineChanged' });
    expect(useCartStore.getState().items).toEqual([]);
  });
});

describe('a changing menu never silently changes the customer’s choices', () => {
  it.each(['removed', 'sold out'] as const)('keeps the cart when the product is %s', (availability) => {
    const original = line();
    put(original);
    menu(availability === 'removed' ? [pairing] : [{ ...drink, inStock: false }, pairing]);
    expect(save(original)).toEqual({ saved: false, issue: 'itemUnavailable' });
    expect(useCartStore.getState().items).toEqual([original]);
  });

  it('does not fall back from a deleted size; the customer can select a replacement explicitly', () => {
    const original = line();
    put(original);
    menu([{ ...drink, sizes: [drink.sizes[2]] }, pairing]);
    expect(save(original)).toEqual({ saved: false, issue: 'sizeUnavailable' });
    expect(useCartStore.getState().items[0]).toBe(original);
    expect(save(original, { ...draftForCartLine(original), sizeId: 'L' }, 5.5).saved).toBe(true);
    expect(useCartStore.getState().items[0]).toMatchObject({ sizeId: 'L', qty: 2, unitBasePrice: 4 });
  });

  it.each(['option', 'group'] as const)('retains a removed %s until explicit removal, preserving all other choices', (removed) => {
    const original = line();
    put(original);
    const updated = { ...drink, customizations: removed === 'group'
      ? drink.customizations.filter((g) => g.id !== 'milk')
      : drink.customizations.map((g) => ({ ...g, options: g.options.filter((o) => o.id !== 'oat') })) };
    menu([updated, pairing]);
    const draft = draftForCartLine(original);
    const resolved = resolveCartEdit(updated, draft);
    expect(resolved.unavailable).toEqual(choices('oat'));
    expect(save(original, draft)).toEqual({ saved: false, issue: 'optionsUnavailable' });
    expect(useCartStore.getState().items[0]).toBe(original);
    draft.customizations = draft.customizations.filter((c) => c.optionId !== 'oat');
    expect(save(original, draft, 4).saved).toBe(true);
    expect(useCartStore.getState().items[0].customizations).toEqual(choices('shot', 'vanilla'));
  });

  it('does not silently choose one option when a multi-choice group becomes single-choice', () => {
    const original = line();
    put(original);
    menu([{ ...drink, customizations: drink.customizations.map((g) => ({ ...g, multiple: false })) }, pairing]);
    expect(save(original)).toEqual({ saved: false, issue: 'optionsChanged' });
    expect(useCartStore.getState().items[0]).toBe(original);
    expect(save(original, { ...draftForCartLine(original), customizations: choices('oat', 'shot') }, 4.1).saved).toBe(true);
  });

  it('rejects an unseen new price, then saves the reviewed current menu price and names', () => {
    const original = line();
    put(original);
    const updated = structuredClone(drink);
    updated.nameEn = 'Current latte';
    updated.sizes[1].price = 3.7;
    updated.customizations[0].options[1].priceDelta = 0.8;
    updated.customizations[0].options[1].nameEn = 'Current oat milk';
    menu([updated, pairing]);
    const draft = draftForCartLine(original);
    expect(save(original, draft)).toEqual({ saved: false, issue: 'menuChanged' });
    expect(useCartStore.getState().items[0]).toBe(original);
    const shown = resolveCartEdit(getMenu().items.find((m) => m.id === drink.id), draft).line!;
    expect(lineUnitPrice(shown)).toBeCloseTo(5.5);
    expect(save(original, draft, lineUnitPrice(shown)).saved).toBe(true);
    const saved = useCartStore.getState().items[0];
    expect(saved.nameEn).toBe('Current latte');
    expect(saved.customizations.find((c) => c.optionId === 'oat')).toMatchObject({ nameEn: 'Current oat milk', priceDelta: 0.8 });
    expect(computeTotals([saved], 0).subtotal).toBeCloseTo(11);
  });

  it.each([0, -1, 0.5, NaN, Infinity])('keeps the cart when a draft quantity is invalid (%s)', (qty) => {
    const original = line();
    put(original);
    expect(save(original, { ...draftForCartLine(original), qty })).toEqual({ saved: false, issue: 'quantityInvalid' });
    expect(useCartStore.getState().items[0]).toBe(original);
  });

  it('does not commit a configuration without a positive price', () => {
    const original = line(1, []);
    put(original);
    menu([{ ...drink, sizes: drink.sizes.map((s) => ({ ...s, price: 0 })) }, pairing]);
    expect(save(original)).toEqual({ saved: false, issue: 'unpriced' });
    expect(useCartStore.getState().items[0]).toBe(original);
  });
});
