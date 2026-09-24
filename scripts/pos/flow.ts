/**
 * THE TILL FLOW — two visits, end to end, as a POS (the Odoo addon, or a person
 * with curl) drives it against the BFF. Transport-agnostic: the simulator runs
 * it over HTTP (till-simulator.ts), and bff/test/pos-flow.test.ts runs the SAME
 * function through Fastify's inject, so the documented flow is a tested flow.
 *
 * ONE MEMBER CODE, SCANNED ONCE PER VISIT (owner, 2026-09-24). The member does
 * not pick a mode; they say at the counter whether to use their points. The
 * scan hands the till an earn ticket AND a spend ticket; points go on the bill
 * as a TENDER, and only the MONEY part earns.
 *
 *   visit A — earn
 *    1. member   POST /v1/pos/token {}                      → the one 60 s code
 *    2. till     POST /v1/pos/scan {token}                  → memberId, balance, earnTicket, spendTicket
 *    3. till     POST /v1/pos/earn {earnTicket, posOrderRef A, branchId, paidTotal, paidAt}
 *    4. till     the same /v1/pos/earn again (a retry)       → replay: true, nothing new
 *   visit B — pay part of the bill with points, earn on the rest, then void
 *    5. member   POST /v1/pos/token {}                      → a fresh code
 *    6. till     POST /v1/pos/scan {token}                  → pointsBalance, spendableJod, tickets (ONE scan)
 *    7. till     POST /v1/pos/points/spend {spendTicket, posOrderRef B, points}  → valueJod: the tender
 *    8. till     the same spend again (a retry)             → replay: true, nothing new
 *    9. till     POST /v1/pos/earn {earnTicket, posOrderRef B, paidTotal = bill − valueJod}
 *   10. till     POST /v1/pos/points/spend/reverse {posOrderRef B, reason}  → the points come back
 *   11. till     POST /v1/pos/earn/reverse {posOrderRef B, reason}          → the grant goes back out
 *   later — a PARTIAL refund of visit A (one item returned)
 *   12. till     POST /v1/pos/earn/reverse {posOrderRef A, reason, refundRef, refundedTotal}
 *                → only that part's share of the points comes back out
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
  /** Visit A's money, JOD. Default 25 — 50 points on the entry rung. */
  paidTotal?: number;
  /** Visit B's bill, JOD, before the points tender. Default 6. */
  billTotal?: number;
  /** Points the member uses on visit B. Default 50. */
  spendPoints?: number;
  /** Money refunded from visit A later, JOD. Default 5. */
  refundedTotal?: number;
  /** Unique per run: the POS order reference is the sale's idempotency key.
   *  Visit A uses it as given; visit B appends "-B". */
  posOrderRef: string;
  log?: (line: string) => void;
}

export interface FlowResult {
  memberId: string;
  pointsEarned: number;
  balanceAfterEarn: number;
  replay: Record<string, unknown>;
  scanB: Record<string, unknown>;
  spent: Record<string, unknown>;
  spendReplay: Record<string, unknown>;
  earnedB: Record<string, unknown>;
  unspent: Record<string, unknown>;
  reversal: Record<string, unknown>;
  partialRefund: Record<string, unknown>;
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
/** Money is whole fils at the till. */
const fils = (jod: number): number => Math.round(jod * 1000) / 1000;

export async function runTillFlow(o: FlowOptions): Promise<FlowResult> {
  const log = o.log ?? (() => {});
  const member = { authorization: `Bearer ${o.memberJwt}` };
  const till = { 'x-pos-key': o.posKey };
  const branchId = o.branchId ?? 'b1';
  const paidTotal = o.paidTotal ?? 25;
  const billTotal = o.billTotal ?? 6;
  const spendPoints = o.spendPoints ?? 50;
  const refundedTotal = o.refundedTotal ?? 5;
  const refA = o.posOrderRef;
  const refB = `${o.posOrderRef}-B`;

  // ---- visit A: earn ----
  const qr = expectStatus('1 member mints the code', await o.http.post('/v1/pos/token', {}, member), 200);
  log(`1 member code minted (expires in ${String(qr.expiresIn)}s) — one code, no mode to pick`);

  const scan = expectStatus('2 till scans', await o.http.post('/v1/pos/scan', { token: str(qr.token, 'qr.token') }, till), 200);
  const memberId = str(scan.memberId, 'scan.memberId');
  const earnTicket = str(scan.earnTicket, 'scan.earnTicket (is this member on a corporate roster?)');
  str(scan.spendTicket, 'scan.spendTicket');
  log(`2 till scanned member ${memberId}: balance ${String(scan.pointsBalance)} (${String(scan.spendableJod)} JOD), earnsPoints=${String(scan.earnsPoints)}, earn + spend tickets`);

  const sale = { earnTicket, posOrderRef: refA, branchId, paidTotal, paidAt: new Date().toISOString() };
  const earned = expectStatus('3 till earns', await o.http.post('/v1/pos/earn', sale, till), 201);
  const pointsEarned = num(earned.pointsEarned, 'earn.pointsEarned');
  const balanceAfterEarn = num(earned.pointsBalance, 'earn.pointsBalance');
  log(`3 till reported ${refA} paid ${paidTotal} JOD → +${pointsEarned} points (balance ${balanceAfterEarn})`);

  const replay = expectStatus('4 till retries', await o.http.post('/v1/pos/earn', sale, till), 200);
  if (replay.replay !== true || replay.pointsEarned !== pointsEarned) {
    throw new Error(`4 till retries: expected a replay of the same answer, got ${JSON.stringify(replay)}`);
  }
  log(`4 till retried ${refA} → replay:true, still +${pointsEarned} (nothing granted twice)`);

  // ---- visit B: one scan, points as a tender, earn on the money part ----
  const qrB = expectStatus('5 member mints the code again', await o.http.post('/v1/pos/token', {}, member), 200);
  log('5 member code minted for the next visit');

  const scanB = expectStatus('6 till scans once', await o.http.post('/v1/pos/scan', { token: str(qrB.token, 'qrB.token') }, till), 200);
  const balanceB = num(scanB.pointsBalance, 'scanB.pointsBalance');
  if (balanceB < spendPoints) {
    throw new Error(`6 till scans once: the member holds ${balanceB} points, fewer than the ${spendPoints} this flow spends — raise PAID_TOTAL`);
  }
  log(`6 till scanned once: balance ${balanceB} points = ${String(scanB.spendableJod)} JOD spendable; the member says "use ${spendPoints} points"`);

  const spendBody = { spendTicket: str(scanB.spendTicket, 'scanB.spendTicket'), posOrderRef: refB, points: spendPoints };
  const spent = expectStatus('7 till takes the points tender', await o.http.post('/v1/pos/points/spend', spendBody, till), 201);
  const tender = num(spent.valueJod, 'spend.valueJod');
  log(`7 till spent ${String(spent.pointsSpent)} points on ${refB} → ${tender} JOD off the bill as the points tender (balance ${String(spent.pointsBalance)})`);

  const spendReplay = expectStatus('8 till retries the spend', await o.http.post('/v1/pos/points/spend', spendBody, till), 200);
  if (spendReplay.replay !== true || spendReplay.pointsSpent !== spent.pointsSpent) {
    throw new Error(`8 till retries the spend: expected a replay, got ${JSON.stringify(spendReplay)}`);
  }
  log('8 till retried the spend → replay:true, nothing taken twice');

  const money = fils(billTotal - tender);
  const earnedB = expectStatus('9 till earns on the money part', await o.http.post('/v1/pos/earn', {
    earnTicket: str(scanB.earnTicket, 'scanB.earnTicket'), posOrderRef: refB, branchId, paidTotal: money, paidAt: new Date().toISOString(),
  }, till), 201);
  log(`9 till reported ${refB}: bill ${billTotal} − points ${tender} = ${money} JOD in money → +${String(earnedB.pointsEarned)} points (the tender earns nothing)`);

  const unspent = expectStatus('10 till voids the points tender', await o.http.post('/v1/pos/points/spend/reverse', { posOrderRef: refB, reason: 'void (simulator)' }, till), 201);
  log(`10 till voided ${refB}'s tender: ${String(unspent.pointsReturned)} points back on their original expiry (${String(unspent.pointsExpired)} expired meanwhile), balance ${String(unspent.pointsBalance)}`);

  const reversal = expectStatus('11 till reverses the earn', await o.http.post('/v1/pos/earn/reverse', { posOrderRef: refB, reason: 'void (simulator)' }, till), 201);
  log(`11 till reversed ${refB}'s earn: took back ${String(reversal.reversedPoints)}, shortfall ${String(reversal.shortfall)}, balance ${String(reversal.pointsBalance)}`);

  // ---- later: one item from visit A comes back ----
  const partialRefund = expectStatus('12 till refunds part of visit A', await o.http.post('/v1/pos/earn/reverse', {
    posOrderRef: refA, reason: 'item returned (simulator)', refundRef: `${refA}/R1`, refundedTotal,
  }, till), 201);
  log(`12 till refunded ${refundedTotal} of ${paidTotal} JOD on ${refA}: took back ${String(partialRefund.reversedPoints)} of ${pointsEarned} points (the refunded part only), balance ${String(partialRefund.pointsBalance)}`);

  return { memberId, pointsEarned, balanceAfterEarn, replay, scanB, spent, spendReplay, earnedB, unspent, reversal, partialRefund };
}
