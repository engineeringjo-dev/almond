import { describe, it, expect, beforeAll } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';

import {
  resolveCartBranch,
  checkoutBlock,
  branchSwitchCopy,
  type BranchSwitch,
  type CartBranchChoice,
} from '@/lib/cartBranch';
import { useCartStore } from '@/stores/cartStore';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { branchesQuery } from '@/lib/branchesQuery';
import type { Branch } from '@/types';

/**
 * B1-B3 — THE CART NEVER RENDERS WITHOUT A BRANCH IT CAN NAME (audit P0).
 *
 * A dine-in customer whose branch list was not loaded yet got the full-screen
 * error boundary: `<BranchCard branch={branch!}>` read `.nameAr` off
 * `undefined`. On native the gap reopened on every location fix, because the
 * query key carries the coordinates. B1 is what the cart shows, B2 whether
 * checkout may start and why not, B3 that a new fix no longer blanks the list.
 */

// The real cart store persists through AsyncStorage, whose web build wants a
// window.localStorage — the same shim pairings.test.ts uses.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}

const branch = (id: string, isOpen: boolean): Branch => ({
  id,
  nameAr: id,
  nameEn: id,
  areaAr: '',
  areaEn: '',
  lat: 31.95,
  lng: 35.9,
  hours: { open: '07:00', close: '24:00' },
  isOpen,
});

describe('B1 resolveCartBranch', () => {
  const list = [branch('closed-near', false), branch('open-far', true), branch('chosen', true)];
  const at = (id: string | null, extra: Partial<CartBranchChoice> = {}) =>
    resolveCartBranch(list, { id, ...extra });

  it('keeps the branch the customer chose while it is listed and open, with no notice', () => {
    expect(at('chosen')).toEqual({ branch: list[2], switched: null });
  });

  it('with no choice yet, shows the nearest OPEN branch and says nothing (nothing was taken away)', () => {
    expect(at(null)).toEqual({ branch: list[1], switched: null });
  });

  it('takes the nearest when every branch is closed', () => {
    expect(resolveCartBranch([branch('a', false), branch('b', false)], { id: null }).branch?.id).toBe('a');
  });

  it('is undefined — not a crash — while there is no list', () => {
    expect(resolveCartBranch([], { id: 'chosen' })).toEqual({ branch: undefined, switched: null });
    expect(resolveCartBranch([], { id: null })).toEqual({ branch: undefined, switched: null });
  });
});

/**
 * B4 — THE CART NEVER MOVES AN ORDER SILENTLY (owner, 2026-09-30).
 *
 * The saved branch leaving the list used to re-point the order at the nearest
 * open branch without a word. Every move now comes back with its reason and
 * both names; a closed branch picked on purpose in this session stays.
 */
describe('B4 a switch is reported, with its reason and both names', () => {
  const list = [branch('closed-near', false), branch('open-far', true), branch('chosen', true)];
  const khalda = { nameAr: 'خلدا', nameEn: 'Khalda' };

  it('the saved branch left the list → nearest open, reason `unavailable`, named from the saved name', () => {
    expect(resolveCartBranch(list, { id: 'khalda', names: khalda })).toEqual({
      branch: list[1],
      switched: {
        reason: 'unavailable',
        from: khalda,
        to: { id: 'open-far', nameAr: 'open-far', nameEn: 'open-far' },
        toOpen: true,
      },
    });
  });

  it('a cart saved before names were kept still gets the notice, unnamed', () => {
    const r = resolveCartBranch(list, { id: 'khalda' });
    expect(r.switched).toMatchObject({ reason: 'unavailable', from: null, toOpen: true });
  });

  it('the saved branch is listed but CLOSED now → nearest open, reason `closed`', () => {
    const r = resolveCartBranch(list, { id: 'closed-near', names: { nameAr: 'x', nameEn: 'x' } });
    expect(r.branch?.id).toBe('open-far');
    expect(r.switched).toEqual({
      reason: 'closed',
      from: { id: 'closed-near', nameAr: 'closed-near', nameEn: 'closed-near' },
      to: { id: 'open-far', nameAr: 'open-far', nameEn: 'open-far' },
      toOpen: true,
    });
  });

  it('a closed branch picked in THIS session is kept — the customer chose it knowing', () => {
    expect(resolveCartBranch(list, { id: 'closed-near', pinned: true })).toEqual({ branch: list[0], switched: null });
  });

  it('a closed choice stays when nothing is open (there is nowhere better to go)', () => {
    const allClosed = [branch('a', false), branch('b', false)];
    expect(resolveCartBranch(allClosed, { id: 'b' })).toEqual({ branch: allClosed[1], switched: null });
  });

  it('a vanished choice with every branch closed names the nearest, and says it is closed', () => {
    const allClosed = [branch('a', false), branch('b', false)];
    const r = resolveCartBranch(allClosed, { id: 'gone', names: khalda });
    expect(r.branch?.id).toBe('a');
    expect(r.switched).toMatchObject({ reason: 'unavailable', toOpen: false });
  });

  it('unknown open-ness is not "closed" — no switch on a list without hours', () => {
    const unknown = [{ ...branch('u', true), isOpen: undefined }, branch('o', true)];
    expect(resolveCartBranch(unknown, { id: 'u' }).switched).toBeNull();
  });
});

describe('B5 the sentence the customer reads', () => {
  const to = { id: 'rabyeh', nameAr: 'الرابية', nameEn: 'Rabyeh' };
  const from = { nameAr: 'خلدا', nameEn: 'Khalda' };

  it('names both branches, in the reader\'s language', () => {
    expect(branchSwitchCopy({ reason: 'unavailable', from, to, toOpen: true }, 'ar')).toEqual({
      key: 'cart.branchSwitchGone',
      params: { from: 'خلدا', to: 'الرابية' },
    });
    expect(branchSwitchCopy({ reason: 'closed', from, to, toOpen: true }, 'en')).toEqual({
      key: 'cart.branchSwitchClosed',
      params: { from: 'Khalda', to: 'Rabyeh' },
    });
  });

  it('never claims the new branch is open when it is not, and never invents a name', () => {
    expect(branchSwitchCopy({ reason: 'unavailable', from, to, toOpen: false }, 'ar').key).toBe(
      'cart.branchSwitchGoneAllClosed',
    );
    expect(branchSwitchCopy({ reason: 'unavailable', from: null, to, toOpen: true }, 'ar')).toEqual({
      key: 'cart.branchSwitchGoneUnnamed',
      params: { to: 'الرابية' },
    });
    expect(branchSwitchCopy({ reason: 'unavailable', from: null, to, toOpen: false }, 'ar').key).toBe(
      'cart.branchSwitchGoneUnnamedAllClosed',
    );
  });

  it('every sentence exists in both languages and says both names it was given', () => {
    const cases: BranchSwitch[] = [
      { reason: 'closed', from, to, toOpen: true },
      { reason: 'unavailable', from, to, toOpen: true },
      { reason: 'unavailable', from, to, toOpen: false },
      { reason: 'unavailable', from: null, to, toOpen: true },
      { reason: 'unavailable', from: null, to, toOpen: false },
    ];
    for (const lang of ['ar', 'en'] as const) {
      const file = lang === 'ar' ? ar : en;
      for (const c of cases) {
        const { key, params } = branchSwitchCopy(c, lang);
        const template = (file.cart as Record<string, string>)[key.replace('cart.', '')];
        expect(template, `${lang} ${key}`).toBeTypeOf('string');
        const rendered = template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k as keyof typeof params]));
        expect(rendered).toContain(params.to);
        if (params.from) expect(rendered).toContain(params.from);
        expect(rendered).not.toMatch(/\{\{|undefined/);
      }
    }
  });
});

describe('B6 the store keeps the notice, and a real choice clears it', () => {
  beforeAll(() => {
    (globalThis as unknown as { window: unknown }).window = { localStorage: new MemoryStorage() };
  });

  it('switchBranch moves the order, remembers the new name, and holds the notice unpinned', () => {
    const notice: BranchSwitch = {
      reason: 'unavailable',
      from: { nameAr: 'خلدا', nameEn: 'Khalda' },
      to: { id: 'rabyeh', nameAr: 'الرابية', nameEn: 'Rabyeh' },
      toOpen: true,
    };
    useCartStore.getState().switchBranch(notice);
    const s = useCartStore.getState();
    expect(s.branchId).toBe('rabyeh');
    expect(s.branchNames).toEqual({ nameAr: 'الرابية', nameEn: 'Rabyeh' });
    expect(s.branchPinned).toBe(false);
    expect(s.branchNotice).toEqual(notice);

    // …and once moved, the next resolution is quiet: no notice loop.
    const listed = [{ ...branch('rabyeh', true), nameAr: 'الرابية', nameEn: 'Rabyeh' }];
    expect(resolveCartBranch(listed, { id: s.branchId, names: s.branchNames, pinned: s.branchPinned }).switched).toBeNull();
  });

  it('choosing a branch pins it, names it, and clears the notice', () => {
    useCartStore.getState().setBranch({ id: 'khalda', nameAr: 'خلدا', nameEn: 'Khalda' });
    const s = useCartStore.getState();
    expect(s).toMatchObject({
      branchId: 'khalda',
      branchNames: { nameAr: 'خلدا', nameEn: 'Khalda' },
      branchPinned: true,
      branchNotice: null,
    });
  });

  it('the name is persisted with the id; the pin and the notice are not', () => {
    const persisted = useCartStore.persist.getOptions().partialize?.(useCartStore.getState()) as Record<string, unknown>;
    expect(persisted).toHaveProperty('branchNames');
    expect(persisted).not.toHaveProperty('branchPinned');
    expect(persisted).not.toHaveProperty('branchNotice');
  });
});

describe('B2 checkoutBlock', () => {
  const b = branch('a', true);

  it('lets the review open once there is a branch, for pickup and dine-in', () => {
    for (const orderType of ['pickup', 'dinein'] as const) {
      expect(checkoutBlock({ orderType, branch: b, loading: true, error: true })).toBeNull();
    }
  });

  it('says WHY it cannot open while there is none', () => {
    const none = { orderType: 'dinein' as const, branch: undefined };
    expect(checkoutBlock({ ...none, loading: true, error: false })).toBe('branchLoading');
    expect(checkoutBlock({ ...none, loading: false, error: true })).toBe('branchError');
    expect(checkoutBlock({ ...none, loading: false, error: false })).toBe('branchMissing');
  });

  it('never blocks delivery, which hands off before the review', () => {
    expect(checkoutBlock({ orderType: 'delivery', branch: undefined, loading: true, error: false })).toBeNull();
  });
});

describe('B3 a location fix keeps the list already on screen', () => {
  it('the new query shows the previous branches until the re-sorted ones arrive', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const observer = new QueryObserver(client, branchesQuery(null));
    const unsubscribe = observer.subscribe(() => {});
    await client.fetchQuery(branchesQuery(null));
    const before = observer.getCurrentResult().data;
    expect(before?.length).toBeGreaterThan(0);

    // The fix lands: a NEW key. Without placeholder data this is `undefined`
    // until the fetch resolves — the exact gap that crashed the cart.
    observer.setOptions(branchesQuery({ lat: 31.99, lng: 35.87 }));
    const during = observer.getCurrentResult();
    expect(during.data).toEqual(before);
    expect(during.isPlaceholderData).toBe(true);

    unsubscribe();
    client.clear();
  });
});
