import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartCustomization, ItemSize, MenuItem } from '@almond/shared/types';

/**
 * Guards the website cart store (src/store/cartStore.ts) — the lines checkout
 * turns into an order: line merging by configuration, qty arithmetic, removing
 * a line at 0, wallet ⇒ paidFromBalance, and what `clear()` keeps.
 *
 * The store persists to localStorage; an in-memory Storage is stubbed on
 * `window` before each fresh import so the test is hermetic.
 */

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

let storage: Storage;
async function freshStore() {
  vi.resetModules();
  storage = memoryStorage();
  vi.stubGlobal('window', { localStorage: storage });
  return (await import('@/store/cartStore')).useCartStore;
}

const latte: MenuItem = {
  id: 'latte',
  categoryId: 'coffee',
  nameAr: 'لاتيه',
  nameEn: 'Latte',
  emoji: '☕',
  sizes: [
    { id: 'S', nameAr: 'صغير', nameEn: 'Small', price: 2.5 },
    { id: 'L', nameAr: 'كبير', nameEn: 'Large', price: 3.25 },
  ],
  customizations: [],
  isDrink: true,
  prepMinutes: 4,
};
const S = latte.sizes[0] as ItemSize;
const L = latte.sizes[1] as ItemSize;
const oat: CartCustomization = { groupId: 'milk', optionId: 'oat', nameAr: 'شوفان', nameEn: 'Oat', priceDelta: 0.35 };
const shot: CartCustomization = { groupId: 'extra', optionId: 'shot', nameAr: 'شوت', nameEn: 'Shot', priceDelta: 0.5 };

let store: Awaited<ReturnType<typeof freshStore>>;
beforeEach(async () => {
  store = await freshStore();
});

describe('addItem', () => {
  it('creates a line carrying price, flags and prep time from the item + size', () => {
    store.getState().addItem(latte, S, [oat], 2);
    const [l] = store.getState().items;
    expect(l).toMatchObject({
      itemId: 'latte',
      sizeId: 'S',
      unitBasePrice: 2.5,
      qty: 2,
      isDrink: true,
      prepMinutes: 4,
      customizations: [oat],
    });
  });

  it('merges the SAME configuration into one line, regardless of customization order', () => {
    store.getState().addItem(latte, S, [oat, shot], 1);
    store.getState().addItem(latte, S, [shot, oat], 2);
    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0].qty).toBe(3);
  });

  it('keeps DIFFERENT sizes / customizations as separate lines', () => {
    store.getState().addItem(latte, S, [], 1);
    store.getState().addItem(latte, L, [], 1);
    store.getState().addItem(latte, S, [oat], 1);
    expect(store.getState().items.map((l) => l.lineId)).toHaveLength(3);
    expect(new Set(store.getState().items.map((l) => l.lineId)).size).toBe(3);
  });
});

describe('qty operations', () => {
  it('incLine / decLine adjust qty; decLine at 1 removes the line', () => {
    store.getState().addItem(latte, S, [], 1);
    const id = store.getState().items[0].lineId;
    store.getState().incLine(id);
    expect(store.getState().items[0].qty).toBe(2);
    store.getState().decLine(id);
    store.getState().decLine(id);
    expect(store.getState().items).toEqual([]);
  });

  it('removeLine removes only that line; unknown ids are a no-op', () => {
    store.getState().addItem(latte, S, [], 1);
    store.getState().addItem(latte, L, [], 1);
    const [a, b] = store.getState().items;
    store.getState().removeLine('nope');
    expect(store.getState().items).toHaveLength(2);
    store.getState().removeLine(a.lineId);
    expect(store.getState().items.map((l) => l.lineId)).toEqual([b.lineId]);
  });

  it('addLine merges into an existing line by lineId', () => {
    store.getState().addItem(latte, S, [], 1);
    const existing = store.getState().items[0];
    store.getState().addLine({ ...existing, qty: 4 });
    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0].qty).toBe(5);
  });
});

describe('checkout context', () => {
  it("paying by wallet sets paidFromBalance; any other method clears it", () => {
    store.getState().setPaymentMethod('wallet');
    expect(store.getState().paidFromBalance).toBe(true);
    store.getState().setPaymentMethod('cash');
    expect(store.getState().paidFromBalance).toBe(false);
  });

  it('clear() empties lines + promo + delivery details but KEEPS order type / branch / method', () => {
    const s = store.getState();
    s.addItem(latte, S, [], 1);
    s.setOrderType('delivery');
    s.setBranch('rabyeh');
    s.setPaymentMethod('wallet');
    s.setPromo('WELCOME', 1.5);
    s.setCurbside(true);
    s.setCarInfo('white kia');
    s.setDeliveryAddress('Amman');
    store.getState().clear();
    expect(store.getState()).toMatchObject({
      items: [],
      promoCode: null,
      promoDiscount: 0,
      paidFromBalance: false,
      curbside: false,
      carInfo: '',
      deliveryAddress: '',
      orderType: 'delivery',
      branchId: 'rabyeh',
      paymentMethod: 'wallet',
    });
  });

  it('persists to localStorage under "almond-cart"', () => {
    store.getState().addItem(latte, S, [], 1);
    const saved = JSON.parse(storage.getItem('almond-cart') ?? 'null') as { state: { items: unknown[] } };
    expect(saved.state.items).toHaveLength(1);
  });
});
