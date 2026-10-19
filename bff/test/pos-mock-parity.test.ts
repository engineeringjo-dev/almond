import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { build } from '../src/server';
import type { Backend } from '../src/backend';
import { createMemoryBackend } from '../src/backend/memory';
import { config } from '../src/config';
import { __resetRateLimits } from '../src/plugins/rateLimit';
import { __resetOtpState } from '../src/auth/otp';
import { signIn } from './lib/signIn';

/**
 * PARITY — the Odoo addon's tests run against a stdlib Python mock of the till
 * routes (integrations/almond_loyalty_pos/mock/almond_bff_mock.py), never
 * against this server. A mock that drifts makes those tests green while the
 * real guard is gone: review item 6 (docs/CODEX-LOYALTY-REVIEW-2026-10-19.ar.md)
 * found exactly that, «اختبار الموديول أخضر لأنه يعمل ضد المحاكي فقط».
 *
 * So the single-use sequence of a redemption QR runs, step for step, against
 * the real routes AND the mock process, and both must give the same table.
 */
interface Reply { status: number; body: Record<string, unknown> }
interface Till {
  /** A redeem-mode QR bound to a fresh 1 JOD (100-point) reservation. */
  mintRedeemQr(): Promise<string>;
  /** A member (pay) QR: never a redemption credential. */
  mintMemberQr(): Promise<string>;
  post(path: string, body: object, headers: Record<string, string>): Promise<Reply>;
}
type Outcome = [step: string, status: number, error: string | null, posOrderRef: string | null];

async function singleUseSequence(till: Till, posKey: string): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  const record = (step: string, reply: Reply): Reply => {
    const error = typeof reply.body.error === 'string' ? reply.body.error : null;
    const ref = reply.status < 300 && typeof reply.body.posOrderRef === 'string' ? reply.body.posOrderRef : null;
    outcomes.push([step, reply.status, error, ref]);
    return reply;
  };
  const scan = (token: string) => till.post('/v1/pos/scan', { token }, { 'x-pos-key': posKey });
  const settle = (body: object, key: string = randomUUID()) =>
    till.post('/v1/pos/redemption/settle', body, { 'x-pos-key': posKey, 'idempotency-key': key });

  // A. The review's proof: a scanned QR, then its raw token on another till.
  const a = await till.mintRedeemQr();
  const scanned = record('scan', await scan(a));
  record('scan again', await scan(a));
  record('scanned raw token, other order', await settle({ token: a, posOrderRef: 'other-till/1' }));
  const redemption = (scanned.body.redemption ?? {}) as { settlementToken?: string };
  const receipt = { settlementToken: redemption.settlementToken ?? 'missing', posOrderRef: 'till/1' };
  const receiptKey = randomUUID();
  record('receipt, scanning order', await settle(receipt, receiptKey));
  record('receipt, same key again', await settle(receipt, receiptKey));
  record('receipt, other order', await settle({ ...receipt, posOrderRef: 'other-till/2' }));

  // B. A QR that was never scanned settles by raw token once, without burning it.
  const b = await till.mintRedeemQr();
  const raw = { token: b, posOrderRef: 'till/3' };
  const rawKey = randomUUID();
  record('raw token, first', await settle(raw, rawKey));
  record('raw token, other order', await settle({ ...raw, posOrderRef: 'other-till/3' }));
  record('scan after settle', await scan(b));
  record('raw token, same key again', await settle(raw, rawKey));
  record('raw token now scanned, other order', await settle({ ...raw, posOrderRef: 'other-till/4' }));

  // C. A member QR offered as a redemption is not one.
  record('member QR as a redemption', await settle({ token: await till.mintMemberQr(), posOrderRef: 'till/5' }));
  return outcomes;
}

/** What both implementations must answer. */
const EXPECTED: Outcome[] = [
  ['scan', 200, null, null],
  ['scan again', 409, 'pos_token_replay', null],
  ['scanned raw token, other order', 409, 'pos_token_replay', null],
  ['receipt, scanning order', 201, null, 'till/1'],
  ['receipt, same key again', 201, null, 'till/1'],
  ['receipt, other order', 409, 'redemption_already_settled', null],
  ['raw token, first', 201, null, 'till/3'],
  ['raw token, other order', 409, 'redemption_already_settled', null],
  ['scan after settle', 404, 'not_found', null],
  ['raw token, same key again', 201, null, 'till/3'],
  ['raw token now scanned, other order', 409, 'pos_token_replay', null],
  ['member QR as a redemption', 401, 'token_invalid', null],
];

const KEY = 'pos-mock-parity-key-'.padEnd(40, 'p');
const cfg = config as unknown as { POS_SCAN_KEY: string };
const originalKey = config.POS_SCAN_KEY;
const MOCK_DIR = fileURLToPath(new URL('../../integrations/almond_loyalty_pos/mock/', import.meta.url));
const PYTHON = process.env.PYTHON ?? 'python3';
// The mock's documented test API: make_server(port=0) picks a free port.
const START_MOCK = [
  'import sys',
  'sys.path.insert(0, sys.argv[1])',
  'import almond_bff_mock',
  'server = almond_bff_mock.make_server(port=0, pos_key=sys.argv[2])',
  'print(server.server_address[1], flush=True)',
  'server.serve_forever()',
].join('\n');

/** Start the mock and resolve its port. The caller stops it by this child's PID. */
function startMock(): Promise<{ child: ChildProcess; port: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, ['-I', '-u', '-c', START_MOCK, MOCK_DIR, KEY], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`the till mock did not start: ${err}`)); }, 15_000);
    child.stderr!.on('data', (chunk: Buffer) => { err += chunk.toString(); });
    child.stdout!.on('data', (chunk: Buffer) => {
      out += chunk.toString();
      const line = out.split('\n')[0];
      if (out.includes('\n') && /^\d+$/.test(line.trim())) {
        clearTimeout(timer);
        resolve({ child, port: Number(line.trim()) });
      }
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`${PYTHON} is required to run the till mock (${e.message})`));
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`the till mock exited (${code}): ${err}`));
    });
  });
}

describe('PARITY the redemption QR single-use sequence: real routes and the Odoo addon mock', () => {
  let app: FastifyInstance;
  let backend: Backend;
  let mock: ChildProcess | undefined;
  let mockPid: number | undefined;
  let mockBase = '';
  let phoneSeq = 0;

  beforeAll(async () => {
    backend = createMemoryBackend();
    app = await build(backend);
    cfg.POS_SCAN_KEY = KEY;
    const started = await startMock();
    mock = started.child;
    mockPid = started.child.pid;
    mockBase = `http://127.0.0.1:${started.port}`;
  }, 30_000);
  afterAll(async () => {
    cfg.POS_SCAN_KEY = originalKey;
    await app?.close();
    if (mock && mockPid !== undefined && mock.exitCode === null) {
      const exited = new Promise((done) => mock!.once('exit', done));
      process.kill(mockPid, 'SIGTERM');
      await exited;
    }
  });
  beforeEach(() => { __resetRateLimits(); __resetOtpState(); });

  const member = async () => {
    const jwt = await signIn(app, `079${String(7_400_000 + phoneSeq++).padStart(7, '0')}`);
    return { jwt, id: JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub as string };
  };
  const real: Till = {
    async mintRedeemQr() {
      const { jwt, id } = await member();
      await backend.addPoints(id, 1000, 'Test', 'Test');
      const reserve = await backend.createRedemption(id, 100);
      const qr = await app.inject({ method: 'POST', url: '/v1/me/redemption/qr', headers: { authorization: `Bearer ${jwt}` }, payload: { redemptionId: reserve.id } });
      if (qr.statusCode !== 201) throw new Error(`mint failed: ${qr.statusCode} ${qr.body}`);
      return qr.json().token as string;
    },
    async mintMemberQr() {
      const { jwt } = await member();
      const qr = await app.inject({ method: 'POST', url: '/v1/pos/token', headers: { authorization: `Bearer ${jwt}` }, payload: {} });
      if (qr.statusCode !== 200) throw new Error(`member QR failed: ${qr.statusCode} ${qr.body}`);
      return qr.json().token as string;
    },
    async post(path, body, headers) {
      const r = await app.inject({ method: 'POST', url: path, payload: body as Record<string, unknown>, headers });
      return { status: r.statusCode, body: r.body ? (r.json() as Record<string, unknown>) : {} };
    },
  };
  const mocked: Till = {
    async mintRedeemQr() {
      const r = await mocked.post('/__mock/token', { memberId: `m-parity-${randomUUID()}`, mode: 'redeem', redemptionValueJod: 1 }, {});
      if (r.status !== 200 || typeof r.body.token !== 'string') throw new Error(`mock mint failed: ${r.status}`);
      return r.body.token;
    },
    async mintMemberQr() {
      const r = await mocked.post('/__mock/token', { memberId: `m-parity-${randomUUID()}`, mode: 'pay' }, {});
      if (r.status !== 200 || typeof r.body.token !== 'string') throw new Error(`mock member QR failed: ${r.status}`);
      return r.body.token;
    },
    async post(path, body, headers) {
      const r = await fetch(mockBase + path, {
        method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
      });
      const text = await r.text();
      return { status: r.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
    },
  };

  it('the real routes answer the expected table', async () => {
    expect(await singleUseSequence(real, KEY)).toEqual(EXPECTED);
  });

  it('the mock answers the same table, step for step', async () => {
    expect(await singleUseSequence(mocked, KEY)).toEqual(await singleUseSequence(real, KEY));
  });
});
