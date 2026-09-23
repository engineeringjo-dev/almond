import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import type { Backend } from '../src/backend';
import { signIn } from './lib/signIn';

/**
 * RA — a failure AFTER the points are spent must not become a 5xx.
 *
 * The idempotency plugin releases a key on a 5xx, because a 5xx normally means
 * nothing happened. /v1/loyalty/redeem spends the points and mints the code in
 * one backend call, then reads the balance separately for the reply. If that
 * read failed, the 500 released the key and the client's retry — the right
 * thing for a client to do — spent the same points again and minted a second
 * code. The reply must be 201 with the code, and the retry a replay.
 */
describe('RA redeem: a failed balance read after the spend', () => {
  let app: FastifyInstance;
  let backend: Backend;
  let token = '';
  let failReads = 0;
  const PHONE = '0791230000';

  beforeAll(async () => {
    const real = createMemoryBackend();
    backend = {
      ...real,
      async getMember(id: string) {
        if (failReads > 0) { failReads--; throw new Error('db read timed out'); }
        return real.getMember(id);
      },
    };
    app = await build(backend);
    token = await signIn(app, PHONE);
    const m = await real.findOrCreateByPhone('+962791230000');
    await real.addPoints(m.id, 1000, 'رصيد اختبار', 'Test grant');
  });
  afterAll(async () => { await app.close(); });

  it('answers 201 with the code, and a retry with the same key spends nothing more', async () => {
    const headers = { authorization: `Bearer ${token}`, 'idempotency-key': 'ra-key-1' };
    failReads = 1; // exactly the read after the committed spend
    const first = await app.inject({ method: 'POST', url: '/v1/loyalty/redeem', payload: { points: 300 }, headers });
    expect(first.statusCode, first.body).toBe(201);
    expect(first.json().redemption.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(first.json().pointsBalance).toBeNull();

    const retry = await app.inject({ method: 'POST', url: '/v1/loyalty/redeem', payload: { points: 300 }, headers });
    expect(retry.statusCode).toBe(201);
    expect(retry.body).toBe(first.body); // a replay, not a second redemption

    const m = await backend.findOrCreateByPhone('+962791230000');
    expect(liveBalance((await backend.getMember(m.id)).lots)).toBe(700); // spent ONCE
  });
});
