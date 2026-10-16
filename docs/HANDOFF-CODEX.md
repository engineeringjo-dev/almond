# Handoff to Codex — Almond loyalty app, website and server

**Date:** 2026-10-16. **From:** the Claude Code sessions that built this
repository with the owner. **For:** OpenAI Codex, or any agent picking the work
up. The rules in [`CLAUDE.md`](../CLAUDE.md) bind you; [`AGENTS.md`](../AGENTS.md)
repeats the ones that matter most.

**No secret values appear in this file or anywhere in the repository.** Every
key below is listed by name, with where it lives and who holds it. The owner
hands the values to you through Codex's environment settings, never through
a file or a commit.

---

## 1. What this is

Almond Coffee House: 8 cafés in Amman, Odoo 19 Enterprise behind them. This
repository holds the customer side:

| Path | What | Deployed to |
|---|---|---|
| `packages/shared/` | Every rule: points, tiers, expiry, redemption, menu, pricing, tax, money formatting. Pure, no I/O | Imported by the three below |
| `bff/` | Fastify server (Node 22, `tsx`): members, points, wallet, redemption, POS tokens. Holds every secret and all money | **Not hosted yet** |
| `almond-web/` | Next.js 15 website and the `/admin` back office | Vercel, project `almond` |
| `almond-app/` | Expo SDK 56 members' app. Only the web build ships today | GitHub Pages, under `/almond` |
| `supabase/migrations/` | The loyalty database schema | **Applied to no database yet** |
| `integrations/` | Odoo 19 modules (`almond_loyalty_pos` and others) | Installed from a separate Odoo repository |
| `e2e/` | Playwright: journeys, WCAG AA, RTL | CI |

Read next: [`README.md`](../README.md), then [`docs/HANDOVER.md`](HANDOVER.md)
(the launch blockers, every migration, what the server refuses to boot
without, and the conventions).

---

## 2. State on 2026-10-16

- `main` carries everything below. CI is green on it.
- Shipped on 15–16 October, each with tests and a guard broken on purpose:
  - The Rewards tab fits one screen: the card, one row of amounts, the
    cashback headline, and four doors (points history, coupons, tier, how it
    works). Redeeming asks in a sheet. `/tiers`, `/loyalty` (history only)
    and `/vouchers` are pages of their own. Measurements before and after:
    [`competitors/AL-AMEED-PAGE-DIVISION-2026-10.ar.md`](competitors/AL-AMEED-PAGE-DIVISION-2026-10.ar.md), section «ز».
  - The Arabic copy pass ([`ARABIC-COPY-REVIEW-2026-10.ar.md`](ARABIC-COPY-REVIEW-2026-10.ar.md)),
    «كاش باك لغاية 9%», double-points days, the welcome gift, the points
    history, account deletion, the post-visit rating, the barcode sheet on
    launch. The full list: [`competitors/AL-AMEED-2026-10.ar.md`](competitors/AL-AMEED-2026-10.ar.md), «ما نُفِّذ».
- **Design work, 2026-10-16.** The owner's complaint: «كئيب وغير ملفت، بدون
  شعور AI» (gloomy, not eye-catching; it should not feel machine-made).
  - Done: the baseline critique with `.claude/skills/impeccable`
    ([`design/CRITIQUE-2026-10-16.md`](design/CRITIQUE-2026-10-16.md):
    Nielsen 27/40, and measured evidence with screenshots), and the four-expert
    playbook ([`APP-DESIGN-PLAYBOOK-2026-10.ar.md`](APP-DESIGN-PLAYBOOK-2026-10.ar.md)):
    the fingerprint, an evaluation prompt with a 43-question rubric, the order
    of use for the skills, and three waves of work.
  - **The owner approved direction A, «Daylight Counter»** (#100): ink and
    paper with one toasted-almond reward colour (`reward`: `#975725` light,
    `#E0AD70` dark), recorded in `almond-app/PRODUCT.md`,
    `almond-app/DESIGN.md` and `almond-app/docs/daylight-counter-brief.md`.
    Where the playbook and `DESIGN.md` differ, `DESIGN.md` wins.
  - App design skills in `.claude/skills/`: the owner's skills-CLI install
    (five Expo skills and `marketing-psychology`, pinned in
    `skills-lock.json`) and three vendored in advisory mode. The index and its
    "Never run" list: `.claude/skills/WEB-DESIGN-SKILLS.md`.
  - **Still open with the owner:** the logo's line drawings as the app's
    illustrations, real branch photos, and whether to add a display face
    (recommended: no). The playbook's section 8 lists them.

---

## 3. Access the owner grants

| What | Where | Permission | Why |
|---|---|---|---|
| Repository `engineeringjo-dev/almond` | GitHub, through Codex's GitHub connection | Read and write (branches, pull requests). Not admin | The code |
| GitHub Actions secrets of the repository | GitHub → Settings → Secrets and variables → Actions | Codex does not need them; CI reads them | Menu sync, deletion sweep, manual website deploy |
| Vercel team `almond-k`, project `almond` (`prj_TJeFM2UZApr3gyOAPg7TclxPEGmT`) | Vercel | Optional, read-only | Checking a deploy |
| Odoo 19 on odoo.sh, `https://ag-almond-coffee-house.odoo.com` | The owner's API user | Read-only use; any write needs the owner's approval first | `npm run menu:pull`, `npm run menu:insights`, the read-only audits in `tools/` |
| Odoo modules repository `almondcoffeehouse-stack/Almond-Coffee-House` | GitHub | Read. Writes only on its `dev-almond` branch, and only with the owner's approval | Installing `integrations/almond_loyalty_pos` |

**Out of scope, do not touch:** `engineeringjo-dev/production-almond` (the
branch-management system behind `almondjo.com`) and the Vercel project
`almondjo`. They are another system, and the owner has excluded them.

---

## 4. Secrets and keys — names, homes and holders only

| Name | Used by | Lives in | Codex needs it? |
|---|---|---|---|
| `ODOO_URL`, `ODOO_DB`, `ODOO_LOGIN`, `ODOO_API_KEY` | `npm run menu:pull`, `npm run menu:insights`, `.github/workflows/menu-sync.yml` | GitHub Actions secrets. The owner holds the values | Only to read Odoo. Then the owner sets the four as Codex environment secrets |
| `BFF_URL`, `BFF_ADMIN_KEY` | `.github/workflows/account-deletion-sweep.yml` | GitHub Actions secrets | No, not until the server is hosted |
| `VERCEL_TOKEN` | `.github/workflows/deploy-website-vercel.yml` (manual) | GitHub Actions secret | No |
| `ADMIN_PASSWORD`, `ADMIN_KEY`, `ADMIN_SESSION_SECRET`, `BFF_BASE_URL`, `ISHBEK_KEY`, `ISHBEK_WEBHOOK_SECRET` | The website's server routes (`almond-web/.env.example`) | Vercel project `almond` | No |
| `JWT_SECRET`, `POS_TOKEN_SECRET`, `POS_SCAN_KEY`, `ADMIN_KEY`, `DATABASE_URL`, `SMS_*`, `PAYMENT_*`, `ODOO_BASE_URL`, `ODOO_API_KEY`, `LOYALTY_TOKEN`, `CORS_ORIGINS`, `TRUST_PROXY` | The server (`bff/.env.example`, every variable commented) | **Nowhere yet**: the server is not hosted | No. Tests run the server in memory with throwaway values |

The values the e2e suite boots its servers with are fixed and **not secret**,
in `e2e/env.ts`.

Rules: a value never enters the repository, a commit message, a log or a
client bundle. A new secret gets a name in the matching `.env.example` with a
comment, never a value.

---

## 5. Links (all answered 200 on 2026-10-16)

| What | Link |
|---|---|
| Repository | https://github.com/engineeringjo-dev/almond |
| CI | https://github.com/engineeringjo-dev/almond/actions/workflows/ci.yml |
| Website, production (Vercel) | https://almond-gules.vercel.app |
| Members' app, web build (GitHub Pages) | https://engineeringjo-dev.github.io/almond/ |
| Odoo 19 | https://ag-almond-coffee-house.odoo.com |

The domain `almond.jo` has no DNS; `api.almond.jo` does not exist yet
([`HANDOVER.md`](HANDOVER.md) §1.2).

---

## 6. Running it

- Node `22.22.2` (`.nvmrc`), then `npm ci` at the root.
- **Members' app (web):** `npm run export:web --workspace almond-app`, then
  `node scripts/serve-app-web.mjs almond-app/dist <port>` and open
  `http://localhost:<port>/almond`. It runs on mock services. To sign a member
  in, seed `localStorage` the way `e2e/app/helpers.ts` does.
- **Website:** `npm run dev --workspace almond-web`.
- **Server:** `npm run start --workspace @almond/bff` (memory mode without
  `DATABASE_URL`).
- **The gate:** the seven commands in [`AGENTS.md`](../AGENTS.md). CI runs the
  same ones.

---

## 7. Lessons already paid for

- **Production Odoo writes wait for the owner.** Reading is fine; writing is
  not, until the owner says so for that change.
- **Raw member data from «وافي» never enters the repository** (Jordan's
  personal data protection law, 24/2023).
- **Competitor screenshots stay out of the repository**: the Al Ameed ones show a
  customer's name and number.
- **The bidi traps are guarded:** a phone number inside an Arabic sentence
  goes through `ltrIsolate()` (`packages/shared/src/lib/phone.ts`), a count
  before a counted noun needs plural forms `_0…_5` with `count`, and «9%»
  reads «%9» in Arabic on purpose (UAX #9).
- **Promise nothing the server does not pay.** The copy guards C4, C9, C18,
  C21 and C24 in `bff/test/copy.test.ts` and `almond-app/test/copy.test.ts`
  hold this.
- **Commit messages carry the why**, and a `Precedent:` line naming the
  product or standard followed.

---

## 8. Open work, in order

1. **What is left of wave 1 in the design playbook** after Daylight Counter:
   the guard that keeps `reward` inside its allowed files, the faux-bold fix,
   the expiry banner, the pay moment and the post-visit moment
   ([`APP-DESIGN-PLAYBOOK-2026-10.ar.md`](APP-DESIGN-PLAYBOOK-2026-10.ar.md)
   section 7). Re-evaluate with its prompt 5.2 against
   [`design/CRITIQUE-2026-10-16.md`](design/CRITIQUE-2026-10-16.md).
2. **The owner's three page-division questions**, answered so far by defaults:
   Home unchanged, line icons on the tiles, «قسائمي» only under Rewards.
3. **Launch blockers**, outside the code ([`HANDOVER.md`](HANDOVER.md) §2): an SMS
   provider and a sender ID registered with the TRC, a payment gateway,
   Postgres with the migrations applied in order, hosting for the server, DNS,
   installing the POS addon on `dev-almond` first, Redis before a second
   server instance, error monitoring, and legal sign-off on member data.
