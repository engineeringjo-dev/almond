# Almond Coffee House ☕

<div dir="rtl">

**ملخّص للمالك:** هذا المستودع يحوي برنامج الولاء وموقع الطلبات وتطبيق الأعضاء لألموند، بجانب أودو ١٩
الذي يبقى مصدر الحقيقة للمنيو والمبيعات. الكود مختبَر وبوّابته خضراء على `main`، لكنّ **الإطلاق محجوبٌ
بأمرين خارج الكود:** لا مزوّد رسائل SMS (فلا أحد يسجّل الدخول) ولا بوّابة دفع. ملفّ التسليم الكامل
بالعربيّة: **[`docs/HANDOVER.md`](docs/HANDOVER.md)** — ابدأ منه.

</div>

## What this is

A loyalty programme, an ordering website with a back office, and a member app
for a Jordanian coffee-house chain. The Odoo 19 ERP stays the source of truth
for the menu, sales and stock; this repository holds the loyalty rules, the API
server that owns members, points and money, and the two front ends. The
loyalty rules are written once, in `packages/shared`, and imported everywhere,
so the phone, the website and the server cannot give a member three different
answers.

**Handing this over, or picking it up?** Read
[`docs/HANDOVER.md`](docs/HANDOVER.md) (Arabic) first — it states what is live,
what is mocked and what has not been built. Integrations are in
[`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).

## Status at a glance

Measured 2026-09-23 on branch `claude/almond-loyalty-program-n6h29q` at `e9f6c15` (at the time of writing `main` was still at `cb20825` — make sure the branch is merged before relying on this). Details and evidence:
[`docs/HANDOVER.md` §3](docs/HANDOVER.md#s3).

| Area | State |
|---|---|
| Loyalty rules (points, tiers, 12-month lots, FIFO, expiry) | **Live** — `packages/shared`, deeply tested |
| Menu, prices, photos | **Live** — pulled from Odoo by hand (373 items, 44 categories, 306 photos) |
| Tax | **Live** — 8 % included in Odoo's `list_price` (owner, 2026-09-23); guarded by `bff/test/tax.test.ts` |
| Members, points, wallet, idempotency | **Live on Postgres** when `DATABASE_URL` is set (production refuses to boot without it) |
| Corporate discounts, POS QR token, redemption settle, till earn/reverse (`/v1/pos/earn`) | **Live** in `bff`, tested |
| POS till connector (Odoo addon) | **Skeleton** — `integrations/almond_loyalty_pos/`, targets the `bff` contract, not installed on any Odoo |
| Payment-provider seam, SMS-provider seam | **Built and tested** in `bff` — Ishbek writes one adapter each from a `TEMPLATE.ts`; see [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) |
| Front ends ↔ `bff` member API | **Not connected** — sign-in on the app and the website is a device-side mock, and the app's "live" client targets a `/loyalty/*` server that does not exist (header of `almond-app/services/loyalty.service.live.ts`). Wiring them is a project, not a switch |
| SMS provider (sign-in codes) | **Missing** — nobody can sign in; production answers 503 `sms_unavailable`. Showstopper |
| Payment gateway | **Missing** — card orders are refused (402) without a captured payment; web payment is still mocked. Showstopper |
| Delivery (Careem/Talabat via Ishbek) | **Server routes exist**; request bodies are samples; Odoo status mapping is TODO |
| Odoo as member store (`DATA_SOURCE=odoo` in `bff`) | **Stub that throws on purpose** |
| Hosting | Website on Vercel · app (web build) on GitHub Pages · **`bff` not hosted** · no Postgres provisioned · `almond.jo` answers NXDOMAIN from the `.jo` registry |

## Repository map

```
almond/
├── packages/shared/   THE RULES: points, tiers, expiry, discounts, menu, tax, money
│                      formatting, types. Pure, no I/O. Everything imports it.
├── bff/               Fastify API (Node 22). Members, points, wallet, redemptions,
│                      corporate register, POS tokens. Holds every secret.
├── almond-web/        Next.js 15 website — menu, ordering, back office at /admin.
├── almond-app/        Expo SDK 56 member app. Ships as a WEB build today (GitHub
│                      Pages, base path /almond); no native build pipeline yet.
├── supabase/migrations/  Loyalty schema (6 files, 20260909→20260927 — see HANDOVER §4.2;
│                      the three 2026-08 files belong to a different system's database).
├── integrations/      Odoo 19 addons (POS loyalty connector, MEPS card terminals, …).
├── scripts/           odoo-menu-pull.ts (menu:pull), load/ (load:baseline),
│                      pos/ (pos:simulate — a till driving one sale through a running bff).
├── e2e/               Playwright journeys, WCAG AA and RTL checks.
├── tools/             Read-only Odoo audit scripts (Python), branch sales map page.
├── docs/              Handover, integrations, decisions, research — see docs/README.md.
└── .github/workflows/ ci.yml (the gate), deploy-web.yml (app → Pages),
                       deploy-website-vercel.yml (manual).
```

## Quick start

```bash
nvm use            # .nvmrc — Node 22.22.2. CI and the deploy workflows read the same file.
npm ci             # the lockfile exactly; never `npm install` in CI

npm run lint             # ESLint, whole repo, zero warnings allowed
npm run typecheck        # all four workspaces + e2e/ + scripts/load/ + scripts/pos/
npm test                 # bff, then app, then website
npm run web:build        # the website
npm run test:e2e         # Playwright (needs `npx playwright install chromium` once)
npm run coverage         # per-suite coverage into each workspace's coverage/
```

What those commands printed when this README was written (on `e9f6c15`, after
the integration seams landed):

```
npm run lint       exit 0, no output (0 errors, 0 warnings)
npm run typecheck  exit 0
npm test           bff  — Test Files 27 passed (27) · Tests 615 passed | 3 skipped | 2 todo (620)
                   app  — Test Files 5 passed (5)   · Tests 109 passed (109)
                   web  — Test Files 13 passed (13) · Tests 202 passed (202)
```

The 3 skipped bff tests need a real Postgres. Money under genuine concurrency
cannot be proved on PGlite (one connection, no row locks), so those cases are
skipped, not faked:

```bash
ALMOND_TEST_PG_URL=postgresql://… npm test --workspace @almond/bff     # > 530 tests
ALMOND_TEST_PG_URL=postgresql://… npm run test:pg --workspace @almond/bff  # just the pg suites
```

Run the whole thing in two terminals:

```bash
# 1 — the API. No configuration needed in development: it keeps everything in
#     memory (forgotten on restart), and with SMS_PROVIDER unset in development
#     it uses the `log` sender: sign-in codes appear in its log as "DEV OTP issued".
npm run dev --workspace @almond/bff          # :8080

# 2 — the website.
npm run dev --workspace almond-web           # :3000
```

The member app: `npm run web --workspace almond-app`.

The menu is pulled from Odoo by hand, read-only, and produces a **commit**, not
a deployment (so an Odoo mistake is reviewed before customers see it):

```bash
ODOO_URL=… ODOO_DB=… ODOO_LOGIN=… ODOO_API_KEY=… npm run menu:pull
```

## Configuration

Copy [`bff/.env.example`](bff/.env.example) → `bff/.env` and
[`almond-web/.env.example`](almond-web/.env.example) → `almond-web/.env.local`.
Every variable carries a comment saying what breaks without it.

Three switches decide what is real. They answer different questions — where
the menu comes from versus where members are kept — and conflating them is how
`DATA_SOURCE=odoo` once came to mean "throw on every call":

| Variable | Where | Unset means |
|---|---|---|
| `NEXT_PUBLIC_DATA_SOURCE` | `almond-web` | `mock` — the menu is the committed Odoo export, payment is simulated, delivery answers locally. **`odoo` is not wired end to end**: the menu loader and the payment step both throw on purpose, so do not set it on a public deployment yet. Any other value fails at boot. |
| `DATA_SOURCE` | `bff` | `memory`. `odoo` selects a member adapter that throws on every call (`bff/src/backend/odoo.ts`). Ignored when `DATABASE_URL` is set. |
| `DATABASE_URL` | `bff` | in-memory — members, points and companies are forgotten on restart. Apply the loyalty migrations **in order** first ([HANDOVER §4.2](docs/HANDOVER.md#s4)); `20260923_loyalty_rls.sql` is mandatory. |

**With `NODE_ENV=production` the API refuses to boot** (`insecureBootReasons`
in `bff/src/config.ts`) when any of these holds:

- `JWT_SECRET` or `POS_TOKEN_SECRET` is unset, still the development default, or shorter than 32 characters;
- `POS_SCAN_KEY` or `ADMIN_KEY` is unset or shorter than 32 characters;
- `CORS_ORIGINS` contains `*` — and unset means `*`;
- `DATABASE_URL` is unset;
- `TRUST_PROXY` is unset — say `true` (or a hop count) behind a load balancer/PaaS, `false` if exposed directly;
- `PAYMENT_PROVIDER=mock` or `SMS_PROVIDER=log`.

**In every environment** it refuses to boot when `PAYMENT_PROVIDER` or
`SMS_PROVIDER` names a provider that is not registered, or when
`OTP_SMS_TEMPLATE` lacks `{code}` (`bff/src/providers.ts`). Leaving the two
providers unset is allowed: card payment and sign-in then answer 503, honestly.

Note: `bff/.env.example` ships `CORS_ORIGINS=*` (development only; refused in
production). Its `DATABASE_URL` comment lists the six loyalty migrations in
order — **not** every file in `supabase/migrations`: the three August files
belong to another system's database (HANDOVER §4.2).

## The gate (CI)

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to
every branch and on every pull request, in this order: install (`npm ci`) →
lint → typecheck → bff tests → app tests → website tests → the Odoo POS
addon's Python client tests (40, against a mock of the till API) → website
build → Playwright E2E + accessibility + RTL (report uploaded as an artifact).
Full gate before the final merge: lint ✓ · typecheck ✓ · bff 615 · app 109 ·
web 202 · addon 40 · build ✓ · E2E 92 passed, 4 skipped. CI has no Postgres service, so the real-Postgres suites run only
where `ALMOND_TEST_PG_URL` is set.

## Deploying

Read [`docs/DEPLOY.md`](docs/DEPLOY.md) before touching `vercel.json`.

Merging to `main` triggers:

- **Website → Vercel**, team `almond-k`, project `almond` (Git integration;
  Root Directory = repo root; the root `vercel.json` with
  `outputDirectory: almond-web/.next` is required). Production URL:
  `https://almond-gules.vercel.app`. Every branch push also gets a preview.
- **Member app (web build) → GitHub Pages** via `deploy-web.yml`:
  `https://engineeringjo-dev.github.io/almond/`.

`deploy-website-vercel.yml` is manual (`workflow_dispatch`) and needs a
`VERCEL_TOKEN` repository secret. The API (`bff`) is **not deployed anywhere**;
hosting it is part of the handover work (HANDOVER §4.4).

## Documentation

[`docs/README.md`](docs/README.md) indexes every document and marks each one
**Current**, **Reference** or **Historical**. Start with:

- [`docs/HANDOVER.md`](docs/HANDOVER.md) — the handover pack (Arabic): what is true, what blocks launch, day-one checklist.
- [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) — payments, POS, SMS, delivery, Odoo menu.
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — the Vercel decision and why.
- [`docs/LOAD-BASELINE.md`](docs/LOAD-BASELINE.md) — measured capacity (Postgres 16, 1M orders: checkout 386 req/s, p99 199 ms).

Documents marked Historical carry a banner naming what in them is outdated. Do
not follow them over the Current ones.

## Conventions

- **One rule, one implementation.** A number computed in two places is
  computed in `packages/shared` and imported.
- **Money is integers where it is stored** (fils) and formatted in one place.
- **Every money path runs on both stores** — `bff/test/backend-contract.test.ts`
  holds memory and Postgres to one specification.
- **Never edit a published migration**; add a new one.
- **Guards are tested by breaking them.** Several suites exist to fail when a
  specific safety property is removed; the commit messages name which.
- **Arabic is the primary language.** Every user-facing string is in both
  `ar.json` and `en.json`; RTL is the default; the URL alone decides the language.
- **No secrets in any client bundle** — nothing secret behind `NEXT_PUBLIC_` or
  `EXPO_PUBLIC_`.
- **Commit messages carry the reasoning.** They are long on purpose.

## Ownership and contacts

<!-- OWNER: fill in before handing over -->

| Role | Name | Contact |
|---|---|---|
| Owner (business decisions) | _to fill_ | _to fill_ |
| Odoo / BI (Moaz) | _to fill_ | _to fill_ |
| Receiving team (Ishbek) — technical lead | _to fill_ | _to fill_ |
| Accounts to transfer (GitHub, Vercel `almond-k`, Odoo, domain) | see [HANDOVER §1.3](docs/HANDOVER.md#s1) | — |
