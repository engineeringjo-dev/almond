# Gift cards across the four companies — implementation plan for Claude Code

> **ملخّص بالعربي:** خطة تنفيذ بسبع مراحل لبطاقات هدايا تملكها إيفورا وتُصرف في
> الشركات الأربع. كل مرحلة فيها: المستودع، الفرع، الملفات، الخطوات، اختبار القبول،
> والبوّابة (من يوافق قبل الانتقال). المرحلة 1 تُنفَّذ فوراً بلا أودو. المراحل 2–4
> إعداد ومحاسبة على أودو (staging أولاً، والإنتاج بموافقة لكل خطوة). المراحل 5–6
> تطوير موديول أودو وجوفوترا، وتنتظر رأي المستشار الضريبي قبل بيع البطاقات المطبوعة.

Source of the decisions: the report "بطاقات الهدايا بين الشركات الأربع — الربط في
أودو" (2026-09-30) and `docs/gift-cards/README.md`. Read both before starting.

## Decisions this plan implements

- **Evora (company 1) owns the programme**, the liability, the float and breakage.
- **Card sale:** no tax on the card (not 0%, no tax at all). The selling company
  books *due to Evora*, never revenue.
- **Redemption:** VAT **8%** on the goods, full value. The card is a means of
  payment, never a discount. The redeeming company books *due from Evora*.
- **Settlement:** card-sale cash is swept to Evora daily. Redemptions are netted
  monthly against the kitchen intercompany invoices, in a **separate** entry.
- **Values:** printed card fixed **10 JOD**; app eGifts **5 / 10 / 25**, default
  **10**; corporate **50**; seasonal Ramadan **3**.
- **No** Odoo inter-company rules for this flow, **no** conversion to branches,
  **no** single entry across two companies (Odoo cannot do it).

## Guardrails (every phase)

1. **Odoo is read-only by default.** Any write to the production database
   (`ag-almond-coffee-house-master1-…`) needs the owner's explicit approval for
   *that* step ("APPROVE PROD"). Do it on staging first, every time.
2. **Keys are never written to a file**, a commit or a log. Load them into the
   process environment only.
3. **Scripts that write are dry-run by default**, take `--apply`, are
   idempotent, write a restore snapshot before changing anything, and refuse to
   run twice over the same snapshot.
4. **Odoo module code** goes on a feature branch of
   `almondcoffeehouse-stack/Almond-Coffee-House`, then the odoo.sh staging
   branch, then `master1` only with approval. Never push to `master1` directly.
5. **Test a guard by breaking it** (repo rule): break it, see the test fail,
   restore it byte-for-byte.
6. **Never kill processes by pattern.** Record the PID.
7. **JoFotara is live on all 14 POS configs** with auto-send. Any change to what
   a POS order contains is tested on staging with a real order first.

## Phase 1 — App and website values (almond repo, no Odoo) · now

**Goal:** one list of eGift amounts, 5 / 10 / 25, default 10, used by the app
and the website.

- **Where:** `packages/shared/src/gifts/designs.ts` (add `GIFT_AMOUNTS` and
  `DEFAULT_GIFT_AMOUNT`). Replace `AMOUNTS` in
  `almond-app/components/gift/GiftSendSheet.tsx` and `GIFT_AMOUNTS` in
  `almond-web/src/data/loyalty.ts` with the shared constants.
- **Tests:** in `almond-app/test/gift-designs.test.ts`, the amounts are
  `[5, 10, 25]`, the default is in the list, and both apps import from shared
  (source-text check). Update `almond-web/src/store/stores.test.ts` if it pins
  an amount.
- **Acceptance:** full gate (`CLAUDE.md` rules) green, CI green, then
  fast-forward `main`.
- **Gate:** none. The owner already asked for it.

## Phase 2 — Odoo accounting setup (Stage A) · staging, then prod per step

**Goal:** every card sale and redemption posts to the right company and account,
with configuration only.

Write one reviewed script: `scripts/odoo_giftcard_setup.py` in the
Almond-Coffee-House repo, using XML-RPC. It has three modes: dry-run (default),
`--apply` and `--restore <snapshot>`. Steps, each idempotent:

| # | Change | Live ids today |
|---|---|---|
| 1 | Create the account **"ذمم شقيقة – بطاقات هدايا"** (proposed code 11410014). Type `asset_receivable`, `reconcile=True`, `company_ids=[1,2,3,4]` | new |
| 2 | Create the account **"مستحق لشقيقة – بطاقات هدايا"** (proposed code 21110014). Type `liability_payable`, `reconcile=True`, `company_ids=[1,2,3,4]` | new |
| 3 | Create the account **"إيراد بطاقات غير مستعملة"** (breakage income) | Evora only |
| 4 | Create products "Evora Gift Card 5" and "Evora Gift Card 10". Service, `company_id=False`, **`taxes_id` empty**, `available_in_pos=True`. Per-company `property_account_income_id`: Evora → 5969 (21350019). Companies 2, 3 and 4 → step 2's account. Read it back per company with `with_company`. | new |
| 5 | Create the gift-card programme **"بطاقة هدايا إيفورا"** (`program_type=gift_card`, `company_id=False`, `pos_config_ids` empty). Its reward's `discount_line_product_id`: **no tax**. Income account: Evora → 5969; companies 2, 3 and 4 → step 1's account | new |
| 6 | Fix the existing products 17201, 17317 and 17321 the same way, **or** archive them once the new products are live. Evora's income account must stop being 41000007 | existing |
| 7 | **Archive** programme 20 ("Gift card 100", 1,794 cards) and product 24071. **Only after the owner confirms** what it was created for | existing |

- **Acceptance (staging, with real POS orders):**
  1. Sell a 10 JOD card at an Almond branch (config 18). Almond posts Dr cash /
     Cr step-2 account, with no revenue and no tax lines.
  2. Redeem it at a Leria branch (config 15) on a 10.800 order. Leria posts
     revenue 10.000 + VAT 0.800, and Dr step-1 account 10.000.
  3. The JoFotara submission for order 2 is accepted on staging, or the reason
     is logged.
  4. Nothing posts to 41000007 from a card.
- **Gate:** the accountant reviews the staging entries. Then the owner
  approves each production step.

## Phase 3 — Historic clean-up · draft entries only

**Goal:** move today's scattered card liability to Evora.

- Script `scripts/odoo_giftcard_reclass.py` builds **draft** entries (never
  posts them) in each company:
  - Leria 317.15, Almond 248.65 and Italian 185.24 on 21350019 move to Evora
    through the phase-2 intercompany accounts.
  - Evora's card sales booked to 41000007 are reclassified to 5969.
- The accountant reviews and posts. The owner decides what happens to the
  expired Ramadan balance (4,385 JOD): breakage income or an extension.
- **Gate:** accountant review. The script never posts.

## Phase 4 — Evora mirror entries and settlement report · Odoo module

**Goal:** Evora's books show the liability and the intercompany balances
automatically.

- **New module:** `almond_gift_card` in the Almond-Coffee-House repo (Odoo 19;
  use the `abu-laith-odoo-router` skill).
- **Daily cron.** For the previous business day, per company 2/3/4:
  - Sum card sales from the gift products' POS lines, and redemptions from
    reward lines of the Evora programme (attributed by
    `pos.order.line.company_id`).
  - Post one entry in Evora's Miscellaneous journal, with the partner set to
    that company (6, 7 or 8):
    - sales: Dr step-1 / Cr 5969;
    - redemptions: Dr 5969 / Cr step-2.
  - Idempotency: one reference per (date, company, kind), e.g.
    `GC/2026-10-01/C3/SALE`. A rerun changes nothing.
- **Report:** a pivot or report per company pair and month, with these columns:
  - cards sold (swept vs not swept);
  - cards redeemed;
  - kitchen IC invoices;
  - net amount;
  - unreconciled items.
- **Tests:** Odoo tests for the posting maths, idempotency, cut-off (Amman
  business day), and a company with no activity.
- **Gate:** staging for one full month-end with the accountant, then approval.

## Phase 5 — Card as a payment method + printed-card security · Odoo module

**Goal:** stop recording redemptions as a negative line, and make printed cards
safe before they go on sale.

- `loyalty.card` gets these fields:
  - `x_serial` (printed, visible);
  - `x_pin_hash` (the scratch-off code, stored hashed);
  - `x_state`: `inactive → active → exhausted | expired`.
- **POS payment method "بطاقة هدايا إيفورا":**
  - Server RPC with `sudo`, across companies. It validates serial + PIN, state
    and balance, and **debits atomically on order validation**, idempotent per
    order uuid.
  - Refused offline.
  - Refunds re-credit the card.
  - Outstanding account per company: Evora → 5969; others → step-1 account.
- **Activation:**
  - Selling the printed card at the till activates it by serial.
  - An inactive card has no value.
  - Reports cover activations without payment.
- **Printed batch:**
  - A command generates N cards: serial, a random PIN (stored hashed), and
    state `inactive`.
  - It exports a CSV for the printer (serial, PIN, barcode payload).
  - The CSV is exported **only after** the supplier has signed confidentiality,
    and is never committed.
- **Tests** (break each guard once):
  - double redemption across two companies at the same time;
  - wrong PIN;
  - inactive card;
  - expired card;
  - refund;
  - rerun of the same order.
- **Gate:** the owner approves. The printed cards do not go on sale before this
  phase is live.

## Phase 6 — JoFotara · gated on the tax adviser

**Goal:** the e-invoices match the tax treatment.

- In `agile_consulting_l10n_jo_edi_pos`:
  - **skip EDI** for orders whose lines are all gift-card sale products;
  - for mixed orders, drop gift-card sale lines from the UBL;
  - with phase 5, the redemption is a payment, so the UBL shows the goods at
    full value and 8%, with no negative line.
- Keep the MRO lesson from `CLAUDE.md` in that repo: prefix custom methods
  (`_agile_…`). Check `getattr(type(rec), m).__module__` after deploying.
- **Gate:** a written tax-adviser opinion (or ISTD ruling) on the card sale
  and its JoFotara document **before** this ships. Then staging, then
  approval.

## Phase 7 — App eGifts on the same balances (almond repo) · later

- The BFF gift routes create and read cards in the **Evora programme** through
  Odoo, so the app and printed cards share one balance ledger.
- Payment settles into Evora's merchant account. The app shows the card with a
  code or barcode for the till.
- Keep `enabled.gift=false` until phases 2, 4 and 5 are live
  (`docs/LOYALTY-ODOO-ARCHITECTURE.md` §E.2).

## Rollout and measurement

1. Pilot one branch per company for 2 weeks. Reconcile Evora against each
   company weekly.
2. Then all branches. Review after 90 days:
   - the most chosen value;
   - the average ticket on redemption;
   - share spent above card value;
   - unused balance;
   - days to sweep cash.

## Kickoff prompts (copy one per session)

**Phase 1:**
```
Read docs/gift-cards/CLAUDE_CODE_PLAN.md and do Phase 1 only in the almond repo.
Follow CLAUDE.md: shared constants in packages/shared, Arabic strings in ar/en,
break-the-guard test, full gate, push, CI green, then fast-forward main.
```

**Phase 2 (staging):**
```
Read docs/gift-cards/CLAUDE_CODE_PLAN.md (almond repo) and CLAUDE.md in
Almond-Coffee-House. Write scripts/odoo_giftcard_setup.py for Phase 2 on a
feature branch: dry-run by default, --apply, --restore, idempotent, snapshot.
Run the dry-run against STAGING only and show me the plan. Do not write to
production. Keys from the environment only.
```

**Phase 4/5 (module):**
```
Read docs/gift-cards/CLAUDE_CODE_PLAN.md. Use the abu-laith-odoo-router skill.
Build the almond_gift_card module (Phase 4, then Phase 5) on a feature branch of
Almond-Coffee-House with Odoo tests; staging only; no push to master1.
```
