# Documentation index — فهرس الوثائق

<div dir="rtl">

**كيف تقرأ هذا الفهرس:** كلّ وثيقةٍ في `docs/` مصنّفة في واحدةٍ من ثلاث:

- **حاليّة (Current)** — تصف ما في الكود اليوم. اعمل بها.
- **مرجعيّة (Reference)** — خلفيّة ما زالت صالحة: قياسات، أبحاث، تصميمات أودو، أو وثائق **نظامٍ آخر** يشاركنا المستودع.
- **تاريخيّة (Historical)** — تجاوزها الكود أو قرارٌ لاحق. **لا تعمل بها**؛ اقرأها لفهم «لماذا» فقط.

أيّ وثيقةٍ فيها ادّعاءات لم تعد صحيحة تحمل في أعلاها شريطاً **⚠️ تاريخيّ / Historical** يسمّي الادّعاءات بعينها.
الحقيقة الحاليّة دائماً في [`HANDOVER.md`](HANDOVER.md). الترتيب أدناه: الحاليّة، ثمّ المرجعيّة، ثمّ التاريخيّة.

</div>

**Counts.** Top-level `docs/*.md`: 33 (31 existing + `INTEGRATIONS.md` + this index) — **6 Current**, **13 Reference**, **14 Historical**. 19 of them carry a "⚠️ Historical" banner (20 with `ishbek/README.md`) (some Current and Reference documents carry one for specific outdated passages). Plus two non-Markdown files and five sub-folders, classified below.

## Current

| Document | What it is | Banner |
|---|---|---|
| [`HANDOVER.md`](HANDOVER.md) | **Start here.** Handover pack (Arabic): what is live/mocked/missing, blockers, configuration, gate, decisions, day-one checklist. | — |
| [`INTEGRATIONS.md`](INTEGRATIONS.md) | Payments, POS & redeem, SMS, delivery via Ishbek, Odoo menu pull — files, status, what is left, env vars, tests. | — |
| [`README.md`](README.md) | This index. | — |
| [`DEPLOY.md`](DEPLOY.md) | The Vercel decision (project `almond`, root directory, why `outputDirectory` is required). Read before touching `vercel.json`. | yes — its opening "all five projects fail" is historical |
| [`LOAD-BASELINE.md`](LOAD-BASELINE.md) | Measured capacity: one process in memory, and Postgres 16 with 1M orders (checkout 386 req/s, p99 199 ms). | yes — its closing "does not cover" list is partly outdated |
| [`DELIVERY-INTEGRATION.md`](DELIVERY-INTEGRATION.md) | Delivery via Ishbek → Careem/Talabat: architecture, the `+03:00` timestamp rule, server-only key. | yes — auth-variable and "via Odoo" passages |

## Reference

| Document | What it is | Banner |
|---|---|---|
| [`LOYALTY-MEASURED-TRUTH.ar.md`](LOYALTY-MEASURED-TRUTH.ar.md) | Measurements of the live «Wafii» programme (171,291 transactions, 980 days): flat 4/6/8/10 per tier, 1 point = 1 qirsh, 6.2 % coverage. | — |
| [`LOYALTY-WAFII-LIVE-AUDIT.ar.md`](LOYALTY-WAFII-LIVE-AUDIT.ar.md) | Audit of the 47,720-member Wafii table (aggregated, phones masked). | — |
| [`LOYALTY-VERIFICATION-CHECKLIST.ar.md`](LOYALTY-VERIFICATION-CHECKLIST.ar.md) | Questions for Moaz (BI/Odoo) on the live programme, by priority. | — |
| [`LOYALTY-CASHBACK-PILOT-EVIDENCE.ar.md`](LOYALTY-CASHBACK-PILOT-EVIDENCE.ar.md) | Observational evidence from the 10 % cashback pilot (2021–2023). | — |
| [`LOYALTY-ODOO-ARCHITECTURE.md`](LOYALTY-ODOO-ARCHITECTURE.md) | Engineering change spec for loyalty on Odoo 19, with STOCK/CUSTOM markers and a verification list. | yes — `OTP_DEV_CODE` and "nothing implemented" |
| [`LOYALTY-ODOO-MODULE.md`](LOYALTY-ODOO-MODULE.md) | Odoo 19 `loyalty`/`pos_loyalty` capability boundary and a custom-module design (not the addon that was built). | yes — tax question, earn base, missing companions |
| [`LOYALTY-PHASE-ZERO.ar.md`](LOYALTY-PHASE-ZERO.ar.md) | Runbook for the read-only Phase-0 measurement tools in `tools/`. | yes — tax question now settled |
| [`DEMAND-FORECASTING.md`](DEMAND-FORECASTING.md) | Research: demand forecasting and kitchen-order automation (LightGBM, newsvendor). | — |
| [`MARKET-RESEARCH.md`](MARKET-RESEARCH.md) | Adversarially verified market/competitor findings (Starbucks 2026 rewards, expiry mechanics). | — |
| [`STARBUCKS-REVERSE-ENGINEERING.md`](STARBUCKS-REVERSE-ENGINEERING.md) | Starbucks app mechanics mapped to Almond; screenshots in `reference/starbucks/`. | — |
| [`WEB-UX-RESEARCH.md`](WEB-UX-RESEARCH.md) | Ordering-UX research for `almond-web` (Starbucks, Costa, McDonald's, Dunkin', Pret). | — |
| [`BRANCH-SALES-MAP.ar.md`](BRANCH-SALES-MAP.ar.md) | **Other system** (branch-management dashboard): the sales map page `tools/branch-sales-map.html` and migration `20260810_branch_geo.sql`. | — |
| [`SQL-CORRECTION-PLAN.ar.md`](SQL-CORRECTION-PLAN.ar.md) | **Other system**: correction plan for the warehouse-order trigger (`20260807`/`20260808` migrations) — not the loyalty database. | — |

## Historical — superseded, do not follow

| Document | What it was | Banner |
|---|---|---|
| [`ALMOND-APP-SPEC-v2.md`](ALMOND-APP-SPEC-v2.md) | The original app build spec for Claude Code (June 2026). | yes |
| [`MASTER-PACK.md`](MASTER-PACK.md) | Starbucks-style redesign instructions for the app (June 2026). | yes |
| [`REVISION-PACK-v1.md`](REVISION-PACK-v1.md) | Post-review revision instructions for the app (June 2026). | yes |
| [`UX-RESEARCH-REFINEMENTS.md`](UX-RESEARCH-REFINEMENTS.md) | UX-study-based edit instructions for the app (June 2026). | yes |
| [`WEBSITE-HANDOFF.md`](WEBSITE-HANDOFF.md) | The brief that started `almond-web` (June 2026). | yes |
| [`AUTH-AND-PAYMENTS.md`](AUTH-AND-PAYMENTS.md) | Early auth/payment design; the principles hold, the "how" moved to `bff`. | yes |
| [`ODOO-INTEGRATION.md`](ODOO-INTEGRATION.md) | The app's wiring guide for a hypothetical `/loyalty/*` server; §1 (POS token) is still accurate. Referenced from code comments. | yes |
| [`EXPERT-REVIEW.md`](EXPERT-REVIEW.md) | Pre-launch expert review of the app (July 2026); most money/identity findings were fixed later in `bff`. | yes |
| [`IMPLEMENTATION-PLAYBOOK.md`](IMPLEMENTATION-PLAYBOOK.md) | July 2026 plan for the remaining work; many P0/P1 items are done. | yes |
| [`LOYALTY-BEST-PRACTICE.ar.md`](LOYALTY-BEST-PRACTICE.ar.md) | Loyalty design proposal (2026-09-03), built on premises later replaced by measurement. | yes |
| [`LOYALTY-CURRENT-STATE.ar.md`](LOYALTY-CURRENT-STATE.ar.md) | Snapshot of the programme at commit `bc704e9` (2026-09-04). | yes |
| [`LOYALTY-DECISIONS.ar.md`](LOYALTY-DECISIONS.ar.md) | Committee decision record (2026-09-04); the owner's 2026-09-06 design in `packages/shared/src/config` came after it. | yes |
| [`LOYALTY-EARN-PATCH.md`](LOYALTY-EARN-PATCH.md) | Earn-path patch spec anchored at `6a88ca3` (2026-08-18); line numbers stale. Referenced from code comments. | yes |
| [`MAP-HANDOFF-PRODUCTION-APP.ar.md`](MAP-HANDOFF-PRODUCTION-APP.ar.md) | Handoff of the sales-map page to the **other** repository `production-almond` (2026-08-10). | — |

## Non-Markdown files at the top of `docs/`

| File | What it is | Class |
|---|---|---|
| [`order-edit-guide.ar.html`](order-edit-guide.ar.html) | «تعديل الطلبيات — دليل التشغيل» for branch managers (2026-08-08) — the warehouse-order system, not this one. | Reference (other system) |
| [`دليل-تعديل-الطلبيات.pdf`](دليل-تعديل-الطلبيات.pdf) | PDF of the same guide. | Reference (other system) |

## Sub-folders

| Folder | Contents | Class |
|---|---|---|
| [`ishbek/`](ishbek/README.md) | Almond-side sample contract for Ishbek delivery: `README.md`, `0.README.json` plus seven JSON request/response samples (`1.`–`7.`), `sample.ts`. Field names are to be fixed from Ishbek's official docs. | Reference — `README.md` has a banner (16 % tax in the samples) |
| [`meps-integration/`](meps-integration/HANDOFF.md) | `HANDOFF.md`, `apex_ecr_claude_brief.md` and a terminal mapping spreadsheet for card-present MEPS terminals (`integrations/pos_meps_apex`, paused on the Apex ECR spec). | Reference |
| [`odoo/`](odoo/branch-filter-design.md) | `branch-filter-design.md`, `branch-dashboard-wiring.md` (the `almond_branch` addon), `perf-audit-runbook.md` and `collector.sql` (read-only Odoo performance audit). | Reference |
| [`maintenance/`](maintenance/صيانات-تطبيق-شهر-8.md) | August 2026 operations logs for production Odoo and the `production-almond` app: `2026-08-02/` (handoff, reports, Python scripts), `2026-08-16/RUNBOOK.md`, `2026-08-17/VARIANCE-SHRINKAGE.md`, `صيانات-تطبيق-شهر-8.md`. | Reference (other system; historical operations record) |
| `reference/starbucks/` | 16 screenshots (`01.jpg`–`16.jpg`) used by `STARBUCKS-REVERSE-ENGINEERING.md`. | Reference |

## Broken references (found while indexing)

Paths cited as `docs/…` that do not exist:

- `docs/LOYALTY-TIERS-NEW.ar.md` — cited in code, `packages/shared/src/config/index.ts` (the comment on `POINTS_PER_JOD`, the owner's 2/4/6 design of 2026-09-06). The document was never committed; the code comment now says so and is itself the record (fixed 2026-09-23).
- `docs/BRIEF.md`, `docs/IMPL-BRIEF.md` — cited as companions by `LOYALTY-ODOO-MODULE.md` and `LOYALTY-EARN-PATCH.md`; `LOYALTY-CURRENT-STATE.ar.md` already notes they are missing.
- Several `docs/*.md` paths inside `.claude/plugins/odoo-ai-skills/` (e.g. `docs/evidence-artifact.md`, `docs/ci-integration.md`) refer to that vendored plugin's own upstream repository, not to this `docs/` folder.
