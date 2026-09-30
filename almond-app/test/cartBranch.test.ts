import { describe, it, expect } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';

import { resolveCartBranch, checkoutBlock } from '@/lib/cartBranch';
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

  it('keeps the branch the customer chose while it is listed', () => {
    expect(resolveCartBranch(list, 'chosen')?.id).toBe('chosen');
  });

  it('falls back to the nearest OPEN branch when none is chosen, or the choice is gone', () => {
    expect(resolveCartBranch(list, null)?.id).toBe('open-far');
    expect(resolveCartBranch(list, 'deleted-branch')?.id).toBe('open-far');
  });

  it('takes the nearest when every branch is closed', () => {
    expect(resolveCartBranch([branch('a', false), branch('b', false)], null)?.id).toBe('a');
  });

  it('is undefined — not a crash — while there is no list', () => {
    expect(resolveCartBranch([], 'chosen')).toBeUndefined();
    expect(resolveCartBranch([], null)).toBeUndefined();
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
