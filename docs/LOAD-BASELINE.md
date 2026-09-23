# BFF load baseline

**A baseline, not a capacity claim.** One BFF process, memory backend, measured
from inside the same 4-vCPU container that generated the load. It exists so the
next change can be compared against something measured, and so that a regression
of 5× (like the one found below) is visible as a number instead of an anecdote.

Measured 2026-09-23 with `scripts/load/bff-baseline.ts`.

## How to reproduce

```bash
npx tsx scripts/load/bff-baseline.ts                    # 3 × (3 s warm-up + 20 s measured), 50 connections
LOAD_DURATION=5 LOAD_CONNECTIONS=10 npx tsx scripts/load/bff-baseline.ts   # quick smoke
LOAD_INTL_CACHE=1 npx tsx scripts/load/bff-baseline.ts  # the same, with the PROPOSED Intl fix simulated (see below)
npx tsc -p scripts/load/tsconfig.json                   # typecheck of the script
```

The script:

1. starts **one** BFF (`node --import tsx bff/src/server.ts`) on **PORT=8093**,
   `DATA_SOURCE=memory`, no `DATABASE_URL`, `NODE_ENV=development`,
   **`LOG_LEVEL=warn`** — per-request info logging is off, so these are handler
   costs, not pino's;
2. records that process's **PID** and kills **that PID** at the end, in a
   `finally` (never a pattern kill);
3. obtains **one** member token through the **real OTP flow**
   (`POST /v1/auth/otp/request`, reads the code from the server's own dev log
   line, `POST /v1/auth/otp/verify`) — **once per run**. The OTP routes are now
   rate-limited per IP (20 requests / 10 min, 20 failed verifies / 15 min) and
   redemption minting per member (10/min); **none of the rate-limited routes is
   load-tested**, so no limit was raised and none of the numbers below is a 429;
4. for each scenario: a probe request that must return 2xx (so a scenario can
   never silently measure the speed of a 401), 3 s warm-up, 20 s measured with
   autocannon at 50 connections, collecting **every** response time so p95 is
   exact (autocannon's summary has p90/p97.5 but no p95).

Scenarios (there is no bare `GET /v1/me`; `/v1/me/balance` is the authenticated
read the app polls, and there is no menu GET on the BFF — `/health` is the
unauthenticated floor):

| Scenario | What it exercises |
|---|---|
| `GET /health` | Fastify + CORS hook, no auth, no backend |
| `GET /v1/me/balance` | JWT verify → `getMember` → `getStanding` → balance/tier/next-expiry |
| `POST /v1/pos/token` | JWT verify → HMAC-signed 60-second POS token |

## Machine limits — read before quoting a number

- 4 vCPU (Intel Xeon @ 2.10 GHz), 16 GB RAM, Node v22.22.2; no cgroup CPU quota
  visible. A shared cloud container: neighbours are not controlled.
- **The load generator runs in the same container** and competes with the
  server for the same 4 vCPUs. The server is **one Node process = one core** for
  JS. Real capacity is per-instance × instances, measured against Postgres.
- **Memory backend.** No database round trips. Against Postgres every money
  write is a `BEGIN … SELECT … FOR UPDATE … COMMIT` on a pooled connection; the
  numbers here are an upper bound for the handler, not for the service.
- Run-to-run variance on this box is roughly ±20 % (e.g. `/health` 21.9k–28.4k
  req/s across runs). Differences smaller than that are noise.

## Results — current code (after the Intl fix, re-measured 2026-09-23)

The finding below was fixed in commit 5c66a71 (the Amman-clock formatters are
built once, in `packages/shared/src/lib/ammanWeekday.ts`), and this table is a
fresh `npm run load:baseline` on the code as handed over — same machine, same
50 connections, 20 s each. Errors / timeouts / non-2xx: **0** in every row.

| Scenario | req/s | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|---:|
| GET /health | 31,313 | 1.57 | 2.77 | 3.76 |
| GET /v1/me/balance (JWT) | **11,954** | 3.89 | 6.15 | 8.21 |
| POST /v1/pos/token (JWT) | 11,921 | 3.85 | 6.30 | 8.03 |

**Server RSS:** 127 MB at start → **146 MB** at the end (was ~2,870 MB).
`/v1/me/balance` went from ~1,500 to ~11,950 req/s (×~8) and p99 from ~80 ms to
~8 ms. Same caveats as below: one process, memory backend, the generator on
the same 4 vCPU — a baseline, not a capacity claim.

## Results — before the fix (the code as it was)

Two consecutive runs, 50 connections, 20 s each. Errors / timeouts / non-2xx
were **0** in every row.

| Scenario | Run | req/s | requests | p50 ms | p95 ms | p99 ms | max ms |
|---|---|---:|---:|---:|---:|---:|---:|
| GET /health | 1 | 28,356 | 567,111 | 1.61 | 3.38 | 5.11 | 31.5 |
| GET /health | 2 | 21,910 | 438,181 | 2.11 | 4.32 | 6.59 | 23.0 |
| GET /v1/me/balance (JWT) | 1 | **1,506** | 30,117 | 30.13 | 50.40 | 84.13 | 1,004.7 |
| GET /v1/me/balance (JWT) | 2 | **1,518** | 30,361 | 28.28 | 48.84 | 78.48 | 1,639.9 |
| POST /v1/pos/token (JWT) | 1 | 10,849 | 216,960 | 4.08 | 7.67 | 11.17 | 50.5 |
| POST /v1/pos/token (JWT) | 2 | 10,421 | 208,407 | 4.22 | 8.22 | 11.67 | 55.7 |

**Server RSS:** ~125 MB at start → ~145 MB after `/health` → **~2,870 MB after
~30k `/v1/me/balance` requests** (V8 heap stays small; the growth is native).

## 🔴 Finding: `/v1/me/balance` is ~7× slower than it should be, and balloons RSS

`/v1/me/balance` does less work than the POS token mint yet runs at a seventh of
its rate, with a 1–1.6 s max. Isolated with a micro-benchmark:
`getStanding()` costs **~395 µs** per call; `getMember`, `liveBalance` and
`nextExpiry` cost ~1 µs each.

The cause is `packages/shared/src/lib/ammanWeekday.ts:10` and `:18` —
`ammanWeekday()` and `ammanDayKey()` construct a **new `Intl.DateTimeFormat`
with `timeZone: 'Asia/Amman'` on every call** (~69 µs each, measured, versus
1.2 µs for a cached instance), and `standing()` calls `ammanDayKey` several
times. Every write path in both backends calls it too (`settleExpiry`,
`todayKey()`). Constructing ICU formatters in a loop is also what drives RSS up:
50,000 constructions in a bare Node script take RSS to ~1.34 GB with a 4 MB
heap. On a container with a 1–2 GB memory limit this is an OOM kill waiting for
a busy afternoon.

**Proposed patch** (packages/shared is not owned by this change):

```ts
// packages/shared/src/lib/ammanWeekday.ts
const WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', { timeZone: AMMAN, weekday: 'short' });
const DAY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: AMMAN, year: 'numeric', month: '2-digit', day: '2-digit',
});
export function ammanWeekday(at: Date = new Date()): number { return WD.indexOf(WEEKDAY_FMT.format(at)); }
export function ammanDayKey(at: Date = new Date()): string { return DAY_FMT.format(at); }
```

Output is identical (same locale, same options; `Intl.DateTimeFormat#format` is
pure), so no behaviour changes.

**The patch, measured** (`LOAD_INTL_CACHE=1` preloads
`scripts/load/intl-cache-shim.mjs`, which makes identical `Intl.DateTimeFormat`
constructions return one cached instance — a simulation of the patch, never
loaded by a real deployment):

| Scenario | req/s | p50 ms | p95 ms | p99 ms | max ms | errors / non-2xx |
|---|---:|---:|---:|---:|---:|---:|
| GET /health | 32,304 | 1.54 | 2.69 | 3.62 | 14.3 | 0 / 0 |
| GET /v1/me/balance (JWT) | **11,448** | **4.07** | **6.52** | **8.82** | 34.8 | 0 / 0 |
| POST /v1/pos/token (JWT) | 9,875 | 4.69 | 9.13 | 13.23 | 59.3 | 0 / 0 |

`/v1/me/balance`: **~1.5k → ~11.4k req/s (7.5×), p99 ~80 ms → ~9 ms**, and
server RSS stays at **~150 MB** instead of ~2.9 GB.

## What this baseline does not cover

- Postgres. The money paths' correctness under a real connection pool is
  covered by `bff/test/resilience-concurrency.test.ts` (with
  `ALMOND_TEST_PG_URL`), not by load. A Postgres load run should measure lock
  wait on hot members (`SELECT … FOR UPDATE` serialises one member's writes,
  by design) and pool saturation.
- Money-moving POSTs (`/v1/checkout`, `/v1/loyalty/redeem`): rate limits and
  idempotency keys make them unrepresentative under a single-member autocannon
  run; they need a many-member harness.
- Horizontal scale. The idempotency store, the POS-token replay set, the OTP
  state and the rate limiters are all per-process maps; two instances do not
  share them (see the resilience report).
