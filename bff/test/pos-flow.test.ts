import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { config } from '../src/config';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import type { Backend } from '../src/backend';
import { __resetRateLimits } from '../src/plugins/rateLimit';
import { __resetOtpState } from '../src/auth/otp';
import { runTillFlow, type Http } from '../../scripts/pos/flow';
import { pgTestDb } from './lib/pgTestDb';
import { signIn } from './lib/signIn';

/**
 * FLOW — the till simulator's flow (scripts/pos/flow.ts), run through
 * app.inject on both stores: the documented end-to-end sale is a tested one.
 */
const cfg = config as unknown as Record<string, unknown>;
const KEY = 'pos-flow-test-key-'.padEnd(40, 'f');
const prevKey = config.POS_SCAN_KEY;
beforeEach(() => { __resetRateLimits(); __resetOtpState(); });

describe.each([
  ['memory', async () => createMemoryBackend()],
  ['postgres (pglite)', async () => createPostgresBackend(await pgTestDb())],
] as [string, () => Promise<Backend>][])('FLOW the till simulator, in-process — %s', (_name, make) => {
  let app: FastifyInstance;
  let backend: Backend;
  beforeAll(async () => { backend = await make(); app = await build(backend); cfg.POS_SCAN_KEY = KEY; }, 60_000);
  afterAll(async () => { cfg.POS_SCAN_KEY = prevKey; await app.close(); });

  const http: Http = {
    async post(path, body, headers) {
      const r = await app.inject({ method: 'POST', url: path, payload: body as Record<string, unknown>, headers });
      return { status: r.statusCode, body: r.body ? (r.json() as Record<string, unknown>) : {} };
    },
  };

  it('one code: scan → earn → replay; next visit scan ONCE → spend 50 → replay → earn on the money part → void both; then a partial refund', async () => {
    const jwt = await signIn(app, '0797000001');
    const lines: string[] = [];
    const r = await runTillFlow({ http, posKey: KEY, memberJwt: jwt, posOrderRef: 'Shop/FLOW-1', paidTotal: 25, billTotal: 6, spendPoints: 50, log: (l) => lines.push(l) });
    expect(lines).toHaveLength(12);
    expect(r.pointsEarned).toBe(50);                        // 25 JOD on the entry rung
    expect(r.balanceAfterEarn).toBe(50);
    expect(r.replay).toMatchObject({ replay: true, pointsEarned: 50 });
    // Visit B's ONE scan carried everything: the balance, what it can take off
    // the bill, and both tickets.
    expect(r.scanB).toMatchObject({ pointsBalance: 50, spendableJod: 0.5, earnsPoints: true });
    expect(typeof r.scanB.spendTicket).toBe('string');
    expect(r.spent).toEqual({ posOrderRef: 'Shop/FLOW-1-B', pointsSpent: 50, valueJod: 0.5, pointsBalance: 0, replay: false });
    expect(r.spendReplay).toEqual({ ...r.spent, replay: true });
    // The money part (6 − 0.5 = 5.5 JOD) earns; the tender does not. The
    // member crossed 20 JOD on visit A, so visit B is paid on the 4% rung.
    const earnedB = r.earnedB.pointsEarned as number;
    expect(earnedB).toBe(Math.round(5.5 * 4));
    expect(r.earnedB.pointsBalance).toBe(earnedB);
    const saleB = await backend.getTillSale('Shop/FLOW-1-B');
    expect(saleB?.paidFils).toBe(5_500);
    // The void: the 50 come back on their original clock, then the grant goes.
    expect(r.unspent).toEqual({ posOrderRef: 'Shop/FLOW-1-B', pointsReturned: 50, pointsExpired: 0, pointsBalance: 50 + earnedB, replay: false });
    expect(r.reversal).toMatchObject({ posOrderRef: 'Shop/FLOW-1-B', reversedPoints: earnedB, shortfall: 0, pointsBalance: 50, replay: false });
    // Later, 5 of visit A's 25 JOD come back: 5/25 of its 50 points, no more.
    expect(r.partialRefund).toEqual({
      posOrderRef: 'Shop/FLOW-1', refundRef: 'Shop/FLOW-1/R1', reversedPoints: 10, shortfall: 0, pointsBalance: 40,
      refundedTotal: 5, fullyReversed: false, replay: false,
    });
    const m = await backend.getMember(r.memberId);
    expect(liveBalance(m.lots)).toBe(40);
    expect((await backend.getHistory(r.memberId)).reduce((n, h) => n + h.deltaPoints, 0)).toBe(40);
    expect(await backend.getTillSpend('Shop/FLOW-1-B')).toMatchObject({ status: 'reversed', returnedPoints: 50 });
    expect(await backend.getTillSale('Shop/FLOW-1-B')).toMatchObject({ status: 'reversed', reversedPoints: earnedB });
    expect(await backend.getTillSale('Shop/FLOW-1')).toMatchObject({ status: 'earned', pointsEarned: 50, refundedFils: 5_000 });
  });
});
