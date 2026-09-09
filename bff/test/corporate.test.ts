import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config as loyaltyConfig } from '@almond/shared/config';
import { menuItems } from '@almond/shared/menu';
import { build } from '../src/server';
import { config } from '../src/config';
import { createMemoryBackend } from '../src/backend/memory';
import type { Backend } from '../src/backend';
import { signIn } from './lib/signIn';
import {
  buildRosterIndex, companyError, corporateDiscountAmount, corporateEarnsPoints,
  entitlementFor, parseRoster, type CompanyDiscount,
} from '@almond/shared/loyalty/corporate';
import { normalizeJordanPhone, toWesternDigits } from '@almond/shared/lib/phone';
import { computeEarn, earnRulesFromConfig } from '@almond/shared/loyalty/earn';

/**
 * T35 — corporate discounts: who holds one, what it takes off, and the one rule
 * that outranks the rest.
 */

const RULES = earnRulesFromConfig();
const ALMOND: CompanyDiscount = {
  id: 'almond', nameAr: 'موظفو ألموند', nameEn: 'Almond staff', percentOff: 50, active: true,
};
const STC: CompanyDiscount = {
  id: 'stc', nameAr: 'أنقذوا الأطفال', nameEn: 'Save the Children', percentOff: 20, active: true,
};

describe('T35a the phone is the identity, so both sides must normalise alike', () => {
  it('accepts every shape a real roster arrives in', () => {
    for (const raw of [
      '0791234567', '791234567', '+962791234567', '00962791234567',
      '+962 79 123 4567', '962-79-123-4567', ' 079 123 4567 ',
    ]) {
      expect(normalizeJordanPhone(raw), raw).toBe('+962791234567');
    }
  });

  it('reads Arabic-Indic digits — a number typed on an Arabic keyboard', () => {
    // 🔴 THE ROSTER IS ARABIC. Without this every row of an Arabic-typed sheet
    // fails as "not a mobile number" and the whole company is silently charged
    // full price. The app is Arabic-first; its uploads will be too.
    expect(toWesternDigits('٠٧٩١٢٣٤٥٦٧')).toBe('0791234567');
    expect(normalizeJordanPhone('٠٧٩١٢٣٤٥٦٧')).toBe('+962791234567');
    expect(normalizeJordanPhone('۰۷۹۱۲۳۴۵۶۷')).toBe('+962791234567');
  });

  it('refuses what is not a Jordanian mobile, rather than guessing', () => {
    for (const bad of ['', '   ', '079123456', '07912345678', '0612345678', 'ahmad', '+971501234567']) {
      expect(normalizeJordanPhone(bad), bad).toBeNull();
    }
  });
});

describe('T35b the roster upload reports what it could not use', () => {
  it('parses phone-only and phone,name, skipping a header and blank lines', () => {
    const r = parseRoster(
      'phone,name\n0791234567,أحمد\n\n0799876543\n"+962 78 555 4444",Sara\n',
      'almond',
    );
    expect(r.entries.map((e) => e.phone))
      .toEqual(['+962791234567', '+962799876543', '+962785554444']);
    expect(r.entries[0].name).toBe('أحمد');
    expect(r.errors).toEqual([]);
  });

  it('🔴 names the bad lines instead of dropping them silently', () => {
    // A 200-row upload that quietly becomes 180 is how a company arrives at the
    // till expecting a discount nobody can find.
    const r = parseRoster('0791234567\nnot-a-phone\n0612345678\n', 'stc');
    expect(r.entries).toHaveLength(1);
    expect(r.errors).toEqual([
      { line: 2, value: 'not-a-phone', reason: 'not a Jordanian mobile number' },
      { line: 3, value: '0612345678', reason: 'not a Jordanian mobile number' },
    ]);
  });

  it('the same person twice is one entry, not an error', () => {
    const r = parseRoster('0791234567,Old Name\n079 123 4567,New Name\n', 'almond');
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].name).toBe('New Name');
    expect(r.errors).toEqual([]);
  });
});

describe('T35c who is entitled, and who stops being', () => {
  const roster = buildRosterIndex([
    { phone: '0791234567', companyId: 'almond', name: 'حمزة' },
    { phone: '0799876543', companyId: 'stc' },
  ]);
  const companies = [ALMOND, STC];

  it('resolves the company and its percentage from any shape of the phone', () => {
    expect(entitlementFor('+962791234567', companies, roster)?.percentOff).toBe(50);
    expect(entitlementFor('0791234567', companies, roster)?.company.id).toBe('almond');
    expect(entitlementFor('0799876543', companies, roster)?.percentOff).toBe(20);
  });

  it('a member on no roster holds nothing', () => {
    expect(entitlementFor('0781111111', companies, roster)).toBeNull();
    expect(entitlementFor(null, companies, roster)).toBeNull();
    expect(entitlementFor('nonsense', companies, roster)).toBeNull();
  });

  it('switching a company off withdraws it from everyone on its roster at once', () => {
    // The contract lapsed. The roster survives so renewing it is one toggle,
    // but nobody is entitled in the meantime.
    const off = [{ ...ALMOND, active: false }, STC];
    expect(entitlementFor('0791234567', off, roster)).toBeNull();
    expect(entitlementFor('0799876543', off, roster)?.percentOff).toBe(20);
  });

  it('a roster pointing at a deleted company entitles nobody', () => {
    expect(entitlementFor('0791234567', [STC], roster)).toBeNull();
  });

  it('re-uploading moves someone who changed employer rather than doubling them', () => {
    const moved = buildRosterIndex([
      { phone: '0791234567', companyId: 'almond' },
      { phone: '0791234567', companyId: 'stc' },
    ]);
    expect(moved.size).toBe(1);
    expect(entitlementFor('0791234567', companies, moved)?.company.id).toBe('stc');
  });
});

describe('T35d what comes off the bill', () => {
  it('is a percentage, rounded to fils', () => {
    expect(corporateDiscountAmount(10, 50)).toBe(5);
    expect(corporateDiscountAmount(8.31, 20)).toBe(1.662);
    expect(corporateDiscountAmount(2.75, 50)).toBe(1.375);
  });

  it('🔴 never exceeds the bill — a mistyped 150% must not owe the customer money', () => {
    expect(corporateDiscountAmount(10, 150)).toBe(10);
    expect(corporateDiscountAmount(10, 100)).toBe(10);
  });

  it('is zero on nonsense rather than NaN on the invoice', () => {
    for (const [sub, pct] of [[0, 50], [-5, 50], [10, 0], [10, -20], [NaN, 50], [10, NaN]]) {
      expect(corporateDiscountAmount(sub, pct), `${sub}/${pct}`).toBe(0);
    }
  });

  it('refuses a company that would owe money, or has no name', () => {
    expect(companyError({ nameEn: 'X', percentOff: 50 })).toBeNull();
    expect(companyError({ nameAr: 'س', percentOff: 100 })).toBeNull();
    expect(companyError({ percentOff: 50 })).toMatch(/name/);
    expect(companyError({ nameEn: 'X', percentOff: 101 })).toMatch(/over 100/);
    expect(companyError({ nameEn: 'X', percentOff: 0 })).toMatch(/switch the company off/);
    expect(companyError({ nameEn: 'X' })).toMatch(/must be a number/);
  });
});

describe('T35e 🔴 a standing-discount holder never earns points', () => {
  // Owner, 2026-09-08: «من يستحق خصم دائم لا يأخذ نقاط ابدا».
  //
  // THIS IS THE SUITE THAT COSTS MONEY IF IT GOES. An Almond employee at 50%
  // who also earned the top rung's 9% takes 55% of the menu price home, and
  // nothing in either mechanism would notice.

  it('states the rule as a rule', () => {
    expect(corporateEarnsPoints()).toBe(false);
  });

  it('grants zero on the same invoice that would otherwise pay well', () => {
    const ctx = { total: 20, windowSpend: 750, paidFromBalance: true, at: new Date('2026-09-07T10:00:00Z') };
    const ordinary = computeEarn(ctx, RULES);
    expect(ordinary.points).toBeGreaterThan(0);
    expect(computeEarn({ ...ctx, corporate: true }, RULES).points).toBe(0);
  });

  it('zero on EVERY rung and every payment method — not just the rich ones', () => {
    for (const windowSpend of [0, 20, 65, 750]) {
      for (const paidFromBalance of [false, true]) {
        const r = computeEarn({ total: 12.5, windowSpend, paidFromBalance, corporate: true }, RULES);
        expect(r.points, JSON.stringify({ windowSpend, paidFromBalance })).toBe(0);
      }
    }
  });

  it('🔴 the combo bonus does not escape it, though it escapes the ceiling', () => {
    // §8.7 puts comboBonus OUTSIDE the earn ceiling on purpose. That makes it
    // the one grant a corporate zero applied at the cap would have missed, so
    // the zero is applied after both.
    const withCombo = { total: 20.3, comboPairs: 10, at: new Date('2026-09-07T10:00:00Z') };
    expect(computeEarn(withCombo, RULES).points).toBeGreaterThan(0);
    expect(computeEarn({ ...withCombo, corporate: true }, RULES).points).toBe(0);
  });

  it('an ordinary member is untouched — the flag is opt-in, absent by default', () => {
    const ctx = { total: 10, windowSpend: 100, at: new Date('2026-09-07T10:00:00Z') };
    expect(computeEarn({ ...ctx, corporate: false }, RULES).points)
      .toBe(computeEarn(ctx, RULES).points);
  });
});

// ---------------------------------------------------------------------------
// T35f — the wiring. The pure tests above prove the RULE; these prove the
// routes actually obey it, which is a different claim and the one that pays out.
// ---------------------------------------------------------------------------
describe('T35f the register reaches the till', () => {
  let app: FastifyInstance;
  let backend: Backend;
  let staffToken = '';
  let publicToken = '';
  const KEY = 'test-admin-key-'.padEnd(32, 'x');
  /** `config` is `as const`, and this suite deliberately exercises BOTH states:
   *  unset (the fail-closed path, which is the whole reason the key exists) and
   *  configured. Reading the real object rather than stubbing a module keeps
   *  the route under test the one that ships. */
  const setAdminKey = (v: string) => { (config as unknown as { ADMIN_KEY: string }).ADMIN_KEY = v; };
  const ADMIN = { 'x-admin-key': KEY };
  const STAFF_PHONE = '0791234567';
  const item = menuItems.find((m) => m.sizes[0].price > 2)!;
  const lineOf = (qty: number) =>
    ({ itemId: item.id, sizeId: item.sizes[0].id, optionIds: [] as string[], qty });

  beforeAll(async () => {
    backend = createMemoryBackend();
    app = await build(backend);
    // Sign each member in ONCE: requestOtp enforces a send cap, so a helper
    // called per-test fails with "a code was just sent" — which reads as a
    // broken feature and is actually the rate limit working.
    staffToken = await signIn(app, STAFF_PHONE);
    publicToken = await signIn(app, '0781111111');
  });
  afterAll(async () => { await app.close(); setAdminKey(''); });

  const admin = (method: 'GET' | 'PUT', url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as object, headers: ADMIN });
  const auth = (t: string) => ({ authorization: `Bearer ${t}` });
  const buy = (t: string, qty = 1) => app.inject({
    method: 'POST', url: '/v1/checkout',
    payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: [lineOf(qty)] },
    headers: { ...auth(t), 'idempotency-key': randomUUID() },
  });

  it('🔴 an UNSET admin key is a locked door, not an open one', async () => {
    // This is the /v1/pos/scan lesson: that route read `if (KEY && ...)`, so an
    // unset key skipped the comparison and left it world-callable. The register
    // decides who pays half price; it must fail closed.
    expect(config.ADMIN_KEY).toBe('');
    expect((await admin('GET', '/v1/admin/companies')).statusCode).toBe(401);
    setAdminKey(KEY);                             // configured from here on
    expect((await admin('GET', '/v1/admin/companies')).statusCode).toBe(200);
  });

  it('refuses a wrong key, and a member JWT is not an admin credential', async () => {
    expect((await app.inject({
      method: 'GET', url: '/v1/admin/companies', headers: { 'x-admin-key': 'wrong' },
    })).statusCode).toBe(401);
    // The register is not reachable by being signed in, however senior.
    expect((await app.inject({
      method: 'GET', url: '/v1/admin/companies', headers: auth(staffToken),
    })).statusCode).toBe(401);
  });

  it('stores a company, uploads its roster, and NAMES what it rejected', async () => {
    const c = await admin('PUT', '/v1/admin/companies', {
      id: 'almond', nameAr: 'موظفو ألموند', nameEn: 'Almond staff', percentOff: 50, active: true,
    });
    expect(c.statusCode, c.body).toBe(201);

    const up = await admin('PUT', '/v1/admin/companies/almond/roster', {
      text: `phone,name\n${STAFF_PHONE},حمزة\nnot-a-phone\n٠٧٩٩٨٧٦٥٤٣,سارة\n`,
    });
    expect(up.statusCode, up.body).toBe(200);
    expect(up.json().after).toBe(2);                 // the Arabic-digit row counted
    expect(up.json().rejected).toHaveLength(1);      // and the bad one was named
    expect(up.json().rejected[0].line).toBe(3);
  });

  it('🔴 refuses a discount that would owe the customer money', async () => {
    const r = await admin('PUT', '/v1/admin/companies', {
      id: 'bad', nameEn: 'Too generous', percentOff: 150, active: true,
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toMatch(/over 100/);
  });

  it('the member sees their own entitlement, and is told points stop', async () => {
    const r = await app.inject({ method: 'GET', url: '/v1/me/corporate', headers: auth(staffToken) });
    expect(r.json().entitlement.percentOff).toBe(50);
    expect(r.json().entitlement.earnsPoints).toBe(false);

    const none = await app.inject({ method: 'GET', url: '/v1/me/corporate', headers: auth(publicToken) });
    expect(none.json().entitlement).toBeNull();
  });

  it('🔴 charges half, taxes the DISCOUNTED amount, and grants zero points', async () => {
    const r = await buy(staffToken, 2);
    expect(r.statusCode, r.body).toBe(201);
    const body = r.json();
    const full = item.sizes[0].price * 2;

    expect(body.subtotal).toBeCloseTo(full, 3);
    // The TAX is on the half. A discount subtracted after tax would charge tax
    // on money the member never paid.
    expect(body.tax).toBeCloseTo((full / 2) * loyaltyConfig.TAX_RATE, 3);
    expect(body.total).toBeCloseTo((full / 2) * (1 + loyaltyConfig.TAX_RATE), 3);
    // 🔴 THE RULE, THROUGH THE REAL ROUTE.
    expect(body.pointsEarned).toBe(0);
    expect(body.pointsBalance).toBe(0);
  });

  it('an ordinary member on the same basket pays full and DOES earn', async () => {
    // The control. Without it a checkout broken for everyone would pass the
    // test above by granting zero to all.
    const body = (await buy(publicToken, 2)).json();
    expect(body.total).toBeCloseTo(item.sizes[0].price * 2 * (1 + loyaltyConfig.TAX_RATE), 3);
    expect(body.pointsEarned).toBeGreaterThan(0);
  });

  it('the report answers "who took what, and how many times"', async () => {
    const r = await admin('GET', '/v1/admin/corporate/uses?companyId=almond');
    expect(r.statusCode, r.body).toBe(200);
    const { uses, byMember } = r.json();
    expect(uses.length).toBeGreaterThan(0);
    expect(uses[0].percentOff).toBe(50);          // the rate that APPLIED, stored
    expect(uses[0].items[0].qty).toBe(2);
    expect(byMember[0].phone).toBe('+962791234567');
    expect(byMember[0].name).toBe('حمزة');        // joined from the roster
    expect(byMember[0].times).toBe(1);
    expect(Object.values(byMember[0].items as Record<string, number>)[0]).toBe(2);
  });

  it('🔴 switching the company off restores full price AND restores earning', async () => {
    await admin('PUT', '/v1/admin/companies', {
      id: 'almond', nameAr: 'موظفو ألموند', nameEn: 'Almond staff', percentOff: 50, active: false,
    });
    const body = (await buy(staffToken, 1)).json();
    expect(body.total).toBeCloseTo(item.sizes[0].price * (1 + loyaltyConfig.TAX_RATE), 3);
    expect(body.pointsEarned).toBeGreaterThan(0);
  });
});
