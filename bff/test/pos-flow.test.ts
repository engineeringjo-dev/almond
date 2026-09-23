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

  it('mint → scan → earn → replay → redeem → scan redeem QR → settle → reverse', async () => {
    const jwt = await signIn(app, '0797000001');
    const lines: string[] = [];
    const r = await runTillFlow({ http, posKey: KEY, memberJwt: jwt, posOrderRef: 'Shop/FLOW-1', paidTotal: 25, log: (l) => lines.push(l) });
    expect(lines).toHaveLength(9);
    expect(r.pointsEarned).toBeGreaterThan(0);
    expect(r.balanceAfterEarn).toBe(r.pointsEarned);
    expect(r.replay).toMatchObject({ replay: true, pointsEarned: r.pointsEarned });
    expect(r.settled).toMatchObject({ settled: true, points: r.pointsEarned });
    // Everything earned was redeemed and settled before the refund arrived: the
    // reversal takes back nothing live and reports all of it as the shortfall.
    expect(r.reversal).toEqual({
      posOrderRef: 'Shop/FLOW-1', reversedPoints: 0, shortfall: r.pointsEarned, pointsBalance: 0, replay: false,
    });
    const m = await backend.getMember(r.memberId);
    expect(liveBalance(m.lots)).toBe(0);
    expect((await backend.getHistory(r.memberId)).reduce((n, h) => n + h.deltaPoints, 0)).toBe(0);
    expect(await backend.getTillSale('Shop/FLOW-1')).toMatchObject({ status: 'reversed', shortfall: r.pointsEarned });
  });
});
