/**
 * BFF load BASELINE — not a capacity claim.
 *
 *   npx tsx scripts/load/bff-baseline.ts            # 20 s × 3 scenarios, 50 connections
 *   LOAD_DURATION=5 LOAD_CONNECTIONS=10 npx tsx scripts/load/bff-baseline.ts
 *
 * What it does, in order:
 *   1. starts ONE BFF process (`node --import tsx bff/src/server.ts`) on
 *      PORT=8093 in memory mode (no DATABASE_URL), NODE_ENV=development,
 *      LOG_LEVEL=warn — per-request info logging is OFF, so the numbers are the
 *      handler cost, not pino's; the dev OTP is still logged (it is a warn);
 *   2. records that process's PID and, whatever happens, kills THAT PID at the
 *      end (never a pattern kill);
 *   3. signs a member in through the real OTP flow: POST /v1/auth/otp/request,
 *      read the code from the server's own log line, POST /v1/auth/otp/verify;
 *   4. per scenario: 3 s warm-up, then `duration` seconds measured with
 *      autocannon, collecting EVERY response time so p95 is computed exactly
 *      (autocannon's own summary has p90/p97.5 but no p95);
 *   5. prints a markdown table (docs/LOAD-BASELINE.md is written from it) and
 *      the raw numbers as JSON.
 *
 * The scenarios are the three the hand-over asked for:
 *   GET  /health            — no auth, no backend: the framework floor
 *   GET  /v1/me/balance     — JWT verify + member read + standing (there is no
 *                             bare GET /v1/me; this is the authenticated read the
 *                             app polls)
 *   POST /v1/pos/token      — JWT verify + HMAC-signed token mint
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { menuItems } from '@almond/shared/menu';
import { readFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import autocannon, { type RequestParams, type Result } from 'autocannon';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8093;
/** A real, orderable menu line for the write scenario. */
const CHECKOUT_LINE = (() => {
  const item = menuItems.find((m) => m.inStock !== false && m.sizes.length > 0 && !(m.customizations ?? []).length);
  if (!item) throw new Error('no plain in-stock item on the menu');
  return { itemId: item.id, sizeId: item.sizes[0].id, optionIds: [], qty: 1 };
})();
const BASE = `http://127.0.0.1:${PORT}`;
const DURATION = Number(process.env.LOAD_DURATION ?? 20);
const CONNECTIONS = Number(process.env.LOAD_CONNECTIONS ?? 50);
const WARMUP = Number(process.env.LOAD_WARMUP ?? 3);
const PHONE = '0791234567';

interface Row {
  scenario: string;
  reqPerSec: number;
  total: number;
  p50: number; p95: number; p99: number; max: number;
  acP50: number; acP99: number;
  errors: number; timeouts: number; non2xx: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return NaN;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

function rssMb(pid: number): number | null {
  try {
    const m = /VmRSS:\s+(\d+) kB/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'));
    return m ? Math.round(Number(m[1]) / 1024) : null;
  } catch { return null; }
}

function machine() {
  let quota = 'unknown';
  try { quota = readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim(); } catch { /* not cgroup v2 */ }
  return {
    node: process.version,
    cpus: cpus().length,
    cpuModel: cpus()[0]?.model ?? 'unknown',
    memGb: Math.round(totalmem() / 2 ** 30),
    cgroupCpuMax: quota,
  };
}

/** Start the BFF and resolve once /health answers; collect its stdout lines. */
async function startServer(lines: string[]): Promise<ChildProcess> {
  // LOAD_INTL_CACHE=1 measures the PROPOSED ammanWeekday.ts fix (see
  // intl-cache-shim.mjs); unset, this is the code exactly as it ships.
  const shim = process.env.LOAD_INTL_CACHE === '1'
    ? ['--import', join(ROOT, 'scripts', 'load', 'intl-cache-shim.mjs')] : [];
  const child = spawn(process.execPath, [...shim, '--import', 'tsx', join(ROOT, 'bff', 'src', 'server.ts')], {
    cwd: join(ROOT, 'bff'),
    env: {
      ...process.env,
      PORT: String(PORT), DATA_SOURCE: 'memory', NODE_ENV: 'development',
      // LOAD_DATABASE_URL runs the SAME scenarios against Postgres — the store
      // production uses — instead of process memory. Apply supabase/migrations
      // to that database first.
      LOG_LEVEL: 'warn', DATABASE_URL: process.env.LOAD_DATABASE_URL ?? '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buf = '';
  const onData = (d: Buffer) => {
    buf += d.toString();
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) { lines.push(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
  };
  child.stdout!.on('data', onData);
  child.stderr!.on('data', onData);
  for (let i = 0; i < 200; i += 1) {
    if (child.exitCode !== null) throw new Error(`BFF exited early (${child.exitCode}):\n${lines.join('\n')}`);
    try { if ((await fetch(`${BASE}/health`)).ok) return child; } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error(`BFF did not answer /health on ${PORT}:\n${lines.join('\n')}`);
}

/** The real OTP flow: the code is read from the server's own dev log line. */
async function signIn(lines: string[]): Promise<string> {
  const from = lines.length;
  const req = await fetch(`${BASE}/v1/auth/otp/request`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: PHONE }),
  });
  if (!req.ok) throw new Error(`otp/request ${req.status}: ${await req.text()}`);
  let code: string | undefined;
  for (let i = 0; i < 50 && !code; i += 1) {
    for (const l of lines.slice(from)) {
      try { const j = JSON.parse(l) as { code?: string; msg?: string }; if (j.code && /OTP/.test(j.msg ?? '')) code = j.code; } catch { /* not json */ }
    }
    if (!code) await sleep(50);
  }
  if (!code) throw new Error('no DEV OTP line in the server log — is NODE_ENV=production?');
  const ver = await fetch(`${BASE}/v1/auth/otp/verify`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: PHONE, code }),
  });
  if (!ver.ok) throw new Error(`otp/verify ${ver.status}: ${await ver.text()}`);
  return ((await ver.json()) as { token: string }).token;
}

function run(opts: {
  url: string; method: 'GET' | 'POST'; headers?: Record<string, string>; body?: string; duration: number;
  /** Give every request its own Idempotency-Key, so each one is a real write. */
  freshKey?: boolean;
}) {
  return new Promise<{ result: Result; times: Float64Array }>((res, rej) => {
    let times = new Float64Array(1 << 16);
    let n = 0;
    const inst = autocannon({
      url: opts.url, method: opts.method, headers: opts.headers, body: opts.body,
      connections: CONNECTIONS, duration: opts.duration, timeout: 10,
      ...(opts.freshKey ? {
        requests: [{
          setupRequest: (r: RequestParams) => ({
            ...r, headers: { ...r.headers, 'idempotency-key': randomUUID() },
          }),
        }],
      } : {}),
    }, (err, result) => (err ? rej(err) : res({ result, times: times.slice(0, n).sort() })));
    inst.on('response', (_c: unknown, _s: number, _b: number, t: number) => {
      if (n === times.length) { const g = new Float64Array(times.length * 2); g.set(times); times = g; }
      times[n] = t; n += 1;
    });
  });
}

async function main() {
  const lines: string[] = [];
  const child = await startServer(lines);
  const pid = child.pid!;
  console.error(`BFF started, pid ${pid}, port ${PORT}, ${process.env.LOAD_DATABASE_URL ? 'POSTGRES backend' : 'memory backend'}`);
  const rows: Row[] = [];
  const rss: Record<string, number | null> = { start: rssMb(pid) };
  try {
    const token = await signIn(lines);
    const auth = { authorization: `Bearer ${token}` };
    const scenarios = [
      { scenario: 'GET /health', url: `${BASE}/health`, method: 'GET' as const },
      { scenario: 'GET /v1/me/balance (JWT)', url: `${BASE}/v1/me/balance`, method: 'GET' as const, headers: auth },
      {
        scenario: 'POST /v1/pos/token (JWT)', url: `${BASE}/v1/pos/token`, method: 'POST' as const,
        headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'pay' }),
      },
      {
        // A WRITE: re-price from the menu, one transaction that locks the
        // member row, inserts the order and records the spend. Every request
        // carries its own Idempotency-Key, so none is a cheap replay. All 50
        // connections hit the SAME member — the worst case for the row lock;
        // real traffic spreads over thousands of members and contends less.
        scenario: 'POST /v1/checkout (JWT, write)', url: `${BASE}/v1/checkout`, method: 'POST' as const,
        headers: { ...auth, 'content-type': 'application/json' }, freshKey: true,
        body: JSON.stringify({ branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: [CHECKOUT_LINE] }),
      },
    ];
    for (const s of scenarios) {
      // Sanity first: the scenario must actually succeed once, or its req/s is
      // the speed of a 401.
      const probe = await fetch(s.url, {
        method: s.method, body: s.body,
        headers: { ...s.headers, ...('freshKey' in s && s.freshKey ? { 'idempotency-key': randomUUID() } : {}) },
      });
      if (!probe.ok) throw new Error(`${s.scenario}: probe returned ${probe.status} ${await probe.text()}`);
      console.error(`→ ${s.scenario}: warm-up ${WARMUP}s, measure ${DURATION}s × ${CONNECTIONS} connections`);
      await run({ ...s, duration: WARMUP });
      const { result: r, times } = await run({ ...s, duration: DURATION });
      rows.push({
        scenario: s.scenario,
        reqPerSec: Math.round(r.requests.average),
        total: r.requests.total,
        p50: +percentile(times, 50).toFixed(2),
        p95: +percentile(times, 95).toFixed(2),
        p99: +percentile(times, 99).toFixed(2),
        max: +times[times.length - 1].toFixed(2),
        acP50: r.latency.p50, acP99: r.latency.p99,
        errors: r.errors, timeouts: r.timeouts, non2xx: r.non2xx,
      });
      rss[s.scenario] = rssMb(pid);
    }
  } finally {
    child.kill('SIGTERM');
    for (let i = 0; i < 50 && child.exitCode === null && child.signalCode === null; i += 1) await sleep(100);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    console.error(`BFF pid ${pid} stopped (${child.signalCode ?? child.exitCode})`);
  }

  const env = machine();
  console.log(`\nMachine: ${env.cpus} vCPU (${env.cpuModel}), ${env.memGb} GB, cgroup cpu.max=${env.cgroupCpuMax}, Node ${env.node}`);
  console.log(`Load: ${CONNECTIONS} connections, ${DURATION}s measured after ${WARMUP}s warm-up, autocannon in the SAME container`
    + `${process.env.LOAD_INTL_CACHE === '1' ? ' — WITH the Intl formatter cache shim (proposed fix, not shipped code)' : ''}\n`);
  console.log('| Scenario | req/s | requests | p50 ms | p95 ms | p99 ms | max ms | errors | timeouts | non-2xx |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of rows) {
    console.log(`| ${r.scenario} | ${r.reqPerSec} | ${r.total} | ${r.p50} | ${r.p95} | ${r.p99} | ${r.max} | ${r.errors} | ${r.timeouts} | ${r.non2xx} |`);
  }
  console.log(`\nServer RSS (MB): ${JSON.stringify(rss)}`);
  console.log(`\n${JSON.stringify({ machine: env, connections: CONNECTIONS, duration: DURATION, rows }, null, 2)}`);
  if (rows.some((r) => r.errors || r.non2xx || r.timeouts)) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
