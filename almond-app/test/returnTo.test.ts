import { describe, it, expect } from 'vitest';

import { CHECKOUT_RETURN, reviewOnReturn, safeReturnTo } from '@/lib/returnTo';

/**
 * R1-R3 — A GUEST WHO SIGNS IN AT CHECKOUT LANDS BACK ON THE CHECKOUT (audit P1).
 *
 * After the OTP the app used to replace to the tabs root, so the customer met
 * Home instead of the review they had asked for. `returnTo` now carries them
 * back — and because it arrives as a URL parameter, R2 is the half that
 * matters most: nothing but a listed in-app route is ever followed.
 */

describe('R1 the checkout round-trip', () => {
  it('the gate asks to come back to the cart with the review open', () => {
    expect(safeReturnTo(CHECKOUT_RETURN)).toBe('/cart?review=1');
  });

  it('a guest goes back to the cart, without the review', () => {
    expect(safeReturnTo(CHECKOUT_RETURN, false)).toBe('/cart');
  });

  it('no returnTo means the default (the caller replaces to Home)', () => {
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo('')).toBeNull();
  });
});

describe('R2 never an open redirect', () => {
  const hostile = [
    'https://evil.example/cart',
    '//evil.example/cart',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'almond://cart',
    '/cart/../profile',
    '/cart?review=1?x=//evil',
    '/cart#//evil',
    '/profile',
    'cart',
    '/__proto__',
    '/constructor',
    '/cart'.padEnd(300, 'x'),
  ];
  for (const raw of hostile) {
    it(`refuses ${JSON.stringify(raw.slice(0, 40))}`, () => {
      expect(safeReturnTo(raw)).toBeNull();
    });
  }

  it('refuses non-strings (an array param, a number)', () => {
    expect(safeReturnTo(['/cart'])).toBeNull();
    expect(safeReturnTo(1)).toBeNull();
  });

  it('passes through only known flags, only as "1"', () => {
    expect(safeReturnTo('/cart?review=1&next=https://evil')).toBe('/cart?review=1');
    expect(safeReturnTo('/cart?review=javascript:x')).toBe('/cart');
    expect(safeReturnTo('/cart?review=1&review=1')).toBe('/cart?review=1');
  });
});

describe('R3 the cart reopens the review once, when it can', () => {
  const base = { review: '1', isAuthenticated: true, itemCount: 2, block: null } as const;

  it('opens it for a signed-in customer with a cart and a branch', () => {
    expect(reviewOnReturn(base)).toBe('open');
  });

  it('waits while branches load instead of losing the request', () => {
    expect(reviewOnReturn({ ...base, block: 'branchLoading' })).toBe('wait');
  });

  it('drops the flag when the review cannot open', () => {
    expect(reviewOnReturn({ ...base, isAuthenticated: false })).toBe('drop');
    expect(reviewOnReturn({ ...base, itemCount: 0 })).toBe('drop');
    expect(reviewOnReturn({ ...base, block: 'branchMissing' })).toBe('drop');
  });

  it('does nothing on an ordinary visit', () => {
    expect(reviewOnReturn({ ...base, review: undefined })).toBe('none');
  });
});
