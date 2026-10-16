import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RedemptionRow } from '@almond/shared/loyalty/redemption';
import { build } from '../src/server';
import { config } from '../src/config';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import type { Backend } from '../src/backend';
import { issuePosToken, issueRedemptionToken } from '../src/pos/token';
import { __resetRateLimits } from '../src/plugins/rateLimit';
import { __resetOtpState } from '../src/auth/otp';
import { pgTestDb } from './lib/pgTestDb';
import { signIn } from './lib/signIn';

/** A QR for voucher A must never become authority for voucher B. Real HTTP
 * routes and both stores are exercised: cryptography alone cannot prove that
 * a consumer reads the id that was signed rather than the latest member row. */
const KEY = 'bound-redemption-test-pos-key-'.padEnd(40, 'x');
const cfg = config as unknown as { POS_SCAN_KEY: string; REDEMPTION_QR_TTL_SECONDS: number };
const previous = { key: config.POS_SCAN_KEY, ttl: config.REDEMPTION_QR_TTL_SECONDS };
let phoneSeq = 0;
const phone = () => `079${String(7_000_000 + phoneSeq++).padStart(7, '0')}`;
const subject = (jwt: string): string => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub;

beforeEach(() => { __resetRateLimits(); __resetOtpState(); });
afterEach(() => {
  vi.restoreAllMocks();
  cfg.REDEMPTION_QR_TTL_SECONDS = previous.ttl;
});

describe.each([
  ['memory', async () => createMemoryBackend()],
  ['postgres', async () => createPostgresBackend(await pgTestDb())],
] as [string, () => Promise<Backend>][])('Bound redemption presentation — %s', (_name, make) => {
  let app: FastifyInstance;
  let backend: Backend;
  beforeAll(async () => { backend = await make(); app = await build(backend); cfg.POS_SCAN_KEY = KEY; }, 60_000);
  afterAll(async () => { cfg.POS_SCAN_KEY = previous.key; await app.close(); });

  const member = async () => {
    const jwt = await signIn(app, phone());
    const id = subject(jwt);
    await backend.addPoints(id, 1000, 'Test grant', 'Test grant');
    return { jwt, id };
  };
  const mint = (jwt: string, redemptionId?: string) => app.inject({
    method: 'POST', url: '/v1/me/redemption/qr',
    headers: { authorization: `Bearer ${jwt}` }, payload: redemptionId ? { redemptionId } : {},
  });
  const settle = (credential: { token: string } | { settlementToken: string }) => app.inject({
    method: 'POST', url: '/v1/pos/redemption/settle',
    headers: { 'x-pos-key': KEY, 'idempotency-key': randomUUID() },
    payload: { ...credential, posOrderRef: `bound/${randomUUID()}` },
  });
  const pos = (path: 'scan' | 'redemption/settle', token: string) => path === 'scan'
    ? app.inject({ method: 'POST', url: '/v1/pos/scan', headers: { 'x-pos-key': KEY }, payload: { token } })
    : settle({ token });
  const made = async () => {
    const m = await member();
    const a = await backend.createRedemption(m.id, 100);
    return { ...m, a };
  };

  it('signs exact member, purpose and redemption, with a TTL separate from the membership code', async () => {
    const { jwt, id, a } = await made();
    const result = await mint(jwt, a.id);
    expect(result.statusCode, result.body).toBe(201);
    const wire = result.json();
    const claims = JSON.parse(Buffer.from(wire.token.split('.')[0], 'base64url').toString());
    expect(claims).toMatchObject({ sub: id, purpose: 'redemption', mode: 'redeem', redemptionId: a.id });
    expect(wire.redemptionId).toBe(a.id);
    expect(wire.expiresIn).toBe(config.REDEMPTION_QR_TTL_SECONDS);
    expect(wire.expiresIn).toBe(120);
    expect(Date.parse(wire.expiresAt) - Date.parse(wire.issuedAt)).toBe(wire.expiresIn * 1000);
    expect(issuePosToken(id).expiresIn).toBe(config.POS_TOKEN_TTL_SECONDS);
    expect(config.POS_TOKEN_TTL_SECONDS).toBe(60);
  });

  it.each(['scan', 'redemption/settle'] as const)('%s resolves A even while a newer B is pending', async (path) => {
    const { jwt, id, a } = await made();
    const qr = (await mint(jwt, a.id)).json();
    const b = await backend.createRedemption(id, 200);
    const result = await pos(path, qr.token);
    expect(result.statusCode, result.body).toBe(path === 'scan' ? 200 : 201);
    expect(result.json().redemption.id).toBe(a.id);
    expect(result.json().redemption.valueJod).toBe(a.valueJod);
    expect(result.json().redemption).not.toHaveProperty('code');
    expect((await backend.getRedemption(id, b.id))?.settledAt).toBeNull();
    if (path === 'scan') {
      expect(result.json().earnTicket).toBeNull();
      expect(result.json().spendTicket).toBeNull();
      expect((await backend.getRedemption(id, a.id))?.settledAt).toBeNull();
      expect(result.json().redemption.settlementToken).toEqual(expect.any(String));
      expect(result.json().redemption.presentationExpiresAt).toBe(qr.expiresAt);
      const applied = await settle({ settlementToken: result.json().redemption.settlementToken });
      expect(applied.statusCode, applied.body).toBe(201);
      expect(applied.json().redemption.id).toBe(a.id);
      expect(applied.json().valueJod).toBe(a.valueJod);
      expect((await backend.getRedemption(id, b.id))?.settledAt).toBeNull();
    }
  });

  it.each(['scan', 'redemption/settle'] as const)('cancel A then create B cannot retarget the old QR at %s', async (path) => {
    const { jwt, id, a } = await made();
    const qr = (await mint(jwt, a.id)).json();
    await backend.cancelRedemption(id, a.id, new Date());
    const b = await backend.createRedemption(id, 200);
    const result = await pos(path, qr.token);
    expect(result.statusCode, result.body).toBe(path === 'scan' ? 404 : 409);
    expect((await backend.getRedemption(id, b.id))?.settledAt).toBeNull();
    expect((await backend.getRedemption(id, a.id))?.cancelledAt).not.toBeNull();
  });

  it.each(['scan', 'redemption/settle'] as const)('%s refuses unknown ids and ids belonging to another member, even with a valid MAC', async (path) => {
    const { id, a } = await made();
    const other = await member();
    for (const row of [{ ...a, id: `missing_${randomUUID()}` }, { ...a, memberId: other.id }]) {
      const result = await pos(path, issueRedemptionToken(row).token);
      expect(result.statusCode, result.body).toBe(404);
    }
    expect((await backend.getRedemption(id, a.id))?.settledAt).toBeNull();
  });

  it('issuance cannot select another member’s voucher, cancelled voucher or missing id', async () => {
    const { jwt, id, a } = await made();
    const other = await member();
    expect((await mint(other.jwt, a.id)).statusCode).toBe(404);
    expect((await mint(jwt, `missing_${randomUUID()}`)).statusCode).toBe(404);
    await backend.cancelRedemption(id, a.id, new Date());
    expect((await mint(jwt, a.id)).statusCode).toBe(404);
    const unauthenticated = await app.inject({ method: 'POST', url: '/v1/me/redemption/qr', payload: { redemptionId: a.id } });
    expect(unauthenticated.statusCode).toBe(401);
  });

  it('tampering with the voucher, owner or purpose invalidates the whole QR', async () => {
    const { jwt, id, a } = await made();
    const wire = (await mint(jwt, a.id)).json();
    const [body, signature] = wire.token.split('.');
    const original = JSON.parse(Buffer.from(body, 'base64url').toString());
    for (const patch of [{ redemptionId: 'other' }, { sub: 'another-member' }, { purpose: 'pay' }]) {
      const changed = Buffer.from(JSON.stringify({ ...original, ...patch })).toString('base64url');
      const result = await pos('redemption/settle', `${changed}.${signature}`);
      expect([result.statusCode, result.json().error]).toEqual([401, 'token_invalid']);
    }
    expect((await backend.getRedemption(id, a.id))?.settledAt).toBeNull();
  });

  it('rejects the unbound legacy mint/QR and refuses other QR purposes for settlement', async () => {
    const { jwt, id, a } = await made();
    const oldMint = await app.inject({
      method: 'POST', url: '/v1/pos/token', headers: { authorization: `Bearer ${jwt}` }, payload: { mode: 'redeem' },
    });
    expect(oldMint.statusCode).toBe(400);
    // A genuinely signed old redeem token must fail closed after rollout too;
    // otherwise the old route/format would bypass the new voucher binding.
    const body = Buffer.from(JSON.stringify({ sub: id, mode: 'redeem', jti: randomUUID(), exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
    const signature = createHmac('sha256', config.POS_TOKEN_SECRET).update(body).digest('base64url');
    expect((await pos('scan', `${body}.${signature}`)).statusCode).toBe(401);
    expect((await pos('redemption/settle', `${body}.${signature}`)).statusCode).toBe(401);
    for (const mode of ['pay', 'earn', 'corporate'] as const) {
      const result = await pos('redemption/settle', issuePosToken(id, mode).token);
      expect([result.statusCode, result.json().error]).toEqual([401, 'token_invalid']);
    }
    expect((await backend.getRedemption(id, a.id))?.settledAt).toBeNull();
  });

  it.each(['scan', 'redemption/settle'] as const)('%s rejects at the exact expiry boundary, not one second later', async (path) => {
    const { jwt, id, a } = await made();
    const wire = (await mint(jwt, a.id)).json();
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(wire.expiresAt));
    const result = await pos(path, wire.token);
    expect([result.statusCode, result.json().error]).toEqual([401, 'token_expired']);
    expect((await backend.getRedemption(id, a.id))?.settledAt).toBeNull();
  });

  it('honours its own TTL dial and never outlives the underlying entitlement', async () => {
    const { jwt, a } = await made();
    cfg.REDEMPTION_QR_TTL_SECONDS = 37;
    const wire = (await mint(jwt, a.id)).json();
    expect(wire.expiresIn).toBe(37);
    expect(config.POS_TOKEN_TTL_SECONDS).toBe(60);
    const now = Math.floor(Date.now() / 1000) * 1000;
    const short: Pick<RedemptionRow, 'id' | 'memberId' | 'expiresAt'> = { ...a, expiresAt: new Date(now + 9000).toISOString() };
    const capped = issueRedemptionToken(short, now);
    expect(capped.expiresIn).toBe(9);
    expect(capped.expiresAt).toBe(short.expiresAt);
  });
});
