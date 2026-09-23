/**
 * TILL SIMULATOR — drive one in-store sale through a RUNNING BFF, the way the
 * Odoo POS addon does. Starts nothing itself.
 *
 *   BFF_URL=http://127.0.0.1:8095 POS_SCAN_KEY=… MEMBER_JWT=… npx tsx scripts/pos/till-simulator.ts
 *
 * Without MEMBER_JWT it signs a member in through the real OTP flow and reads
 * the code from the development server's log (the `DEV OTP issued` line —
 * the same approach as scripts/load/bff-baseline.ts), so point it at the file
 * the dev server writes:
 *
 *   BFF_URL=… POS_SCAN_KEY=… MEMBER_PHONE=0791234567 BFF_LOG_FILE=/tmp/bff.log \
 *     npx tsx scripts/pos/till-simulator.ts
 *
 * Optional: BRANCH_ID (default b1), PAID_TOTAL (JOD, default 25).
 * Exits non-zero on the first step that does not answer as documented.
 */
import { readFileSync } from 'node:fs';
import { runTillFlow, type Http, type Reply } from './flow';

const BASE = (process.env.BFF_URL ?? 'http://127.0.0.1:8095').replace(/\/$/, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const http: Http = {
  async post(path, body, headers): Promise<Reply> {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { parsed = { raw: text }; }
    return { status: res.status, body: parsed };
  },
};

/** The real OTP flow; the code comes from the dev server's own log line. */
async function signIn(phone: string, logFile: string): Promise<string> {
  const before = readFileSync(logFile, 'utf8').length;
  const req = await http.post('/v1/auth/otp/request', { phone }, {});
  if (req.status !== 200) throw new Error(`otp/request ${req.status}: ${JSON.stringify(req.body)}`);
  let code: string | undefined;
  for (let i = 0; i < 50 && !code; i += 1) {
    for (const line of readFileSync(logFile, 'utf8').slice(before).split('\n')) {
      try {
        const j = JSON.parse(line) as { code?: string; msg?: string };
        if (j.code && /DEV OTP issued/.test(j.msg ?? '')) code = j.code;
      } catch { /* not a JSON log line */ }
    }
    if (!code) await sleep(50);
  }
  if (!code) throw new Error(`no "DEV OTP issued" line in ${logFile} — is the BFF in development with the log SMS sender?`);
  const ver = await http.post('/v1/auth/otp/verify', { phone, code }, {});
  if (ver.status !== 200) throw new Error(`otp/verify ${ver.status}: ${JSON.stringify(ver.body)}`);
  return String(ver.body.token);
}

async function main(): Promise<void> {
  const posKey = process.env.POS_SCAN_KEY;
  if (!posKey) throw new Error('set POS_SCAN_KEY (the same value the BFF runs with)');
  let jwt = process.env.MEMBER_JWT;
  if (!jwt) {
    const phone = process.env.MEMBER_PHONE;
    const logFile = process.env.BFF_LOG_FILE;
    if (!phone || !logFile) throw new Error('set MEMBER_JWT, or MEMBER_PHONE + BFF_LOG_FILE to sign in through the dev OTP log');
    jwt = await signIn(phone, logFile);
    console.log(`0 member signed in through the OTP flow (${phone})`);
  }
  const posOrderRef = `SIM/${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.floor(Math.random() * 1e4)}`;
  const r = await runTillFlow({
    http, posKey, memberJwt: jwt, posOrderRef,
    branchId: process.env.BRANCH_ID ?? 'b1',
    paidTotal: process.env.PAID_TOTAL ? Number(process.env.PAID_TOTAL) : 25,
    log: (line) => console.log(line),
  });
  console.log(`\nOK — ${posOrderRef}: earned ${r.pointsEarned}, redeemed ${r.redeemedPoints}, reversed ${String(r.reversal.reversedPoints)} with shortfall ${String(r.reversal.shortfall)}`);
}

main().catch((e: unknown) => { console.error(`FAILED: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
