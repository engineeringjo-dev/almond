import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cartLineFor } from '@almond/shared/cart';
import { canReorderSizes, menuItems, resolveItemSize } from '@almond/shared/menu';
import { getSizeUpsell } from '@almond/shared/lib/recommendations';
import { resetMenuForTests } from '@almond/shared/menu/store';
import { resolveCartEdit, draftForCartLine } from '@/lib/cartEdit';
import { useCartStore } from '@/stores/cartStore';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));

const cake = menuItems.find((item) => item.id === 'p-10307')!;
const safe = cartLineFor(cake, cake.sizes[0], [], 2);
// A real old cart could hold either name/price under the same legacy L.
const larger = cartLineFor(cake, cake.sizes.find((size) => size.nameEn === '25 (تواصي)')!, [], 1);
const firstLarge = cartLineFor(cake, cake.sizes.find((size) => size.id === 'L')!, [], 1);

beforeEach(() => { resetMenuForTests(); useCartStore.setState({ items: [safe] }); });
afterEach(resetMenuForTests);

describe('saved sizes require a current unambiguous choice', () => {
  it.each([larger, firstLarge])('does not silently edit legacy L to the first L ($sizeNameEn)', (saved) => {
    expect(resolveCartEdit(cake, draftForCartLine(saved))).toMatchObject({ line: null, issue: 'sizeUnavailable' });
    expect(resolveCartEdit(cake, { ...draftForCartLine(saved), sizeId: 'M' }).line).toMatchObject({ sizeId: 'M', unitBasePrice: 20 });
  });

  it('reorders none of a mixed safe/ambiguous order and preserves the current cart', () => {
    const before = useCartStore.getState().items;
    let updates = 0;
    const unsubscribe = useCartStore.subscribe(() => { updates++; });
    expect(useCartStore.getState().addOrder([safe, larger])).toBe(false);
    unsubscribe();
    expect(useCartStore.getState().items).toBe(before);
    expect(updates).toBe(0);
    expect(canReorderSizes([safe, larger], menuItems)).toBe(false);
  });

  it('also refuses unknown item and unknown size instead of dropping them', () => {
    expect(useCartStore.getState().addOrder([safe, { ...larger, itemId: 'gone' }])).toBe(false);
    const regular = menuItems.find((item) => item.sizes.length === 1 && item.sizes[0].id === 'M')!;
    expect(useCartStore.getState().addOrder([{ ...safe, itemId: regular.id, sizeId: 'S' }])).toBe(false);
    expect(useCartStore.getState().items).toEqual([safe]);
  });

  it('reorders all safe S/M lines once, merging quantity without changing size identity', () => {
    const medium = cartLineFor(cake, resolveItemSize(cake, 'M')!, [], 3);
    expect(useCartStore.getState().addOrder([safe, medium])).toBe(true);
    expect(useCartStore.getState().items).toEqual([{ ...safe, qty: 4 }, medium]);
  });

  it('never upsells from or to an unavailable L identity', () => {
    expect(getSizeUpsell(cake, 'S')?.size.id).toBe('M');
    expect(getSizeUpsell(cake, 'M')).toBeNull();
    expect(getSizeUpsell(cake, 'L')).toBeNull();
  });
});
