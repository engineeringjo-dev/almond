import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { maskedDisplayName } from '@almond/shared/loyalty/profile';
import { config } from '../src/config';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import type { Backend } from '../src/backend';
import { readEarnTicket } from '../src/pos/token';
import { __resetRateLimits } from '../src/plugins/rateLimit';
import { __resetOtpState } from '../src/auth/otp';
import { pgTestDb } from './lib/pgTestDb';

/**
 * P3 — EARN BY PHONE NUMBER ON THE IN-STORE TABLET. Owner, 2026-09-24: «اذا بدك
 * تكسب نقاط يا بتحط رقمك عالتابلت بالمحل يا يتفتح من كبسة باركود».
 *
 * The number proves nothing about who typed it, so the tablet can EARN and
 * nothing else: no spend ticket, no balance, no member created from a number.
 */

type Mutable = Record<string, unknown>;
const cfg = config as unknown as Mutable;
const KEY = 'pos-identify-test-key-'.padEnd(40, 'i');
const saved = { POS_SCAN_KEY: config.POS_SCAN_KEY, RATE_LIMITS: config.RATE_LIMITS };

let seq = 0;
/** A fresh member number: canonical for the backend, and the digits alone. */
const fresh = () => {
  const d = String(4_000_000 + seq++).padStart(7, '0');
  return { canonical: `+96279${d}`, local: `079${d}`, digits: `79${d}` };
};

beforeEach(() => { __resetRateLimits(); __resetOtpState(); });
afterEach(() => { cfg.RATE_LIMITS = saved.RATE_LIMITS; });

describe.each([
  ['memory', async () => createMemoryBackend()],
  ['postgres (pglite)', async () => createPostgresBackend(await pgTestDb())],
] as [string, () => Promise<Backend>][])('P3 POST /v1/pos/identify — %s', (_name, make) => {
  let app: FastifyInstance;
  let backend: Backend;
  beforeAll(async () => { backend = await make(); app = await build(backend); cfg.POS_SCAN_KEY = KEY; }, 60_000);
  afterAll(async () => { cfg.POS_SCAN_KEY = saved.POS_SCAN_KEY; await app.close(); });

  const pos = (url: string, payload: unknown, key: string | null = KEY) => app.inject({
    method: 'POST', url, payload: payload as Record<string, unknown>, headers: key === null ? {} : { 'x-pos-key': key },
  });
  const identify = (phone: unknown, key?: string | null) => pos('/v1/pos/identify', { phone }, key);
  const points = async (id: string) => liveBalance((await backend.getMember(id)).lots);

  it('P3.1 🔴 a member found by number gets an EARN ticket, a masked name — and NOTHING that could spend', async () => {
    const p = fresh();
    const m = await backend.findOrCreateByPhone(p.canonical, 'حمزة العموش');
    await backend.addPoints(m.id, 500, 'منحة', 'Grant');
    for (const typed of [p.local, p.canonical, `+962 ${p.digits}`, `00962${p.digits}`, p.local.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])]) {
      const r = await identify(typed);
      expect(r.statusCode, typed).toBe(200);
      const body = r.json();
      // The WHOLE key set, pinned: no balance, no spend ticket, no member id,
      // no phone — a new field here is a leak until someone decides otherwise.
      expect(Object.keys(body).sort(), typed).toEqual(['displayName', 'earnTicket', 'earnsPoints', 'memberFound']);
      expect(body, typed).toMatchObject({ memberFound: true, displayName: 'حمزة ع.', earnsPoints: true });
      expect(readEarnTicket(body.earnTicket).memberId).toBe(m.id);
    }
  });

  it('P3.2 the tablet\'s ticket earns like a scan\'s: after payment, on the money collected', async () => {
    const p = fresh();
    const m = await backend.findOrCreateByPhone(p.canonical, 'Sara Haddad');
    const { earnTicket, displayName } = (await identify(p.local)).json();
    expect(displayName).toBe('Sara H.');
    const r = await pos('/v1/pos/earn', { earnTicket, posOrderRef: `Shop/${randomUUID()}`, branchId: 'b1', paidTotal: 10 });
    expect(r.statusCode).toBe(201);
    expect(r.json().pointsEarned).toBe(20);                          // 10 JOD on the entry rung
    expect(await points(m.id)).toBe(20);
  });

  it('P3.3 🔴 a spend with a tablet-issued ticket is IMPOSSIBLE — typing a number proves nothing', async () => {
    const p = fresh();
    const m = await backend.findOrCreateByPhone(p.canonical, 'حمزة');
    await backend.addPoints(m.id, 300, 'منحة', 'Grant');
    const { earnTicket } = (await identify(p.local)).json();
    const r = await pos('/v1/pos/points/spend', { spendTicket: earnTicket, posOrderRef: `Shop/${randomUUID()}`, points: 100 });
    expect([r.statusCode, r.json().error]).toEqual([401, 'ticket_invalid']);
    expect(await points(m.id)).toBe(300);
    expect(await backend.getHistory(m.id)).toHaveLength(1);           // the grant only
  });

  it('P3.4 🔴 an unknown number is "not a member" — and does NOT become one', async () => {
    const p = fresh();
    const r = await identify(p.local);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ memberFound: false, earnTicket: null, displayName: null, earnsPoints: false });
    expect(await backend.findMemberByPhone(p.canonical)).toBeNull();
    // Asked twice, still nobody: identify is a read.
    await identify(p.local);
    expect(await backend.findMemberByPhone(p.canonical)).toBeNull();
  });

  it('P3.5 a corporate member is found but earns nothing: no ticket at all', async () => {
    const p = fresh();
    const m = await backend.findOrCreateByPhone(p.canonical, 'موظف');
    await backend.saveCompany({ id: `co${p.digits}`, nameAr: 'ألموند', nameEn: 'Almond', percentOff: 50, active: true });
    await backend.replaceRoster(`co${p.digits}`, [{ phone: p.local, companyId: `co${p.digits}` }]);
    expect((await identify(p.local)).json()).toEqual({ memberFound: true, earnTicket: null, displayName: 'موظف', earnsPoints: false });
    expect(await points(m.id)).toBe(0);
  });

  it('P3.6 a nameless member is found with no name — never an invented one', async () => {
    const p = fresh();
    await backend.findOrCreateByPhone(p.canonical);
    expect((await identify(p.local)).json()).toMatchObject({ memberFound: true, displayName: null, earnsPoints: true });
  });

  it('P3.7 🔴 fails closed, refuses a non-number, and is rate-limited per till AND per key', async () => {
    const p = fresh();
    for (const key of [null, 'w'.repeat(40)]) {
      const r = await identify(p.local, key);
      expect([r.statusCode, r.json().error]).toEqual([401, 'pos_key_invalid']);
    }
    for (const bad of ['12345', 'hello', '0691234567', '', 791234567, null]) {
      const r = await identify(bad);
      expect(r.statusCode, String(bad)).toBe(400);
    }
    expect((await identify('12345')).json().error).toBe('phone_invalid');
    __resetRateLimits();
    cfg.RATE_LIMITS = { ...saved.RATE_LIMITS, posIdentifyPerTill: { max: 3, windowSeconds: 60 } };
    const codes: number[] = [];
    for (let i = 0; i < 5; i += 1) codes.push((await identify(fresh().local)).statusCode);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    // Its own budget: the till still earns.
    expect((await pos('/v1/pos/earn/reverse', { posOrderRef: 'Shop/none', reason: 'x' })).statusCode).toBe(404);
    __resetRateLimits();
    cfg.RATE_LIMITS = { ...saved.RATE_LIMITS, posIdentifyPerKey: { max: 2, windowSeconds: 60 } };
    const chain: number[] = [];
    for (let i = 0; i < 3; i += 1) chain.push((await identify(fresh().local)).statusCode);
    expect(chain).toEqual([200, 200, 429]);
    // An unauthenticated caller spends no budget.
    __resetRateLimits();
    cfg.RATE_LIMITS = { ...saved.RATE_LIMITS, posIdentifyPerKey: { max: 1, windowSeconds: 60 } };
    for (let i = 0; i < 3; i += 1) expect((await identify(p.local, 'bad'.padEnd(40, 'b'))).statusCode).toBe(401);
    expect((await identify(p.local)).statusCode).toBe(200);
  });
});

describe('P3.8 maskedDisplayName — enough to say "that\'s me", not enough to name a stranger', () => {
  it('first name + initial of the last, skipping the Arabic article; null when there is no name', () => {
    expect(maskedDisplayName('حمزة العموش')).toBe('حمزة ع.');
    expect(maskedDisplayName('حمزة عمر')).toBe('حمزة ع.');
    expect(maskedDisplayName('  محمد   أحمد   الخطيب ')).toBe('محمد خ.');
    expect(maskedDisplayName('sara haddad')).toBe('sara H.');
    expect(maskedDisplayName('حمزة')).toBe('حمزة');
    expect(maskedDisplayName('حمزة ال')).toBe('حمزة ا.');                 // a bare «ال» is a letter, not an article
    expect(maskedDisplayName('')).toBeNull();
    expect(maskedDisplayName('   ')).toBeNull();
    expect(maskedDisplayName(null)).toBeNull();
  });
});
