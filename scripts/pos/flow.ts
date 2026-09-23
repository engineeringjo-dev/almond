/**
 * THE TILL FLOW — one sale, end to end, as a POS (the Odoo addon, or a person
 * with curl) drives it against the BFF. Transport-agnostic: the simulator runs
 * it over HTTP (till-simulator.ts), and bff/test/pos-flow.test.ts runs the SAME
 * function through Fastify's inject, so the documented flow is a tested flow.
 *
 *   1. member   POST /v1/pos/token {mode:'earn'}           → a 60 s QR
 *   2. till     POST /v1/pos/scan {token}                  → memberId + earnTicket
 *   3. till     POST /v1/pos/earn {earnTicket, posOrderRef, branchId, paidTotal, paidAt}
 *   4. till     the same /v1/pos/earn again (a retry)       → replay: true, nothing new
 *   5. member   POST /v1/loyalty/redeem {points}           → a redemption code
 *   6. member   POST /v1/me/redemption/qr                  → a redeem-mode QR
 *   7. till     POST /v1/pos/scan {token}                  → the redemption to take off
 *   8. till     POST /v1/pos/redemption/settle {code}      → settled (the QR was spent by
 *                                                           the scan; the CODE settles)
 *   9. till     POST /v1/pos/earn/reverse {posOrderRef, reason}  → the sale was refunded
 */
export interface Reply { status: number; body: Record<string, unknown> }
export interface Http {
  post(path: string, body: unknown, headers: Record<string, string>): Promise<Reply>;
}

export interface FlowOptions {
  http: Http;
  posKey: string;
  memberJwt: string;
  branchId?: string;
  paidTotal?: number;
  /** Unique per run: the POS order reference is the sale's idempotency key. */
  posOrderRef: string;
  log?: (line: string) => void;
}

export interface FlowResult {
  memberId: string;
  pointsEarned: number;
  balanceAfterEarn: number;
  replay: Record<string, unknown>;
  redeemedPoints: number;
  redemptionCode: string;
  settled: Record<string, unknown>;
  reversal: Record<string, unknown>;
}

function expectStatus(step: string, r: Reply, ...ok: number[]): Record<string, unknown> {
  if (!ok.includes(r.status)) {
    throw new Error(`${step}: HTTP ${r.status} ${JSON.stringify(r.body)} (expected ${ok.join('/')})`);
  }
  return r.body;
}
const str = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !v) throw new Error(`${what}: expected a string, got ${JSON.stringify(v)}`);
  return v;
};
const num = (v: unknown, what: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${what}: expected a number, got ${JSON.stringify(v)}`);
  return v;
};

export async function runTillFlow(o: FlowOptions): Promise<FlowResult> {
  const log = o.log ?? (() => {});
  const member = { authorization: `Bearer ${o.memberJwt}` };
  const till = { 'x-pos-key': o.posKey };
  const branchId = o.branchId ?? 'b1';
  const paidTotal = o.paidTotal ?? 25;
  const idem = () => ({ 'idempotency-key': `sim-${o.posOrderRef}-${Math.random().toString(36).slice(2)}` });

  const qr = expectStatus('1 member mints QR', await o.http.post('/v1/pos/token', { mode: 'earn' }, member), 200);
  log(`1 member QR minted (mode ${String(qr.mode)}, expires in ${String(qr.expiresIn)}s)`);

  const scan = expectStatus('2 till scans', await o.http.post('/v1/pos/scan', { token: str(qr.token, 'qr.token') }, till), 200);
  const memberId = str(scan.memberId, 'scan.memberId');
  const earnTicket = str(scan.earnTicket, 'scan.earnTicket (is this member on a corporate roster?)');
  log(`2 till scanned member ${memberId}: earnsPoints=${String(scan.earnsPoints)}, earn ticket valid ${String(scan.earnTicketExpiresIn)}s`);

  const sale = { earnTicket, posOrderRef: o.posOrderRef, branchId, paidTotal, paidAt: new Date().toISOString() };
  const earned = expectStatus('3 till earns', await o.http.post('/v1/pos/earn', sale, till), 201);
  const pointsEarned = num(earned.pointsEarned, 'earn.pointsEarned');
  const balanceAfterEarn = num(earned.pointsBalance, 'earn.pointsBalance');
  log(`3 till reported ${o.posOrderRef} paid ${paidTotal} JOD → +${pointsEarned} points (balance ${balanceAfterEarn})`);

  const replay = expectStatus('4 till retries', await o.http.post('/v1/pos/earn', sale, till), 200);
  if (replay.replay !== true || replay.pointsEarned !== pointsEarned) {
    throw new Error(`4 till retries: expected a replay of the same answer, got ${JSON.stringify(replay)}`);
  }
  log(`4 till retried ${o.posOrderRef} → replay:true, still +${pointsEarned} (nothing granted twice)`);

  const redeemedPoints = pointsEarned;
  const redeem = expectStatus('5 member redeems', await o.http.post('/v1/loyalty/redeem', { points: redeemedPoints }, { ...member, ...idem() }), 201);
  const redemption = redeem.redemption as Record<string, unknown>;
  log(`5 member redeemed ${redeemedPoints} points → code ${String(redemption.code)} worth ${String(redeem.valueJod)} JOD`);

  const rqr = expectStatus('6 member mints redeem QR', await o.http.post('/v1/me/redemption/qr', {}, member), 201);
  log(`6 member redeem QR minted (mode ${String(rqr.mode)})`);

  const rscan = expectStatus('7 till scans redeem QR', await o.http.post('/v1/pos/scan', { token: str(rqr.token, 'rqr.token') }, till), 200);
  const view = rscan.redemption as Record<string, unknown> | null;
  const redemptionCode = str(view?.code, 'scan.redemption.code');
  log(`7 till scanned the redeem QR: take ${String(view?.valueJod)} JOD off (code ${redemptionCode}); earnTicket=${String(rscan.earnTicket)}`);

  const settled = expectStatus('8 till settles', await o.http.post('/v1/pos/redemption/settle', { code: redemptionCode }, till), 201);
  log(`8 till settled the redemption: ${String(settled.points)} points / ${String(settled.valueJod)} JOD`);

  const reversal = expectStatus('9 till reverses', await o.http.post('/v1/pos/earn/reverse', { posOrderRef: o.posOrderRef, reason: 'refund (simulator)' }, till), 201);
  log(`9 till reversed ${o.posOrderRef}: took back ${String(reversal.reversedPoints)}, shortfall ${String(reversal.shortfall)} (already spent), balance ${String(reversal.pointsBalance)}`);

  return { memberId, pointsEarned, balanceAfterEarn, replay, redeemedPoints, redemptionCode, settled, reversal };
}
