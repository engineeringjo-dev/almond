import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { config as loyalty } from '@almond/shared/config';
import { build } from '../src/server';
import { signIn } from './lib/signIn';

let app: FastifyInstance;
let token: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const post = (url: string, body: any) =>
  app.inject({ method: 'POST', url, payload: body, headers: { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() } });

beforeAll(async () => {
  app = await build();
  token = await signIn(app, '0790000000');
});

describe('Almond Club subscription', () => {
  it('subscribes (paid from wallet) and activates', async () => {
    const r = await post('/v1/subscription/subscribe', { paymentMethod: 'wallet' });
    expect(r.statusCode).toBe(201);
    expect(r.json().subscription.active).toBe(true);
    expect(r.json().subscription.remainingToday).toBe(loyalty.SUBSCRIPTION.drinksPerDay);
  });

  it('enforces the hard daily free-drink cap', async () => {
    for (let i = 0; i < loyalty.SUBSCRIPTION.drinksPerDay; i++) {
      const ok = await post('/v1/subscription/redeem', {});
      expect(ok.statusCode).toBe(201);
    }
    const over = await post('/v1/subscription/redeem', {});
    expect(over.statusCode).toBe(409);
    expect(over.json().error).toBe('daily_cap');
  });

  it('rejects redeem without an active subscription', async () => {
    // a fresh member (different phone) has no subscription
    const t2 = await signIn(app, '0788888888');
    const r = await app.inject({ method: 'POST', url: '/v1/subscription/redeem', payload: {}, headers: { authorization: `Bearer ${t2}`, 'idempotency-key': randomUUID() } });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toBe('not_subscribed');
  });
});
