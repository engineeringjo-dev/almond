import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { build } from '../src/server';
import type { Backend } from '../src/backend';
import { createMemoryBackend } from '../src/backend/memory';
import { createPostgresBackend } from '../src/backend/postgres';
import { config } from '../src/config';
import { issuePosToken, readRedemptionAuthorization } from '../src/pos/token';
import { __resetRateLimits } from '../src/plugins/rateLimit';
import { __resetOtpState } from '../src/auth/otp';
import { pgTestDb } from './lib/pgTestDb';
import { signIn } from './lib/signIn';

const KEY = 'presentation-apply-test-key'.padEnd(40, 'x');
const cfg = config as unknown as { POS_SCAN_KEY: string };
const originalKey = config.POS_SCAN_KEY;
let phoneSeq = 0;
beforeEach(() => { __resetRateLimits(); __resetOtpState(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe.each([
  ['memory', async () => createMemoryBackend()],
  ['postgres', async () => createPostgresBackend(await pgTestDb())],
] as [string, () => Promise<Backend>][])('120-second presentation to financial application — %s', (_name, make) => {
  let app: FastifyInstance;
  let backend: Backend;
  beforeAll(async () => { backend = await make(); app = await build(backend); cfg.POS_SCAN_KEY = KEY; }, 60_000);
  afterAll(async () => { cfg.POS_SCAN_KEY = originalKey; await app.close(); });
  const member = async () => {
    const jwt = await signIn(app, `079${String(8_000_000 + phoneSeq++).padStart(7, '0')}`);
    const id = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub as string;
    await backend.addPoints(id, 1000, 'Test', 'Test');
    return { jwt, id };
  };
  const mint = (jwt: string, id: string) => app.inject({ method: 'POST', url: '/v1/me/redemption/qr', headers: { authorization: `Bearer ${jwt}` }, payload: { redemptionId: id } });
  const scan = (token: string) => app.inject({ method: 'POST', url: '/v1/pos/scan', headers: { 'x-pos-key': KEY }, payload: { token } });
  const apply = (body: object, key = randomUUID()) => app.inject({ method: 'POST', url: '/v1/pos/redemption/settle', headers: { 'x-pos-key': KEY, 'idempotency-key': key }, payload: body });
  const made = async () => {
    const m = await member();
    const reserve = await backend.createRedemption(m.id, 100);
    const qrResponse = await mint(m.jwt, reserve.id);
    expect(qrResponse.statusCode, qrResponse.body).toBe(201);
    return { ...m, reserve, qr: qrResponse.json() };
  };
  const clock = (at: number) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(at); };

  it('scanning at119s preserves the original expiry; application at120s cannot spend', async () => {
    const { id, reserve, qr } = await made();
    clock(Date.parse(qr.expiresAt) - 1000);
    const result = await scan(qr.token);
    expect(result.statusCode, result.body).toBe(200);
    const receipt = result.json().redemption;
    expect(receipt).not.toHaveProperty('code');
    expect(receipt.presentationExpiresAt).toBe(qr.expiresAt);
    expect(readRedemptionAuthorization(receipt.settlementToken, 'settlement').exp * 1000).toBe(Date.parse(qr.expiresAt));
    vi.setSystemTime(Date.parse(qr.expiresAt));
    const refused = await apply({ settlementToken: receipt.settlementToken, posOrderRef: 'sale/late' });
    expect([refused.statusCode, refused.json().error]).toEqual([401, 'token_expired']);
    expect((await backend.getRedemption(id, reserve.id))?.settledAt).toBeNull();
    expect(liveBalance((await backend.getMember(id)).lots)).toBe(900);
  });

  it('recorded same-body/order/key recovery survives expiry; new spends and changed orders do not', async () => {
    const { id, reserve, qr } = await made();
    const scanned = await scan(qr.token);
    const body = { settlementToken: scanned.json().redemption.settlementToken, posOrderRef: `sale/${randomUUID()}` };
    const key = randomUUID();
    const first = await apply(body, key);
    expect(first.statusCode, first.body).toBe(201);
    expect(first.json()).toMatchObject({ memberId: id, points: 100, valueJod: 1, posOrderRef: body.posOrderRef });
    expect(first.json().redemption).not.toHaveProperty('code');
    // A distinct key while still fresh cannot award the same reserve again.
    const duplicate = await apply(body);
    expect(duplicate.statusCode, duplicate.body).toBe(409);
    clock(Date.parse(qr.expiresAt));
    const retry = await apply(body, key);
    expect(retry.statusCode, retry.body).toBe(201);
    expect(retry.body).toBe(first.body);
    expect(retry.headers['idempotent-replay']).toBe('true');
    const changed = await apply({ ...body, posOrderRef: 'another-sale' }, key);
    expect([changed.statusCode, changed.json().error]).toEqual([422, 'idempotency_key_reused']);
    for (const freshBody of [body, { ...body, posOrderRef: 'another-sale' }, { token: qr.token, posOrderRef: body.posOrderRef }]) {
      const fresh = await apply(freshBody);
      expect([fresh.statusCode, fresh.json().error]).toEqual([401, 'token_expired']);
    }
    expect((await backend.getRedemption(id, reserve.id))?.settledAt).not.toBeNull();
    expect(liveBalance((await backend.getMember(id)).lots)).toBe(900);
  });

  it('signature, purpose and POS authorization precede any retry claim', async () => {
    const { id, qr } = await made();
    const claim = vi.spyOn(backend, 'claimIdempotencyKey');
    const key = randomUUID();
    for (const body of [
      { token: `${qr.token.slice(0, -1)}!`, posOrderRef: 'sale/invalid' },
      { token: issuePosToken(id).token, posOrderRef: 'sale/member' },
      { settlementToken: qr.token, posOrderRef: 'sale/wrong-domain' },
    ]) {
      const result = await apply(body, key);
      expect(result.statusCode, result.body).toBe(401);
    }
    const unauthorized = await app.inject({ method: 'POST', url: '/v1/pos/redemption/settle', headers: { 'idempotency-key': key }, payload: { token: qr.token, posOrderRef: 'sale/no-key' } });
    expect(unauthorized.statusCode).toBe(401);
    expect(claim).not.toHaveBeenCalled();
  });

  it('both legacy typed-code paths are closed and public metadata never exposes a code', async () => {
    const { jwt, id, reserve } = await made();
    const pos = await apply({ code: reserve.code, posOrderRef: 'sale/typed' });
    expect([pos.statusCode, pos.json().error]).toEqual([400, 'redemption_barcode_required']);
    const web = await app.inject({ method: 'POST', url: '/v1/loyalty/redemption/settle', headers: { authorization: `Bearer ${jwt}`, 'idempotency-key': randomUUID() }, payload: { code: reserve.code } });
    expect([web.statusCode, web.json().error]).toEqual([400, 'redemption_barcode_required']);
    for (const path of ['/v1/me/redemption', `/v1/me/redemption/${reserve.id}`]) {
      const response = await app.inject({ method: 'GET', url: path, headers: { authorization: `Bearer ${jwt}` } });
      expect(response.statusCode).toBe(200);
      expect(response.json().redemption).not.toHaveProperty('code');
    }
    expect((await backend.getRedemption(id, reserve.id))?.settledAt).toBeNull();
  });

  it('reissue targets the same reserve without another debit or extended reservation', async () => {
    const { jwt, id, reserve, qr } = await made();
    clock(Date.parse(qr.issuedAt) + 120_000);
    const reissued = await mint(jwt, reserve.id);
    expect(reissued.statusCode, reissued.body).toBe(201);
    expect(reissued.json().token).not.toBe(qr.token);
    expect(reissued.json().redemptionId).toBe(reserve.id);
    expect((await backend.getRedemption(id, reserve.id))?.expiresAt).toBe(reserve.expiresAt);
    expect(liveBalance((await backend.getMember(id)).lots)).toBe(900);
  });

  it('post-commit balance read failure cannot release the create key and debit a second time', async () => {
    const { jwt, id } = await member();
    const key = randomUUID();
    const original = backend.getMember.bind(backend);
    vi.spyOn(backend, 'getMember').mockRejectedValueOnce(new Error('balance read unavailable'));
    const request = { method: 'POST' as const, url: '/v1/loyalty/redeem', headers: { authorization: `Bearer ${jwt}`, 'idempotency-key': key }, payload: { points: 100 } };
    const first = await app.inject(request);
    expect(first.statusCode, first.body).toBe(201);
    const second = await app.inject(request);
    expect(second.statusCode, second.body).toBe(201);
    expect(second.json().redemption.id).toBe(first.json().redemption.id);
    expect(second.headers['idempotent-replay']).toBe('true');
    expect(liveBalance((await original(id)).lots)).toBe(900);
  });
});
