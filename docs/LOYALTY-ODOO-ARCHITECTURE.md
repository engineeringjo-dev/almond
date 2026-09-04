# Almond loyalty on Odoo 19 — the architecture and change spec

**Status:** engineering change spec. It names real files and real symbols. It does not modify any
source file; nothing in this round was implemented.

**Basis:** `docs/LOYALTY-ODOO-MODULE.md` (1,705 lines, loyalty-only, silent on stored value),
`docs/LOYALTY-MEASURED-TRUTH.ar.md`, `docs/LOYALTY-WAFII-LIVE-AUDIT.ar.md`,
`docs/LOYALTY-DECISIONS.ar.md`, and the repo as it stands today.

**Verification discipline (binding).** Odoo is unreachable from this container — `*.odoo.com`
returns 403 at the egress proxy (`docs/LOYALTY-ODOO-MODULE.md` §0; `tools/loyalty_audit_live.py:186`
handles the same failure). Every claim about Odoo carries one of three markers:

| Marker | What it means — read the middle one carefully |
|---|---|
| **[STOCK — verified in doc §x]** | Asserted and owned by `docs/LOYALTY-ODOO-MODULE.md` and already in its §9 probe manifest. That document's own §0 says every `[STOCK]` row is written **from the addon design, not from the live database.** So this marker means *"already written down and already scheduled for probing"* — **not** *"confirmed"*. |
| **[STOCK — must probe]** | Believed to be stock Odoo 19 behaviour and not covered by that document. Unverified twice over. Every one carries an exact probe in the VERIFICATION LIST. |
| **[CUSTOM]** | Not in stock Odoo under any configuration. Someone types it. |

**No marker is upgraded anywhere in this document, including where upgrading it would make the design
look cheaper.** Repo-internal corroboration is cited by `file:line` and is labelled corroboration,
never verification. One row that an earlier draft of this spec marked as verified has been
**downgraded** — see CORRECTIONS LOG C-55.

**What was checked in the repo before writing** (each is a verified fact about *this tree*, not about
Odoo):

| Fact | Verified at |
|---|---|
| `verifyOtp` accepts `config.OTP_DEV_CODE` for **any** phone, with no OTP ever requested, no rate limit | `bff/src/auth/otp.ts:23-24`, `bff/src/config.ts:13` (default `'123456'`) |
| `creditWallet` credits from a client-supplied body with **no** payment reference | `bff/src/routes/wallet.ts:21-22` |
| `/v1/pos/scan`'s key check is skipped entirely when `POS_SCAN_KEY` is unset | `bff/src/routes/pos.ts:19`, `bff/src/config.ts:14` (default `''`) |
| `usedJti` is an unevicted in-process `Set` and is the only replay guard on the authorization path | `bff/src/pos/token.ts:16` |
| idempotency store is an unevicted `Map`; `at` is written and never read; `pending` is cleared only by `onSend` | `bff/src/plugins/idempotency.ts:9,35,45` |
| unauthenticated callers all share the idempotency namespace `anon` | `bff/src/plugins/idempotency.ts:14-17` |
| `addSpend` is `m.windowSpend += jod`; nothing rolls off | `bff/src/backend/memory.ts:78` |
| compensation is `creditWallet` with no key, inside `catch {}` | `bff/src/routes/checkout.ts:82`, `bff/src/routes/subscription.ts:31` |
| `collectSources()` walks 4 roots, `/\.tsx?$/` only, and applies one `stripComments` to every file | `bff/test/earn.test.ts:340,361-397` |
| the BFF's backend selection never reads `integration.enabled.*` | `bff/src/backend/index.ts:8` vs `packages/shared/src/integration/index.ts:21-27` |
| there is **no** staff, manager, cashier or branch credential anywhere in `bff/src/` | repo-wide grep: one unrelated hit at `bff/src/analytics/orderLines.ts:23` |
| `almond-app/services/loyalty.service.live.ts` posts `userId` in the body to a standalone server, with a static bearer and no idempotency key | `:31-32,44-45`; `packages/shared/src/integration/index.ts:8,49-66` |
| `pos_meps_apex`'s `PaymentInterface` file **flags itself unverified against 19**; `send_payment_cancel` is `return true` | `integrations/pos_meps_apex/static/src/app/payment_meps.js:9-12,44-47` |
| `almond_followers_guard` forces `mail_create_nosubscribe=True` on `loyalty.card` create | `integrations/almond_followers_guard/models/loyalty_card.py:8-12` |
| `'ewallet'`/`'gift_card'` hold a currency balance in the same `points` column | corroboration only: `tools/loyalty_measure.py:118-124` |
| wallet/gift tender posts as `is_reward_line=True`, value = amount **tendered** | corroboration only: `tools/loyalty_measure.py:1717-1731` |
| pooling the ewallet reward's `discount=1` with loyalty's `0.01` is a 50× error this repo made | corroboration only: `tools/loyalty_measure.py:826-840` |
| the wallet multiplier, the bonus day and the Friday bonus have **zero rows in 171,291 live transactions** | `docs/LOYALTY-WAFII-LIVE-AUDIT.ar.md` §8; `docs/LOYALTY-MEASURED-TRUTH.ar.md` §2 |
| the customer app is **not in production** | `docs/LOYALTY-DECISIONS.ar.md` ق‑11 |

---

## الملخّص التنفيذيّ للمالك

١. **كتابة رقم الهاتف تُعرِّف الحساب. وهي لا تُفوِّض شيئاً.** هذه هي الجملة التي يقوم عليها التصميم كلّه.
٢. برنامجان منفصلان في Odoo: `almond_points` للنقاط (التزام تسويقيّ) و`almond_wallet` للمحفظة (**نقد الزبون**). الرصيدان في العمود نفسه من الجدول نفسه، فالخلط بينهما **غير مرئيّ حسابيّاً** — ويمنعه فلترٌ إلزاميّ يفرضه اختبار، لا الذاكرة.
٣. المحفظة تصير **وسيلة دفعٍ حقيقيّة** في نقطة البيع، لا سطر خصم. السبب اتّجاه الفشل: وسيلة الدفع ترفض عند انقطاع الشبكة، أمّا الرقعة البرمجيّة فتسمح بالصرف إن لم تُحمَّل.
٤. **صرف النقاط على الصندوق يمرّ بتأكيدٍ خادميّ إلزاميّ** ويُرفَض سطر المكافأة بدونه. بلا هذا يبقى نصف الصرف خارج كلّ ضوابط التفويض — وهذا كان أخطر ثغرات المسوّدة السابقة.
٥. جدولان جديدان فقط: `almond.loyalty.grant` (تفويضٌ واحدٌ لحركةٍ واحدة، مفتاحه فريد في قاعدة البيانات) و`almond.loyalty.op` (سجلّ النيّة والحركة، مفتاح `op_key` فريدٌ عالميّاً). الضمانة في PostgreSQL لا في منطق التطبيق.
٦. المعدّل المجمَّد 4/6/8/10 يعيش عموداً على `res.partner`، **يُشتقّ من عمود الشريحة في التصدير** لا من صفوف الاكتساب — لأنّ نصف القاعدة لم يشترِ قطّ ولا يملك صفّاً يُشتقّ منه.
٧. الترحيل: الرصيد الافتتاحيّ **حركةٌ في سجلّ**، لا كتابةُ رصيد. ترتيبٌ واحدٌ لا اثنان: البرامج ← الأعضاء (مع مطابقةٍ على الموجودين في Odoo) ← المعدّلات ← قيود افتتاحيّة موقوفة ← ستّ بوّابات ← التبديل والقطع **في نافذةٍ واحدة**.
٨. **يُحمَّل 44,929 ديناراً على البطاقات، ويُخصَّص 17,166.** الرقمان يؤدّيان وظيفتين مختلفتين؛ خلطهما يُنقِص إصدار **27,763 ديناراً** على 47,720 عضواً بلا أن يراه أحد.
٩. **تصحيحٌ للموجز:** ليس هناك «حسابان يحملان 283,431». هناك **حسابٌ واحد** يحمل 283,432 ديناراً و**32 حساباً** تحمل 456 ديناراً بينها جميعاً — و31 منها أعضاءٌ عاديّون يجب أن يبقى رصيدهم (ق‑12).
١٠. لوحة الزبون **جهازٌ منفصل** يتحدّث إلى الـBFF، لا شاشة Odoo. شاشة Odoo تحمل قائمة الشركاء في ذاكرة جهازٍ يواجه الجمهور.
١١. اللوحة لا تُظهر شيئاً: الردّ واحدٌ للعضو ولغير العضو. شاشة الموظّف قبل التفويض تُظهر **آخر رقمين كتبهما الزبون** ومعدّل الاكتساب — لا اسماً ولا رصيداً.
١٢. **صدى الرقمين يحلّ مشكلة الـ29٪ بلا اسم**: يعمل لـ100٪ من الأعضاء، ويكشف الخطأ الذي يقع فعلاً على الصندوق — رقمٌ مكتوبٌ خطأً يُقيَّد لغريب.
١٣. الرصيد لا يُطبَع على الإيصال إلّا إذا حمل الطلب تفويضاً. وإلّا فالإيصال قناةُ كشفٍ عن رصيد طرفٍ ثالث بثمن قهوة.
١٤. **بلا اتّصال:** الاكتساب يمرّ، والصرف لا يمرّ إطلاقاً، والتأجيل عبر اللوحة يُشحن **فقط** إذا رُبط بربطٍ محلّيّ برقم الطلب — وإلّا فهو قناة قيدٍ يدويّ بلا سقف.
١٥. التطبيق ليس في الإنتاج، فالتوصية: **الاكتساب فقط على الصندوق** حتّى يصدر التطبيق. لا شيء في التصميم يتغيّر بذلك؛ درجةٌ واحدة من سلّم التفويض تبقى غير مستعمَلة.
١٦. سقف 0.45 ديناراً **متوسّطٌ لا حدّ لكلّ عمليّة**: فاتورة 50 ديناراً بمعدّل 10 تُنتج 5.00 دنانير — أحد عشر ضعف السقف. السؤال يعود إلى اللجنة قبل البناء، ولا يحسمه اختبار.
١٧. مضاعف المحفظة ويوم البونص وبونص الجمعة وبونص الكومبو **موجودة في المستودع ومعدومة في البرنامج الحيّ** (صفر صفوف من 171,291). إلغاؤها **لا يخرق** «لا يتوقّف أيّ عرض»، لكنّه قرار عرضٍ يُتّخذ صراحةً.
١٨. خمسةٌ وعشرون سؤالاً للفحص، أربعة منها **شروط توقّف**، وواحدٌ حاجزٌ صلب على أيّ سطرٍ من كود وسيلة الدفع. الفحص يحتاج نسخةً وصلاحيّةً ومالكاً وتاريخاً — وهي أوّل ما ينقص الخطّة.
١٩. أُدرِج **٥٦ من ٦١** ملاحظةً بتغيير التصميم، و**٥** رُدّت بأسبابها في سجلّ التصحيحات.
٢٠. الخطر الأكبر المتبقّي: **حدود التصدير من وفيّ.** لا أحد أثبت أنّ المزوّد يُخرج تصديراً عند الطلب بمفتاحٍ ثابت — وبدونه لا وجود لحدٍّ نظيفٍ للقطع.

---

## 0. The one sentence, the six adversaries, and the two facts that pick the centre of gravity

> **Typing a phone number identifies an account. It authorizes nothing.**

| # | Adversary | Capability | Wants | Closed by |
|---|---|---|---|---|
| **A1** | The colleague | one phone number, physical access to the pad | spend a colleague's wallet or points | §C.3 step 3 (constant response) + §C.5 (cannot produce a factor) + §A.3.3 (points redemption needs a grant too) + §G gate 0 (the OTP bypass deleted) |
| **A2** | The enumerator | unlimited typing at a public counter | a phone ⇄ name list over 47,720 members | §C.3 step 3, one response shape, padded latency — **T18** |
| **A3** | The self-crediting cashier | 3,238 invoices/day, a till, a browser devtools console | accrue others' earn; spend a customer's balance; wash the wallet to cash | §A.7 grant table (a hand-written grant id is rejected) + §D.6 refund-to-same-tender + §C.4 audit + §B.5 forensic pair |
| **A4** | The replayer | resend, retry, restart, offline queue, a second BFF instance, a deploy | double-credit, double-issue, double-debit | `UNIQUE(op_key)` and `UNIQUE(token_jti)` **in Postgres** (§A.7, §A.8) |
| **A5** | The pad thief | whatever is on the device | whatever the pad holds | §C.2 — the pad's cache is the empty set and its queue is sealed-box ciphertext |
| **A6** | The insider | Odoo UI, model-level ACLs | read the base, adjust a balance, raise a rate | §A.4 steward ACL + `@api.constrains` + domain CHECK + §A.7's closure over `loyalty.card.points` |

Two measured facts decide where the effort goes. **586 accounts hold ≥10 JOD and 14 hold ≥50 JOD**
— A1 does not need to scale, so a rate limit is not a defence against him. And **3,369 of 11,628
members active in 2026 (29%) have no name on file** — for those accounts every name-based challenge
produces zero evidence of identity, so the identity check cannot be a name.

**The asymmetry that governs every mechanism choice in §A:** a control that fails *closed* is a
control; a control that fails *open and silent* is a comment. This is why the wallet becomes a
payment method rather than a JS patch (§A.3.2), why the points redemption confirm is enforced by a
**server-side order guard** and not only by the client patch that calls it (§A.3.3), and why the
stock earn rule is configured to pay **zero** rather than a plausible number (§A.5).

---

# A. The Odoo data model

## A.1 Two programmes, ids in configuration, never guessed

**[CUSTOM configuration of [STOCK — must probe] machinery]**

| | `almond_points` | `almond_wallet` |
|---|---|---|
| `program_type` | `'loyalty'` — **[STOCK — must probe]** V1 | `'ewallet'` — **[STOCK — must probe]** V1; corroborated `tools/loyalty_measure.py:124` |
| `loyalty.card.points` holds | points; 1 point = 1 qirsh = **10 fils** (10,621 redemptions, median 100.0000 pts/JOD) | **JOD**, in the same Float column |
| `portal_point_name` | `'نقطة'` | the currency symbol (`loyalty_measure.py:832`) |
| Liability class | promotional | **customer cash** |
| Opening balance at migration | the reconciled clean figure (§E.1 step 4) | **0.00 JOD** (§E.1 step 7) |
| Programme id read from | `ir.config_parameter almond_loyalty.points_program_id` | `…wallet_program_id` |

The five-model shape (`loyalty.program` / `rule` / `reward` / `card` / `history`) is
**[STOCK — verified in doc §1.1]**: *"one partner's balance in one program"*.

**Why the separation is a security control and not bookkeeping.** Both balances live in the same
column of the same table under one shared `loyalty.history` — Odoo labels that model *"History for
Loyalty cards and Ewallets"* (`loyalty_measure.py:1482`) **[STOCK — must probe]** V10. At 1 point =
1 qirsh the two are the same unit off by 100×, so **a mix-up is arithmetically invisible.** One
`read_group` on `loyalty.card.points` with no `program_id` domain folds promotional liability into
customer cash, and this repo has already made that class of error once
(`loyalty_measure.py:826-840`, a 50× error its author learned by making it). Enforced by **T24**,
never by memory.

**Stop condition.** If V1 reports no `'ewallet'` value, the stored-value design is **[CUSTOM] from
zero**, §A.3 is void and §A.9's estimate is wrong. That is a revision, not a workaround.

**A programme may already exist.** Odoo went live at the start of 2026 and holds POS receipts; V4
and V6 both *sample live ewallet and gift-card transactions*, which presumes they may exist. §E.1
step 1 therefore **searches before it creates**: if a `'loyalty'`, `'ewallet'` or `'gift_card'`
programme is already present, `ir.config_parameter` points at the existing record and its existing
cards are inventoried, or the batch stops. Creating a second points programme next to a live one
strands every card on the first.

## A.2 One member, two cards

Two `loyalty.card` rows differing only in `program_id`. `loyalty.reward.program_id` is required and
the redemption path resolves reward → programme → *that programme's* card for the partner, so
**cross-draw is not expressible**: no field on any reward can name a card or a second programme.
**[STOCK — must probe]** V2.

**What is not known:** whether `loyalty.card` carries `UNIQUE(program_id, partner_id)`
**[STOCK — must probe]** V3. If not, the module adds a partial unique index scoped to the two Almond
programme ids **[CUSTOM]**. Two wallet rows for one member is a balance that reads differently
depending on which row you find — and A1 can spend from one and present the other.

V3 answered on an empty or lightly-used instance proves nothing about 47,720 concurrent card
creations, so the duplicate check also runs **against the loaded data, after the batch, before the
flip** — migration gate 5 (§E.1 step 8).

## A.3 The wallet's accounting, and the two mechanisms

**[STOCK — must probe, corroborated at `loyalty_measure.py:1717-1731`]** Stock `pos_loyalty` does
not treat an ewallet or a gift card as a payment. It posts a **negative order line**:
`pos.order.line` with `is_reward_line=True` and a `reward_id`, the same shape as a loyalty discount.
Consequences (V4, V5):

- it reduces `pos.order.amount_total` and **never appears in `pos.payment`**;
- its accounting lands on `loyalty.reward.discount_line_product_id`'s income account — the **P&L**;
- **there is no stock wallet-liability account anywhere.** Customer prepaid cash is released as a
  *discount*.

### A.3.1 V5b decides the accounting. It does not decide the tender.

**V5b — does Odoo 19 accept a liability-type `account.account` in
`product.template.property_account_income_id`?** One `fields_get` plus a read of the field's domain.
If it passes, the finance defect closes with **two product records and one account**
(`2310 Customer stored value (JOD)`, a liability): the top-up product credits `2310`, the wallet
reward's `discount_line_product_id` debits it, and revenue is recognised on the coffee at full
price.

**In most Odoo versions that field carries a domain restricting it to the income account-type
family, so this most likely fails.** Both numbers go to the owner, not one:

| V5b | Accounting fix | Tender still built? | Odoo surface |
|---|---|---|---|
| **passes** | 1 `account.account` + 2 `product.template` writes, zero code | **yes** — bought for fail-closed offline, not for the accounting | tender + controller + `PaymentInterface` |
| **fails** | the tender **is** the fix | yes | same |

V5b changes the *justification* and the *fallback if the tender slips*, not the plan.

### A.3.2 The wallet is a real `pos.payment.method` — and the reason is failure direction

**[DECISION]** The wallet becomes a `pos.payment.method` **[CUSTOM]**, on the extension idiom this
repo already uses: `use_payment_terminal` `selection_add=[('almond_wallet', …)]` with
`ondelete={'almond_wallet': 'set default'}`, a `PaymentInterface` subclass registered by
`register_payment_method('almond_wallet', …)`, secrets in `ir.config_parameter` and never in the
browser.

> **The idiom is [STOCK — must probe], not proven.** `integrations/pos_meps_apex/static/src/app/payment_meps.js:9-12`
> says so in its own words: *"⚠️ VERIFY against Odoo 19: the exact PaymentInterface base
> import/registration path can shift between versions… Logic below is the intended shape."* The
> imports it uses (`@point_of_sale/app/payment/payment_interface`,
> `@point_of_sale/app/store/pos_store`) sit exactly in the surface
> `docs/LOYALTY-ODOO-MODULE.md:1514` rates *"Highest churn in Odoo"*. **V13** resolves the import
> path and the registration signature on the target, and `hooks.py` asserts at boot that
> `'almond_wallet'` is present in `pos.payment.method.use_payment_terminal`'s selection — because a
> tender that silently failed to register is a tender that is not there when the cashier reaches for
> it.

The alternative — a JS patch on a `pos_loyalty` client-side chokepoint — is **rejected on failure
direction**:

> A `PaymentInterface.send_payment_request` that cannot reach the server **declines by
> construction**. A monkey-patch that did not load after an upgrade **permits by construction**, in
> the surface doc §8 rates *"Very high — the POS front end was rewritten in 18 and continues to
> move."* A patch that fails open, silently, on customer cash is doc §7.3's two-tills double-spend
> with money instead of points.

Three further reasons, in order of weight:

1. A `pos.payment` row is the only place in Odoo where a tender is reconciled against a journal and
   a cash-up. A discount line is **not counted in the Z-report** — so an attacker moving customer
   money through the discount path moves it through the one channel the daily close does not
   balance.
2. The shift manager signs the Z-report. 5–50 JOD of customer money per ticket with no line on that
   document is a control that does not exist.
3. Only a `pos.payment` gives the refund path a tender to return the money *to* — which is what
   §D.6's refund-to-same-tender rule is enforced against.

**Blocking gate: V15 (void/refund).** No line of wallet-as-tender code is written until V15 answers
(a) does voiding a stock reward line restore `loyalty.card.points`, (b) on a refund against a custom
`pos.payment.method`, is `send_payment_request` called with a negative amount or is there a separate
hook, and (c) **does Odoo 19 permit a refund to be returned to a different payment method than the
original**. (c) is not a detail: if it does, the wallet-to-cash wash in §D.6 is available to every
cashier from day one.

**And `send_payment_cancel` must be implemented before gate 5 exits.** The reference on disk
(`payment_meps.js:44-47`) is `// TODO(Apex): implement VOID` followed by `return true` — it reports
every cancellation as successful. Copying that shape onto customer cash is a money bug with a known
trigger.

### A.3.3 Points redemption also gets a server confirm — the correction that matters most

An earlier reading of this design left points redemption entirely on the stock client-side
reward-claim path on the grounds that *"a point is a discount and it costs no code."* That is wrong,
and it is the single largest hole the review found:

> Stock `pos_loyalty` writes **no `almond.loyalty.op` row** and makes **no server round trip** when a
> reward is claimed. So every control this document builds for spending — the §C.5 factor ladder,
> `_debit_needs_auth`, `_debit_names_grant`, `_grant_once`, `almond_loyalty_blocked`, the op ledger,
> the reconciler — is **unreachable on the one surface where A1 and A3 actually stand**. §0's
> sentence would have been enforced by Postgres constraints on a table the till's spend path never
> touches. And it would have rejected the JS patch for the wallet on fail-open grounds while relying
> on *nothing at all* for points.

**[DECISION] Points redemption at the till is server-synchronous and mandatory,** restoring doc
§6.3's own design (*"Redemption confirm | server, synchronous, mandatory | hard timeout 2.5 s"*).
Two halves, and the second is the one that fails closed:

1. **`controllers/redeem_confirm.py`** — called by a small POS client patch before the reward line is
   accepted. It consumes the grant (§A.7), writes the op `pos:<uuid>:line<pos_order_line_id>`, debits
   the card under a row lock, and returns the new balance. On timeout the POS shows
   «تعذّر الاستبدال — لا يوجد اتّصال» and the reward is **not** applied.
2. **`models/pos_order.py` — a server-side validation guard on the sync/create path** that
   **rejects** any `is_reward_line=True` line whose `reward_id.program_id` is `almond_points` or
   `almond_wallet` unless a matching **applied** op exists carrying an `authz_grant_id`. Rejecting
   an order line stops the sale; permitting it does not. **This is the half that does not depend on
   the client patch having loaded.**

**Cost, stated honestly:** this adds one patched client symbol and one patched server symbol in doc
§8's highest-churn surface, and it makes doc §6.3's 0.6–0.9 s round trip real. It is the price of
the sentence in §0 applying to both halves of the balance.

**Until (1) and (2) ship, the module refuses to load a points programme that has a redeemable
`loyalty.reward` attached to a POS config.** That is §C.10's "earn-only at the counter" expressed as
code rather than as a recommendation.

## A.4 The per-member grandfathered rate

Stock cannot express it. **[STOCK — verified in doc §1.2]**: *"`loyalty.rule` filters on products,
categories, tags, quantities and amounts. It has no partner input at all… every customer-dependent
mechanism is CUSTOM."* Three non-starters, recorded so nobody rediscovers them: four programmes one
per rate (a member matches all four and earns 28 pts/JOD); the pricelist trick (rejected in doc §1.2
for three stated reasons); per-member `reward_point_amount` (it is a field on the rule).

`integrations/almond_loyalty/models/res_partner.py` (INHERIT) — **all [CUSTOM]**:

```python
# The EFFECTIVE rate. One field, not three. There is no tier model in this design
# (§A.9 cancels almond.loyalty.tier by name), so there is no "current rate the tier
# would give today" and therefore no max(floor, current) to compute. The raise-only
# guarantee is the @api.constrains below — stated plainly, not implied by a max().
almond_earn_rate        = fields.Float(digits=(6, 2), tracking=True, index=True, default=0.0)
almond_earn_rate_source = fields.Selection([('wafii_migration', 'Wafii migration'),
                                            ('promotion',      'Automatic promotion'),
                                            ('manual',         'Manual, with ticket')], tracking=True)
almond_earn_rate_set_on = fields.Date(tracking=True)
almond_earn_rate_ref    = fields.Char()      # ticket / signature reference

almond_wafii_key        = fields.Char(index=True, copy=False)   # §E.1 step 2; see V-note
almond_loyalty_blocked  = fields.Boolean(groups='almond_loyalty.group_almond_loyalty_manager')
almond_phone_unusable   = fields.Boolean()

_wafii_uniq = models.Constraint('UNIQUE(almond_wafii_key)', 'This Wafii member is already migrated.')
_rate_domain = models.Constraint(
    'CHECK (almond_earn_rate IN (0, 4, 6, 8, 10))',
    'The earn rate must be one of the four live rates. 0 is permitted only before migration.')
```

**Four controls, or the field is decorative and A6 walks through it:**

1. **`@api.constrains('almond_earn_rate')` that raises**, not warns, on any write that **lowers** it,
   and on any write that sets it to `0` on a partner whose rate is already non-zero. Doc §8.2 item 5
   and §9's closing paragraph require this as a *test*, not an assumption: *"ORM compute semantics
   are not a guarantee this module may inherit silently across a major version."* — **T26**.
2. **`group_almond_loyalty_rate_steward`**, in the `res.groups.privilege` idiom the repo already uses
   (`integrations/almond_branch/security/almond_branch_security.xml`). **Write** on
   `almond_earn_rate` and the three provenance fields is steward-only, enforced by
   `ir.model.access.csv` plus a record rule; `point_of_sale.group_pos_user` and
   `group_almond_loyalty_manager` get write on neither. **Read on `almond_earn_rate` is open** —
   see the next point, it has to be.
3. **The rate field carries no `groups=` restriction and no `readonly=True`.** Both were in an
   earlier draft and both are wrong: `readonly=True` blocks the steward's own form write, and a
   `groups=`-restricted field reaching `res.partner._load_pos_data_fields` is **[STOCK — must
   probe]** behaviour nobody should stake the till on (**V16**). The control is the ACL plus the
   constrains, which are testable; the field attribute is not the control.
4. **`models/pos_data_loading.py` is the only file that may override POS loading.**
   `almond_earn_rate` reaches the client through `res.partner._load_pos_data_fields`
   **[STOCK — verified in doc §8]**, which doc §8 names *the highest-churn surface in Odoo*
   (`_loader_params_res_partner` ≤17 → renamed in the 18 POS rewrite).

**`almond_loyalty_blocked` refuses redemption under every arm of the authorization union, including
`manager_override`.** It moves the two frozen accounts' control (§E.1 step 5) from a laminated card
taped to the tills into the type system — **T32**. And **the physical cards stay at the tills for 30
days after cutover**: a control that exists only inside the system you have just cut over to is a
control you have not tested.

**Rate changes are dated, because deferred issuance needs to read them.** Every write to
`almond_earn_rate` also writes one `almond.loyalty.rate.change` row
`(partner_id, rate_from, rate_to, effective_at, source, ref)`. `mail.tracking.value` carries the
same history but is not a queryable contract; §D.4's deferred claims read this table.

## A.5 The stock rule pays zero

```
loyalty.rule  reward_point_mode='money'  reward_point_amount=0  minimum_amount=0  mode='auto'
```

The custom evaluator supplies the entire number: `points = earn_base × partner.almond_earn_rate`,
clamped (§A.6, §B.5).

**Why 0 and not 1 and not the base rate of 4.** `res.partner._load_pos_data_fields` is doc §8's
highest-churn surface, blast radius *"everyone earns the base rate silently."* At
`reward_point_amount = 4`, a member on 8 or 10 quietly earns half and **nobody notices for a month**
— a plausible wrong number. At `0`, a failed patch pays **nothing**, the customer complains at the
counter within the hour, and the daily issuance report reads zero. **Fail loud beats fail
plausible.**

**Two distinct alerts, because one alert cannot name two causes.** A missing partner-loader patch
and a missing sync-side issuer (§B.3) both produce zero issuance, so a single "zero issuance today"
alarm points at the wrong file. Ship both:

- `hooks.py` boot assertion: `almond_earn_rate` is present in the POS partner load field set →
  raises at install, naming the file.
- `cron_almond_reconcile` job 7: zero *issued* rows on a trading day, or issuance below 20% of the
  trailing 7-day median → immediate alert naming `services/earn.py` and the sync issuer.

**V11 — does `loyalty.rule` accept `reward_point_amount = 0` without a validation error?** If it
refuses, the fallback is `0.01` (still loud: issuance reads 1/400th of expected) and the alert
threshold moves. It is **not** 4.

## A.6 The earn base, and the ceiling question it exposes

**[CUSTOM] and mandatory, but the rule is conditional on mechanism** — an unconditional
"subtract the tendered amount" double-nets:

| Mechanism | Does the tendered amount already leave the base? | Rule |
|---|---|---|
| Stock reward line (points redemption) | **yes, free** — the line reduces `amount_total`, and `reward_point_mode='money'` awards on `amount_total` | assert it; do **not** re-subtract |
| Custom `pos.payment.method` (wallet) | **no** — a `pos.payment` never touches `amount_total` | subtract it |

```
almond_earn_base = amount_total
                 − Σ(pos.payment.amount WHERE payment_method.use_payment_terminal = 'almond_wallet')
```

Both cases are in the golden-vector table and **the test fails if the base is computed the other
way** (T25): a 20 JOD ticket paid entirely from the wallet earns on **0**; 15 cash + 5 wallet earns
on **15**; a 20 JOD ticket with a 5 JOD points reward line earns on **15** with no explicit
subtraction.

**What this protects.** Under a real tender, a customer paying entirely from the wallet would
otherwise earn full points on the full ticket: redeeming 1,000 points (10 JOD) regenerates 40–100
points — a **4–10% perpetual rebate on redeemed value** that nothing in the design accounts for.

### A.6.1 The 0.45 JOD ceiling is a mean, not a per-transaction cap — and this goes back to the committee

The committee's governing ceiling is **≤0.45 JOD of accrual per identified transaction**, against a
measured **0.404**. An earlier draft asserted that as a per-row invariant in T25. It is
arithmetically impossible while the rates are frozen:

```
50.00 JOD invoice × 10 points/JOD = 500 points = 5.00 JOD of accrual  →  11× the "ceiling"
20.30 JOD invoice × 10 points/JOD = 203 points = 2.03 JOD             →   4.5×
```

To make a per-row assertion green, `almond_per_invoice_point_cap` must be ~45 points, which cuts a
Platinum member's earn by 91% — a direct breach of committee decision §5, *"no current member's rate
is touched."* An implementer facing a red test and a frozen rate has two exits, and the cheap one is
deleting the ceiling assertion.

**Resolution, and it is a question for the owner (O-4), not a test outcome:**

- **0.404 is a fleet mean** over identified transactions. **T25 asserts the traffic-weighted mean
  across the vector table reproduces 0.404 ± 0.005** and nothing per-row.
- The **budget** is enforced monthly in JOD (§C.9), not per ticket.
- A **separate, absolute per-invoice point cap** exists as a *fraud* control, not a budget control.
  It must bind on **no legitimate transaction**: the proposal is
  `almond_loyalty.per_invoice_point_cap = 1000` (10 JOD of accrual, ~2× the largest legitimate
  ticket at rate 10), **signed by a human**, with its JOD value printed in the test's failure
  message. Unset until signed; the module boots with it unset and logs that it is unset.

### A.6.2 Four repo promotions that are not live — a product decision, stated

`packages/shared/src/loyalty/earn.ts:87-128` computes, in order: `walletMult`
(`WALLET_EARN_MULTIPLIER` 1.5), `bonusMult` (`BONUS_BEAN_DAY {enabled:true, multiplier:2,
weekdays:[2]}`), `tierBonus`, `weekdayBonus` (`WEEKDAY_EARN_BONUS` Friday +50%), `comboBonus`
(`COMBO_BONUS_POINTS: 50`). The single-rate Odoo formula in §A.5 does not carry any of them.

**Partial rejection of the review's framing.** The review called this "silently deleting three
promotions that are live, which the committee forbade." The committee forbade *stopping a
promotion*. These four **have never run**:
`docs/LOYALTY-WAFII-LIVE-AUDIT.ar.md` §8 and `docs/LOYALTY-MEASURED-TRUTH.ar.md` §2 both record
**zero rows out of 171,291** for the wallet multiplier, the bonus day and the Friday bonus; the
combo reward was made *the* combo five commits ago in a repo whose app `docs/LOYALTY-DECISIONS.ar.md`
ق‑11 records is **not in production**. No member has ever received one. Retiring them does not
breach committee decision §5.

**The review's remedy is adopted in full anyway,** because the alternative is a test harness deciding
an offer: the four numbers (wallet ×1.5, Tuesday ×2, Friday +50%, combo 50 pts) go to the owner as
**O-3** *before* the T7d fixture is written. If they stay, the fixture needs `weekday`, `bonusDay`
and `comboPairs` columns and both Odoo evaluators need those inputs — including an Amman-clock
weekday in Python and in POS JavaScript, where `packages/shared/src/lib/ammanWeekday.ts` has no twin
today. If they go, §I records it with the per-member cost, and the 0.404 baseline the budget is
measured against moves.

**`docs/ODOO-INTEGRATION.md` §2's `WALLET_EARN_MULTIPLIER` (+50% for paying from the wallet) is the
one I recommend retiring outright.** It pays twice for one JOD — once at top-up via the reload bonus,
once at spend — on money the customer already handed over; under the stock reward-line path it is
plausibly *backwards* (V6 measures which), and under the tender it is §A.6's rebate.

## A.7 Two new models: the grant, and the write-ahead op

These are the **only** models this round adds. Together they replace a spend-side ledger (stock has
none) and `almond.loyalty.point.lot` (doc §4.8 — not built this round, §A.9).

### A.7.1 `almond.loyalty.grant` — the authorization, made durable and verifiable inside Odoo

An earlier draft minted and consumed grants entirely in BFF process memory
(`bff/src/authz/grant.ts`) and relied on a Postgres `CHECK` that `authz_grant_id` was a non-empty
string. That constraint is a **string-presence test, not an authorization test**, and it proves
nothing it claimed to prove:

> A cashier opens devtools on the POS session and calls
> `rpc("/almond_loyalty/wallet/charge", {partner_id: <any>, amount: 50000, authz_grant_id: "x", …})`.
> `auth='user'` passes. `_debit_needs_auth` passes (`auth_kind` is a Char the caller supplies).
> `_debit_names_grant` passes — `'x'` is non-empty. `UNIQUE(op_key)` passes. The debit applies, and
> the forensic field records the string `'x'`. Yield: any member's full wallet, no customer present.

**The grant becomes a row that the debiting writer can verify:**

```python
class AlmondLoyaltyGrant(models.Model):
    _name = 'almond.loyalty.grant'
    _description = 'One authorization by the account holder for ONE movement'

    grant_id    = fields.Char(required=True, index=True)      # opaque, BFF-minted
    token_jti   = fields.Char(index=True)                     # the POS capability token's jti
    partner_id  = fields.Many2one('res.partner', required=True, index=True, ondelete='restrict')
    scope       = fields.Selection([('points','Points'),('wallet','Wallet'),
                                    ('subscription','Subscription')], required=True)
    max_points  = fields.Float()
    max_fils    = fields.Integer()
    factor      = fields.Selection([('app_token','App capability token'),
                                    ('otp','OTP to the registered number'),
                                    ('manager_override','Manager override')], required=True)
    channel     = fields.Selection([('app','App'),('pad','Pad'),('pos','POS')], required=True)
    actor_login = fields.Char()          # cashier / manager, or the member's own id
    pos_config_id   = fields.Many2one('pos.config', index=True)   # the till it was minted for
    pad_session_id  = fields.Char(index=True)
    expires_at  = fields.Datetime(required=True, index=True)
    consumed_op_id = fields.Many2one('almond.loyalty.op', index=True, ondelete='restrict')

    _uniq_grant = models.Constraint('UNIQUE(grant_id)',  'Grant already exists.')
    _uniq_jti   = models.Constraint('UNIQUE(token_jti)', 'This capability token has already been used.')
    _scope_ceiling = models.Constraint(
        "CHECK ((scope <> 'points' OR max_points IS NOT NULL) AND (scope <> 'wallet' OR max_fils IS NOT NULL))",
        'A grant must carry the ceiling for its own scope.')
```

Four things follow, and each closes a specific hole:

1. **`UNIQUE(token_jti)` is where single-use lives.** `bff/src/pos/token.ts:16`'s in-process
   `usedJti` `Set` is invisible to a second instance and lost on restart; behind a load balancer the
   same QR presented at two tills verifies on both, mints two grants with two `grantId`s, and a
   `UNIQUE(authz_grant_id, …)` index never sees the collision. Keying the durable guarantee on the
   **grant** id was self-refuting. Keying it on the **token** id is not. `usedJti` may then be
   demoted to a TTL cache — **and not one hour before this row exists.**
2. **The grant row is written by the BFF, through the same seam, BEFORE the grant handle is returned
   to any caller.** So an Odoo-side writer can read it.
3. **The wallet-charge and redeem-confirm controllers take no `partner_id` and no free-text grant
   id.** They take `{grant_token, op_key, amount}`; `grant_token` is `grant_id` plus an HMAC over
   `(grant_id, partner_id, scope, max_*, expires_at)` keyed from `ir.config_parameter`
   `almond_loyalty.grant_hmac_key` (server-side only, never in the browser — the idiom
   `pos_meps_apex/models/pos_payment_method.py:20` already uses for the MEPS SecureKey). The partner
   comes **from the row**, never from the request.
4. **One grant, one movement.** `consumed_op_id` plus the op-side `UNIQUE(authz_grant_id)` below.

**Mixed tender mints two grants from one factor.** An 8 JOD ticket settled as 3 JOD of points plus
5 JOD of wallet is an ordinary counter event; `SpendAuthorization.scope` is a single value, so one
grant cannot express it and reusing one across two legs would enforce one ceiling against two
assets. `SettleOrderInput` therefore carries `spendAuths: SpendAuthorization[]`, each scoped, each
capped, each with its own `grantId` — **T16** asserts no two entries share one.

### A.7.2 `almond.loyalty.op` — the write-ahead intent record

```python
class AlmondLoyaltyOp(models.Model):
    _name = 'almond.loyalty.op'
    _description = 'One authorized, idempotent movement of points or stored value'

    op_key       = fields.Char(required=True, index=True)          # §A.8 namespace
    program_id   = fields.Many2one('loyalty.program', required=True, index=True)
    card_id      = fields.Many2one('loyalty.card', index=True, ondelete='restrict')
    partner_id   = fields.Many2one(related='card_id.partner_id', store=True, index=True)
    direction    = fields.Selection([('credit','Credit'),('debit','Debit')], required=True)
    # SIGN CONVENTION, stated once and never re-derived:
    #   `amount` is ALWAYS POSITIVE. `direction` carries the sign. There are no negative ops.
    amount          = fields.Float(required=True)     # points, or JOD on the wallet programme
    declared_amount = fields.Float()                  # what the source claimed; differs only when quarantined
    balance_after   = fields.Float()                  # what a replay returns

    state = fields.Selection([('staged','Staged'),          # migration only; the reaper never touches it
                              ('reserved','Reserved'),      # debit held against the available balance, sale not yet validated
                              ('pending','Pending'),         # intent written, outcome unknown
                              ('applied','Applied'),
                              ('failed','Failed'),
                              ('quarantined','Quarantined'),
                              ('reversed','Reversed')],
                             required=True, default='pending', index=True)

    source = fields.Selection([('earn','Earn'),('redeem','Redeem'),('topup','Top-up'),
                               ('topup_bonus','Top-up bonus'),('wallet_charge','Wallet charge'),
                               ('migration','Migration'),('reversal','Reversal'),
                               ('correction','Correction'),('compensate','Compensation')],
                              required=True, index=True)
    auth_kind = fields.Selection([('app_token','App capability token'),
                                  ('otp','OTP to registered number'),
                                  ('manager_override','Manager override + reason'),
                                  ('reversal','Void / refund by a named staff user'),
                                  ('correction','Correction by a named staff user'),
                                  ('system','System')], required=True)

    grant_id_ref = fields.Many2one('almond.loyalty.grant', index=True, ondelete='restrict')
    auth_user_id = fields.Many2one('res.users', index=True)   # override, reversal, correction
    actor_login  = fields.Char()
    reverses_op_id = fields.Many2one('almond.loyalty.op', index=True, ondelete='restrict')

    pos_order_uuid     = fields.Char(index=True)
    pos_order_line_id  = fields.Integer(index=True)
    refund_order_uuid  = fields.Char(index=True)
    pad_session_id     = fields.Char(index=True)
    lease_expires_at   = fields.Datetime(index=True)

    # migration bookkeeping — read by §E.1's gates and by its rollback
    batch_id     = fields.Char(index=True)
    wafii_key    = fields.Char(index=True)
    as_of        = fields.Date()
    note         = fields.Char()

    _uniq_op = models.Constraint('UNIQUE(op_key)', 'This operation has already been recorded.')

    # §0's sentence in Postgres — scoped to ORIGINATED SPENDS, not to direction.
    # An earn reversal and a post-migration correction are debits that no account
    # holder authorizes; scoping on `direction` alone made both unrecordable and
    # the only escape was a fabricated grant, which destroys the forensic field.
    _spend_needs_holder = models.Constraint(
        "CHECK (source NOT IN ('redeem','wallet_charge') "
        "       OR (auth_kind NOT IN ('system','reversal','correction') AND grant_id_ref IS NOT NULL))",
        'No spend may be recorded without an authorization grant from the account holder.')
    _staff_debit_names_human = models.Constraint(
        "CHECK (auth_kind NOT IN ('reversal','correction') "
        "       OR (auth_user_id IS NOT NULL AND grant_id_ref IS NULL))",
        'A staff-authorized debit names a human approver and never a grant.')
    _reversal_names_original = models.Constraint(
        "CHECK (source <> 'reversal' OR reverses_op_id IS NOT NULL)",
        'A reversal must name the op it reverses.')
    _grant_once = models.Constraint('UNIQUE(grant_id_ref)',
        'This authorization grant has already been consumed.')
    _earn_names_order = models.Constraint(
        "CHECK (source <> 'earn' OR pos_order_uuid IS NOT NULL OR op_key LIKE 'app:%')",
        'An earn op must name the order it was issued for.')
```

**`_grant_once` is `UNIQUE(grant_id_ref)` with no `source` in the key.** Scoping it
`(grant_id_ref, source)` let one grant lawfully back one op **per source value** — up to nine given
the enum — so a customer who authorized a 5 JOD points redemption could have a `redeem` op *and* a
`wallet_charge` op written against the same proof. One grant authorizes one movement, full stop.
A service-level scope check in TypeScript is not a substitute: the till writes ops directly and never
runs it, which is exactly why these constraints were written to be independent of application logic.

**Why a new table rather than a column on stock `loyalty.history`.** Three reasons, the third fatal
to the alternative:

1. `loyalty.history` is written by stock code paths the module does not own; a `UNIQUE` on a vendor
   table is a foot-gun even when the probe comes back clean.
2. **V10** (are history rows deleted and recreated on order edit, refund or session close?) is
   load-bearing and unanswerable here. If yes, the index either blocks a legitimate stock operation
   at a till or the key silently disappears from the row it was guarding.
3. **A ledger row cannot represent intent.** A `pending` row in a ledger is a balance that has not
   moved. Without a separate table there is nowhere to record *"I am about to move money"*, and a
   crash mid-call leaves no trace on the Odoo side at all.

### A.7.3 The write protocol — two transactions, a card lock, and a reservation

**Three separate corrections are folded in here. Read all three before implementing.**

**(a) Two transactions, on two cursors.** A single transaction makes the whole write-ahead record
imaginary: a `pending` row inside an uncommitted transaction is invisible to every other session, so
the "`pending` with a live lease → 409" and "dead lease → take it over" branches can never fire from
a concurrent writer — it blocks on the row lock and then takes the unique violation. An implementer
would build the lease reaper and never understand why it never fires.

**TXN 1 runs on its own `registry.cursor()`, not on the request cursor.** A mid-request
`env.cr.commit()` in an Odoo controller commits everything the request has already written and
defeats the ORM's rollback-on-exception. This is not optional and it is not a style point.

**(b) The lock is on the card, not on the op.** `SELECT … FROM almond_loyalty_op WHERE op_key = %s
FOR UPDATE` locks the *op* row. Two debits with **different** op_keys against the **same** card take
two different locks, read the same balance, and both write:

> Member has 50.00 JOD. Two devices, two distinct `Idempotency-Key`s → two distinct `op_key`s → two
> distinct grants. Neither `UNIQUE(op_key)` nor the BFF's `Map` sees a collision. Both read
> `points = 50.0`; Odoo's ORM write is read-modify-write in Python, so both issue
> `UPDATE loyalty_card SET points = 20.0`. Committed balance 20.00; value released 60.00. Free
> goods: 30.00 JOD, repeatable at N-way concurrency. `UNIQUE(op_key)` serialises **replays of one
> key**; it does not serialise **distinct operations against one balance.**

**(c) A till-side debit is reserved, then confirmed.** A response lost after TXN 2 commits leaves the
customer's money gone with no `pos.payment`, no order reference, and no detector: the op and the card
agree, so the balance reconciliation passes and the customer finds out days later in the app. So the
debit is two-phase **in the direction where auto-completion is safe** — releasing an unconsumed hold
is *additive*, and therefore exempt from §D.7's "never auto-complete a debit" rule, which forbids
auto-completion only in the losing direction.

```sql
-- TXN 1  (its own registry.cursor(); committed before the request cursor writes anything)
INSERT INTO almond_loyalty_op (op_key, direction, source, auth_kind, grant_id_ref,
                               state, lease_expires_at, declared_amount, …)
VALUES (…, 'pending', now() + interval '60 seconds', …);
COMMIT;                        -- ← the intent is now VISIBLE to every other session

-- TXN 2  (the request cursor; one commit)
SELECT id, points FROM loyalty_card WHERE id = %s FOR UPDATE;          -- ← THE LOCK IS HERE
--  sufficiency check runs INSIDE this lock, against
--  available = points − Σ(other ops on this card in state='reserved' AND direction='debit')
UPDATE loyalty_card SET points = %s WHERE id = %s;
INSERT INTO loyalty_history (…);
--  till wallet tender: state='reserved' with a fresh lease, confirmed at order validation
--  everything else:    state='applied'
UPDATE almond_loyalty_op SET state=%s, balance_after=%s, card_id=%s, lease_expires_at=%s;
COMMIT;
```

On a unique violation in TXN 1, match `diag.constraint_name` against `almond_loyalty_op__uniq_op`
— **by name, never a bare `except UniqueViolation`** (doc §7.4's scar: a broad catch turned a
collision into a silently unpaid customer) — **and re-read the row** before deciding:

| Existing row | Response |
|---|---|
| `applied` | return `balance_after` with `already: true` — a replay |
| `reserved`, live lease | `409 request_in_progress` |
| `reserved`, lease expired | **release** the reservation (additive), then re-drive |
| `pending`, live lease | `409 request_in_progress` |
| `pending`, dead lease, `direction='credit'` | `SELECT … FOR UPDATE`, take it over, re-drive |
| `pending`, dead lease, `direction='debit'` | **`state='failed'`, alert, never auto-complete** — §D.7 |
| `staged` | **not a collision to resolve here** — a migration row; abort and alert |
| `failed` | reset to `pending` and retry (credit) / human (debit) |

**Isolation level is not assumed.** **V17** reports the instance's `default_transaction_isolation`;
nothing in this design may depend on `SERIALIZABLE`, and the `FOR UPDATE` above is correct under
`READ COMMITTED`, which is what Odoo normally runs.

**Honest residual, stated because the alternative is a mechanism described as doing something it
cannot do:** between TXN 1's commit and TXN 2's commit the intent exists and the balance has not
moved. **That window is the point.** It is exactly the "started, outcome unknown" state that
`WriteOutcome.indeterminate` (§B.4) represents and that `probeWrite` resolves.

### A.7.4 Closing the ledger, or admitting it is not closed

`cron_almond_reconcile` job 5 asserts `loyalty.card.points == Σ(that card's applied ops)`. That
equality is **false from day one** unless the op table is the only permitted writer of
`loyalty.card.points`, and stock has at least four other writers: the reward-claim path, the ewallet
top-up rule firing when the top-up product is sold, any user with model-level write on
`loyalty.card` (A6), and the stock reversal on a void if V15(a) comes back positive. An assertion
that raises on essentially every card that has transacted gets muted, and then the design has no
balance detector at all — which matters, because job 5 is the only thing that could retroactively
catch the concurrency and snapshot-inflation attacks.

**[DECISION] Close the ledger.** `models/loyalty_card.py`:

```python
def write(self, vals):
    if 'points' in vals and not self.env.context.get('almond_op_id'):
        raise UserError(_("loyalty.card.points may only be moved through almond.loyalty.op. "
                          "See docs/LOYALTY-ODOO-ARCHITECTURE.md §A.7.4."))
    return super().write(vals)
```

`services/op.py` is the only module that sets `almond_op_id`. §A.3.3's redeem confirm and §B.3's
sync-side issuer already route the two POS spend/earn paths through it; the sync override
additionally wraps stock's ewallet top-up processing so the credit gets its op. This is a real
commitment: **any stock path that moves points and is not wrapped will raise at a till**, which is
loud and fixable, rather than diverging silently.

**V18 decides whether closure is achievable** — it enumerates every stock code path that writes
`loyalty.card.points` on this instance. **If closure is rejected on that evidence, job 5 is replaced,
not weakened:** a bounded reconciliation of `Σ(applied ops)` against `Σ(loyalty.history)` per
programme, with a named owner and a written expected-divergence class, and a README paragraph saying
why the stronger assertion was not available. What does **not** ship is an assertion known to be
false.

## A.8 One `op_key` namespace, both writers, unique per **movement**

One global `UNIQUE(op_key)` with a deterministic `<leg>` suffix. A composite key would require the
caller to remember which programme it is writing to before the index can protect it; the leg suffix
derives every movement's key from the one key the client already sent, so a retry from **any**
process — the BFF, the till, or a second BFF instance after a deploy — reproduces the same string
with no shared state.

```
app:<Idempotency-Key>:wallet            app-originated wallet debit
app:<Idempotency-Key>:points            app-originated points spend
app:<Idempotency-Key>:earn              app-originated earn
app:<Idempotency-Key>:order             the order record
app:<Idempotency-Key>:topup             wallet credit
app:<Idempotency-Key>:topup_bonus       the reload bonus leg (§B.7)
app:<Idempotency-Key>:compensate        a compensating credit
pos:<pos.order.uuid>:earn               earn from a till order
pos:<pos.order.uuid>:line<line_id>      ONE reward line — points redemption or wallet leg
pos:<pos.order.uuid>:wallet             the wallet tender on that order
pad:<pad_session_id>:<boot_id>:<seq>    pad-authorized spend
refund:<refund_order_uuid>:<leg>        the reversal of a named leg
correction:<ticket_ref>:<partner_id>    a post-cutover balance correction
migration:<batch_id>:<wafii_key>        opening balance
gift:<reserved>                         RESERVED, not used this round — §E.2
```

**Three keys changed shape from the obvious form, each because the obvious form is not unique per
movement:**

- **`pos:<uuid>:r<reward_id>` → `pos:<uuid>:line<pos_order_line_id>`.** Stock POS permits claiming
  the same reward twice on one ticket, and a 100-point / 1-JOD rung is the shape most likely to be
  claimed twice. Under the reward-id form the second claim collides, is read back as `applied`, and
  returns the **first** claim's `balance_after` with `already: true` — the till renders «سبق خصمه»,
  the cashier believes the discount was already taken, and the customer keeps the discount without
  losing the points.
- **`refund:<original_uuid>:<leg>` → `refund:<refund_order_uuid>:<leg>`.** The original form allows
  an order to be reversed exactly once, ever. A 12 JOD wallet-paid order refunded 4 JOD, then 4 JOD
  again ten minutes later, computes the same key the second time, matches the constraint, reads back
  `applied` and returns the first refund's balance. The cashier sees success and hands over the
  goods; nothing moved. Odoo POS creates a refund order with its own `uuid`, so the key is available
  and is itself replay-safe.
- **`pad:<session>:<seq>` → `pad:<session>:<boot_id>:<seq>`.** A pad restart that resets `seq`
  otherwise reproduces a key.

Two service-level bounds ride with them: **Σ|reversal amounts| per `(pos_order_uuid, leg)` may never
exceed the original applied amount** (a check inside the same transaction as the reversal, plus a
nightly assertion), and **`invoice_number` is never a key** — the brief proves it: 40.2% single
digit, 1,384 rows literally `.`, 46% colliding within (store, date).

The `app:` form is built by **`opKey(req, leg)` exported from `bff/src/plugins/idempotency.ts`**, so
the string the BFF already computes *is* the Odoo key by construction rather than by convention.
**T17 clause 3** forbids a literal, a template or `randomUUID()` in the key position at any call
site: a server-minted key makes a retry a new request, which is the failure mode wearing the fix's
clothes.

## A.9 The custom surface, totalled — and what is cancelled by name

**Built:**

| | |
|---|---|
| **Models (NEW)** | `almond.loyalty.grant`, `almond.loyalty.op`, `almond.loyalty.rate.change` |
| **Models (INHERIT)** | `res.partner` (8 fields + ACL + constrains), `pos.order` (6 snapshot fields + the sync override), `pos.order.line` (the reward-line guard), `loyalty.card` (`write` closure + `expiration_date` guard), `pos.payment.method` (`selection_add`) |
| **Python** | `models/pos_data_loading.py`, `models/pos_order.py` (**sync issuer + reward-line guard**), `models/loyalty_card.py`, `services/earn.py`, `services/op.py`, `services/grant.py`, `services/source_key.py`, `controllers/wallet_charge.py`, `controllers/redeem_confirm.py`, `controllers/settle.py`, `services/settle.py`, `hooks.py`, `wizards/almond_loyalty_repair.py`, the migration loader |
| **JavaScript** | `static/src/app/payment_almond_wallet.js`, `static/src/app/redeem_confirm.js`, `static/src/app/earn_formula.js`, `static/src/app/almond_pad_status.js` (the employee screen, §C.3), `static/src/app/patches.js` (the list of every patched stock symbol, per doc §8) |
| **Crons** | **one** — `cron_almond_reconcile` (§D.7, seven jobs). Plus `cron_expire_points`, shipped **present and permanently disabled** (§A.9.1) |

> **An earlier draft claimed "all POS overrides in one file, so an upgrade breaks in one place."
> That is no longer true and must not be repeated.** There are now **four** patched POS surfaces —
> the partner loader, the order sync/create path, the reward-line guard, and the payment interface —
> and every one of them belongs in doc §8's upgrade checklist and in `static/src/app/patches.js`.
> This changes the upgrade estimate. Saying so is cheaper than discovering it at the next major.

**Cancelled from `docs/LOYALTY-ODOO-MODULE.md` §3, by name:** `almond.loyalty.tier` (§4.1),
`almond.loyalty.timewindow` (§4.4), `almond.loyalty.window.bucket` (§5, ~360 lines),
`almond.loyalty.availability` (§4.6), `almond.loyalty.reprice.log` (§4.5),
`almond.loyalty.birthday.grant` (§4.10), `almond.loyalty.point.lot` (§4.8),
`product_template.py`'s `almond_86_*`, and **seven of the eight crons** (§4.12).

The committee cancelled the re-tiering and the threshold redesign; those models exist to serve
tiers, gated rewards and repricing that are no longer being built. **The four values 4/6/8/10 live
on `res.partner.almond_earn_rate` as data, not as a tier model.** Silence about doc §3's model list
is the most expensive omission available here: an implementer reading this spec alongside the repo's
own would build the ~360-line rolling-window bucket engine for a ladder that no longer exists.

**Kept from §4.8 despite dropping the lot ledger:** the `loyalty.card.expiration_date`
`@api.constrains` that **refuses** a non-null value. Four lines, and the trap is armed today for
anyone with write access to a `loyalty.card` form — stock zeroes the whole card
**[STOCK — verified in doc §8]**.

### A.9.1 Point expiry ships disabled, permanently, and the README says why

`docs/LOYALTY-ODOO-MODULE.md` §4.8 and §10 Phase 3 specify FIFO lots, an expiry cron, T‑30/T‑7
notices and a dry-run cycle in detail. **A competent implementer following the repo's own spec will
build it.** Shipping it is a silent devaluation of the entire clean customer-held balance plus a
breach of the term the business is about to publish — `docs/LOYALTY-DECISIONS.ar.md` ق‑11 requires
the published Arabic terms to carry *"بندٌ صريح: النقاط لا تنتهي صلاحيّتها"*, and ق‑12 records
that introducing expiry harvests a nominal figure worth 138–4,285 JOD in expectation while destroying
the only evidence of how the balances arose.

Dropping the lot ledger avoids it, but that is not enough: **the module README must state why the
repo's own document will lead you there and that you must not follow it**, and `cron_expire_points`
ships present-and-disabled with that reason in its own `description` field, so its absence cannot be
read as an oversight to be corrected.

---

# B. The revised `Backend` interface

## B.1 The primitive types

```ts
// bff/src/backend/types.ts

/** ── Authorization ────────────────────────────────────────────────────────
 *  Unforgeable proof that the ACCOUNT HOLDER authorized ONE operation.
 *  AUTHZ_BRAND is declared here and exported NOWHERE, so the only module that
 *  can produce a value of this type is bff/src/authz/grant.ts, which does so
 *  behind a verified factor AND after writing the almond.loyalty.grant row
 *  (§A.7.1) that the Odoo-side writers verify against. A structurally-typed
 *  union does NOT do this: any route can write
 *  { method: 'app_session', memberId: someOtherId } and every signature-shaped
 *  test still passes. Enforced by T15/T16. */
declare const AUTHZ_BRAND: unique symbol;

export type AuthzFactor = 'app_token' | 'otp' | 'manager_override';

export interface SpendAuthorization {
  readonly [AUTHZ_BRAND]: true;
  /** The member the factor PROVED. Callers may not supply a member id
   *  separately — the spend methods have no memberId parameter at all. */
  readonly memberId: string;
  readonly scope: 'points' | 'wallet' | 'subscription';
  readonly maxPoints?: number;      // ceiling; the call may spend less, never more
  readonly maxFils?: number;
  readonly factor: AuthzFactor;
  readonly grantId: string;         // single-use; UNIQUE(grant_id_ref) on the op row
  readonly expiresAt: number;       // epoch ms; 120 s from mint
  readonly channel: 'app' | 'pad' | 'pos';
  readonly actor: string;           // cashier login, or the member's own id
  readonly posConfigId?: string;    // the till the grant was minted FOR (§C.5)
  readonly padSessionId?: string;
  readonly posOrderUuid?: string;
}

/** ── Staff authorization ──────────────────────────────────────────────────
 *  A void, a refund and a post-cutover correction are SUBTRACTIONS that no
 *  account holder authorizes. They are authorized by a NAMED STAFF USER, and
 *  that is a different type — not a SpendAuthorization with a fake grant id,
 *  which would make authz_grant_id mean two different things and destroy the
 *  one field §B.5 relies on to answer "did anyone prove they were the holder?".
 *  STAFF_BRAND lives only in bff/src/authz/staff.ts. */
declare const STAFF_BRAND: unique symbol;

export interface StaffAuthorization {
  readonly [STAFF_BRAND]: true;
  readonly userLogin: string;       // Odoo res.users login, relayed by the till
  readonly posConfigId: string;
  readonly branchId: string;
  readonly role: 'cashier' | 'manager';
  readonly reasonCode: ReversalReason;   // from a CLOSED list
  readonly secondApproverLogin?: string; // required for manager_override (§C.5.1)
  readonly grantedAt: number;
}

/** ── OTP proof ────────────────────────────────────────────────────────────
 *  Branded for exactly the reason SpendAuthorization is. An unbranded
 *  { phoneE164, nonce, verifiedAt } is constructible by any module, and
 *  bff/src/routes/auth.ts:23 mints a member JWT from whatever member the enrol
 *  call returns — so a hand-built proof for a known phone number is a full
 *  account takeover. OTP_BRAND lives only in bff/src/auth/otp.ts and verifyOtp
 *  is its only producer. T16 clause 2 asserts the file count. */
declare const OTP_BRAND: unique symbol;
export interface OtpProof {
  readonly [OTP_BRAND]: true;
  readonly phoneE164: string;
  readonly nonce: string;
  readonly verifiedAt: number;
}

/** ── Idempotency ──────────────────────────────────────────────────────────
 *  Every mutating call carries one. `opKey` CROSSES THE SEAM: the Odoo adapter
 *  writes it as almond.loyalty.op.op_key under a global UNIQUE index, so Odoo
 *  — not the BFF's in-process Map — is what is idempotent. */
export type OpKey = string & { readonly __opkey: unique symbol };

export interface WriteContext {
  readonly opKey: OpKey;            // built ONLY by opKey(req, leg) — T17 clause 3
  readonly requestId: string;
  readonly actor: string;
  readonly channel: 'app' | 'pad' | 'pos' | 'cron' | 'migration';
}

/** ── Freshness ────────────────────────────────────────────────────────────
 *  Every read is dated. `stale` is the till's and the app's LICENCE to print
 *  "الرصيد حتى ١٤:٣٢" and their PROHIBITION on printing a confident number
 *  (doc §7.2: "a stale balance shown confidently is how a customer is told they
 *  can afford a reward they cannot"). */
export interface Fresh<T> {
  readonly value: T;
  readonly asOf: string;                                    // ISO, Odoo's clock at read
  readonly stale: boolean;
  readonly source: 'odoo' | 'branch_cache' | 'deferred_queue';
}

/** Money and points never share a number. Two fields, always. §A.1.
 *  `availableFils` subtracts live reservations (§A.7.3(c)); `walletFils` does not. */
export interface Balances {
  points: number; availablePoints: number;
  walletFils: number; availableFils: number;
}

/** ── Write outcome ────────────────────────────────────────────────────────
 *  `already` is rendered DIFFERENTLY at the till — «سبق خصمه — لا تُعِد» versus
 *  «تمّ الخصم». An idempotent backend still produces a double-press if the
 *  cashier sees the same green tick twice and concludes the first press failed.
 *  `indeterminate` exists because the alternative is compensating a debit that
 *  may or may not have committed — a coin flip with the customer's money, which
 *  is what bff/src/routes/checkout.ts:82 does today. */
export type WriteOutcome<T> =
  | { status: 'applied';       result: T; already: false; asOf: string }
  | { status: 'replayed';      result: T; already: true;  asOf: string }
  | { status: 'indeterminate'; probeKey: OpKey };

export type Movement = WriteOutcome<Balances>;

export interface Funding {
  /** A SETTLED reference. `psp` means CAPTURED, not authorized. */
  kind: 'psp' | 'gift_card' | 'cash' | 'migration';
  provider?: string; captureId?: string;      // psp — captureId REQUIRED, T30
  code?: string;                              // gift_card
  posOrderUuid?: string;                      // cash
  batchId?: string;                           // migration
}

export interface Reason { ar: string; en: string; code: string }

export type ReversalReason =
  | 'wrong_item' | 'customer_cancelled' | 'till_error'
  | 'duplicate_order' | 'quality_complaint' | 'pending_reconciliation';

/** The wire shape Odoo returns for earn. NOT EarnBreakdown.
 *  packages/shared/src/loyalty/earn.ts:51-76's EarnBreakdown requires tierId,
 *  tierBonus, walletBonus and bonusDayBonus — four fields belonging to a design
 *  §A.9 cancels — so reusing it would force Odoo to FABRICATE them to satisfy
 *  a type. See §B.7 for what happens to EarnBreakdown and to the persisted
 *  OrderRecord.earn at cutover. */
export interface OdooEarnBreakdown {
  earnBase: number;          // §A.6, after the wallet tender is subtracted
  earnRateApplied: number;   // the snapshot, clamped (§B.5)
  rawPoints: number;
  perInvoiceCap: number | null;
  capApplied: boolean;
  points: number;            // the ONLY number that may be granted
  taxBasis: 'gross' | 'net'; // from ir.config_parameter almond_loyalty.earn_tax_basis
}
```

## B.2 The interface

```ts
export interface Backend {
  // ── identification: read-only, no create, no balances ───────────────────
  /** Exact match only. `null` for no match. NEVER creates. Never returns a
   *  balance or a partner id to the pad. `hintDigits` is the LAST TWO DIGITS
   *  THE CUSTOMER TYPED, not a name — §C.6.
   *  MULTI-MATCH FAILS CLOSED: two partners on one normalized phone throws
   *  conflict('phone_ambiguous'). It never picks one. §E.1 step 2 is what
   *  makes that condition rare; this is what makes it safe when it is not. */
  findByPhone(phoneE164: string): Promise<Fresh<{ id: string; hintDigits: string;
                                                  earnRate: number; blocked: boolean } | null>>;

  /** Creation is a separate, AUTHORIZED operation, and it is NOT reachable from
   *  the pad's identify route (T20). Throws conflict('already_enrolled') when the
   *  phone already belongs to a member — it must NEVER return an existing Member,
   *  because bff/src/routes/auth.ts:23 mints a JWT from whatever comes back. */
  enrolByPhone(phoneE164: string, otpProof: OtpProof,
               ctx: WriteContext, name?: string): Promise<Member>;

  // ── reads: every one dated ──────────────────────────────────────────────
  getSelf(id: string): Promise<Fresh<Member>>;                      // JWT sub === id
  getMemberForStaff(auth: SpendAuthorization): Promise<Fresh<Member>>;
  getBalances(id: string): Promise<Fresh<Balances>>;
  getHistory(id: string, cursor?: string): Promise<Fresh<HistoryEntry[]>>;
  getSubscription(id: string): Promise<Fresh<SubscriptionState>>;
  getWindowSpend(id: string): Promise<Fresh<number>>;
  getEarnRate(id: string): Promise<Fresh<number>>;                  // READ ONLY — T28

  // ── additive: idempotency required, authorization NOT ───────────────────
  /** MONEY. `funding` is a SETTLED reference and is NOT optional: today
   *  bff/src/routes/wallet.ts:21-22 credits toFils(amount) straight from a
   *  client-supplied body with no payment reference of any kind. That is a live
   *  free-money path — value CREATED with proof of nothing. T30. */
  creditWallet(id: string, fils: number, funding: Funding,
               ctx: WriteContext): Promise<Movement>;
  addPoints(id: string, delta: number, reason: Reason, earn: OdooEarnBreakdown,
            ctx: WriteContext): Promise<Movement>;

  // ── subtractive: authorization is the FIRST parameter, and there is no
  //    memberId parameter at all. The member is auth.memberId. ─────────────
  debitWallet(auth: SpendAuthorization, fils: number, reason: Reason,
              ctx: WriteContext): Promise<Movement>;
  spendPoints(auth: SpendAuthorization, points: number, reason: Reason,
              ctx: WriteContext): Promise<Movement>;
  redeemSubscriptionDrink(auth: SpendAuthorization,
                          ctx: WriteContext): Promise<WriteOutcome<SubscriptionState>>;
  activateSubscription(auth: SpendAuthorization,
                       ctx: WriteContext): Promise<WriteOutcome<SubscriptionState>>;

  // ── the order, as ONE Odoo transaction (replaces the saga) ──────────────
  settleOrder(input: SettleOrderInput, ctx: WriteContext): Promise<WriteOutcome<SettledOrder>>;

  /** Void / refund. The counter event no existing method covers, and it happens
   *  several times a day per branch. Takes a STAFF authorization — it subtracts
   *  points and credits money, and it must not sit outside the authorization
   *  model the way `reverseOrder(orderUuid, ctx)` did.
   *  `refundOrderUuid` is the REFUND order's own uuid, so a second partial
   *  refund gets its own key rather than replaying the first (§A.8).
   *  BLOCKED on V15. §D.6. */
  reverseOrder(auth: StaffAuthorization, originalOrderUuid: string,
               refundOrderUuid: string, legs: ReversalLeg[],
               ctx: WriteContext): Promise<WriteOutcome<Reversal>>;

  // ── the rolling window: bounded, not cumulative ─────────────────────────
  /** Records spend in a DATED bucket. There is no method that increments a
   *  lifetime total. bff/src/backend/memory.ts:78's `windowSpend += jod`
   *  independently reinvented the exact defect measured in Wafii. T23. */
  recordSpend(id: string, jod: number, occurredOn: string /* YYYY-MM-DD Amman */,
              ctx: WriteContext): Promise<void>;

  // ── probes ──────────────────────────────────────────────────────────────
  /** Was this op_key applied? The ONLY correct response to `indeterminate`.
   *
   *  TRI-STATE, and `not_applied` is a TRANSITION, not an observation: the
   *  implementation takes the op row FOR UPDATE and moves pending → failed in
   *  the SAME transaction before answering, so the answer is only ever given
   *  about a row that can no longer be applied. A two-valued
   *  `{applied: boolean}` reads a `pending` row as `applied:false`, and the
   *  reconciler then pays a compensating credit that RACES the in-flight
   *  commit: net zero movement on the card, an order that exists, a drink handed
   *  over, and a ledger that reconciles perfectly. That is the coin flip this
   *  design deleted, reintroduced by a return type. */
  probeWrite(probeKey: OpKey,
             ctx: WriteContext): Promise<{ status: 'applied' | 'not_applied' | 'unknown';
                                           result?: unknown; asOf: string }>;
}

export interface ReversalLeg { leg: 'wallet' | 'points' | 'earn'; amount: number }

export interface SettleOrderInput {
  memberId: string | null;              // null = walk-in; costs 0 ms (doc §6.1)
  branchId: string; type: OrderType; paymentMethod: PaymentMethodId;
  lines: CheckoutLine[];                // server re-prices; client totals never trusted
  /** ONE PER LEG. A ticket paid partly from points and partly from the wallet
   *  needs two grants, each scoped and each capped. T16 asserts no two entries
   *  share a grantId. */
  spendAuths?: SpendAuthorization[];
  posOrderUuid?: string;                // when the till is the origin
}
export interface SettledOrder {
  order: OrderRecord; earn: OdooEarnBreakdown; balances: Balances;
}
```

**Deleted from the interface:** `addSpend` (the cumulative-window defect); `findOrCreateByPhone`
(split — find-or-create at an unauthenticated public input is an account-creation oracle and a
`res.partner` spam gun); `createOrder` + `recordEarnBreakdown` as separate calls (folded into
`settleOrder`); `getMember` (split into `getSelf` / `getMemberForStaff`, because the second one is
the disclosure).

### B.2.1 The three checked-in method sets

`bff/test/lib/backend-sets.ts` carries three named sets, and **T15 asserts the partition is
exhaustive** — a new method in none of them fails the build until a human classifies it. Every other
seam test in every draft enumerated a hardcoded list, which passes forever on the day someone adds a
fifteenth method that carries no key and no auth.

| Set | Rule | Members |
|---|---|---|
| `READERS` | returns `Fresh<…>`; **no** `ctx: WriteContext` parameter | `findByPhone`, `getSelf`, `getMemberForStaff`, `getBalances`, `getHistory`, `getSubscription`, `getWindowSpend`, `getEarnRate` |
| `MUTATORS` | has `ctx: WriteContext`; subtractive members take `auth` **first** and have no `id` parameter | `enrolByPhone`, `creditWallet`, `addPoints`, `debitWallet`, `spendPoints`, `redeemSubscriptionDrink`, `activateSubscription`, `settleOrder`, `reverseOrder`, `recordSpend` |
| `PROBES` | has `ctx` (it writes) and returns a dated tri-state; never moves value in the losing direction | `probeWrite` |

## B.3 `settleOrder`, designed rather than named

`settleOrder` is the atom the whole failure-semantics argument rests on — it is what deletes the
compensation case — and naming it is not designing it. A team goes green on T15–T23 against `memory`
in week one and then discovers the Odoo half is the project.

**Odoo side: `services/settle.py::settle_order(payload)`, called from `controllers/settle.py`
(`type='json'`, `auth='user'`, `sudo()` on the records, shaped on
`integrations/pos_meps_apex/controllers/main.py:12-14`).**

```
TXN 1 — on its own registry.cursor(), committed BEFORE the request cursor writes anything:
  1. INSERT one op row per leg, state='pending', lease 60 s, declared_amount set.   §A.7.3(a)

TXN 2 — the request cursor. ONE commit, in this order:
  2. resolve programme ids from ir.config_parameter                    (never guessed)
  3. resolve/create the two loyalty.card rows for the partner          (V14 decides whether
     stock creates them lazily; if not, the migration pre-creates both)
  4. SELECT … FROM loyalty_card WHERE id IN (…) FOR UPDATE             ← THE LOCK   §A.7.3(b)
  5. verify each grant row: not consumed, not expired, partner matches, amount ≤ ceiling
  6. re-price from the Odoo product records — the BFF's reprice() is the app's authority,
     Odoo's is the till's; they are reconciled by the golden vectors, not by trust
  7. apply the tender:
       wallet  → pos.payment against the almond_wallet method + debit the card
       points  → the reward line, admitted only because step 5 passed (§A.3.3)
  8. create the pos.order / sale.order with uuid
  9. compute almond_earn_base (§A.6); recompute earn from the SNAPSHOT, CLAMPED (§B.5)
 10. issue the earn; write loyalty.history (under the almond_op_id context — §A.7.4)
 11. write the snapshot fields on the order (§B.5)
 12. UPDATE every op row to 'applied' (or 'reserved' for a till wallet tender), with
     balance_after; set grant.consumed_op_id
 13. COMMIT
```

**V19 probes what is actually load-bearing here**, and it replaces an earlier probe that would have
*certified the bug*: an earlier draft asked "are steps 4→11 one transaction?", and a **pass** on that
question means the pending row is invisible to every other session, which makes the lease, the
reaper, the takeover branches and `indeterminate` all dead code. The probe must instead confirm
**(i)** steps 2→13 commit or roll back as one unit (savepoint + deliberate failure at step 10 on
staging, asserting the tender is not visible afterwards), and **(ii)** the TXN 1 op row is
`SELECT`-able **from a second session** while steps 2–12 are still in flight.

**The sync-side issuer is a separate, named file, and it is not optional.** `settle_order` covers
app-originated and till-originated *online* orders that come through the controller. **Queued
offline orders sync through `pos.order.sync_from_ui` / `_process_order` and never touch that
controller.** With `reward_point_amount = 0` (§A.5), stock's re-derivation issues nothing. So
"earn survives offline" — the invariant §D.1, §D.2 and §D.8 all rest on — has **no implementation**
unless `models/pos_order.py` overrides the sync entry point, calls `services/earn.py` from the §B.5
snapshot, and writes `pos:<uuid>:earn` through `services/op.py`. That override is listed in §A.9,
built in gate 4, and added to doc §8's upgrade checklist as a second high-churn patched symbol.

## B.4 `indeterminate`, and its bound

Compensating a debit that may or may not have committed is a coin flip with the customer's money.
Four rules:

1. **Collapse the saga.** `settleOrder` removes the case rather than handling it. The
   `catch`/`creditWallet` compensation at `checkout.ts:80-84` and `subscription.ts:30-33` is
   **deleted**.
2. **Where one transaction is genuinely impossible** — the PSP capture on the card path — the
   operation returns `{ status: 'indeterminate', probeKey }` and the route returns **HTTP 202**
   `{ state: 'pending_reconciliation', probeKey }`. It does **not** compensate.
   `cron_almond_reconcile` calls `probeWrite`; **only `status: 'not_applied'` — which, per §B.2, is a
   state the probe has already transitioned the row into — triggers a compensating credit**, and
   that credit carries `app:<key>:compensate` so it too cannot double.
3. **A member with an outstanding `indeterminate` movement is soft-blocked from new spend grants,
   with a bound.** A customer-facing denial with no bound is a customer refused at the counter with
   money the system has already taken, for as long as the outage lasts — and the outage is precisely
   the condition that produced the indeterminate outcome. **Maximum block: 15 minutes**, after which
   new grants are permitted and the op is escalated to a named human. `manager_override` with reason
   `pending_reconciliation` is exempt from minute 0, capped and counted like any other override
   (§C.5.1). **If `cron_almond_reconcile` itself cannot run**, the block expires by wall clock: the
   timeout is `lease_expires_at` on the op row, read at grant time, never held in the reaper's state.
4. **Earn is never blocked.** It is additive.

## B.5 The Odoo-side snapshot on `pos.order` — and the clamp that was missing

```python
almond_earn_rate_applied = fields.Float()     # snapshotted CLIENT-SIDE at sale time
almond_earn_base         = fields.Monetary()  # §A.6
almond_earn_total        = fields.Float()     # the client's claim
almond_earn_honoured     = fields.Float()     # what was actually issued, after the clamp
almond_channel           = fields.Char()
almond_pad_session_id    = fields.Char(index=True)   # which pad session identified this order
almond_authz_grant_id    = fields.Char(index=True)   # which grant authorized any spend on it
```

Recompute at sync **from the snapshot**, not from today's partner state — doc §7.4 Layer 2:
*"a customer promoted between the sale and the sync gets paid at the new rate for an old order… The
receipt is the contract; the snapshot is what makes it enforceable."*

**But the snapshot originates in a browser on a till, so Layer 2 without Layer 3 is a self-service
mint.** An earlier draft adopted Layer 2 verbatim and dropped Layer 3 — the bounded-divergence rule
and the per-till issuance cap — leaving no issuance ceiling anywhere in the design and only a
*floor* alert ("zero issuance today"):

> Set `almond_earn_rate_applied = 400` on every order at one lane. The server recomputes *from the
> snapshot* and honours it. A 3.50 JOD ticket pays 1,400 points = 14.00 JOD instead of 0.14–0.35.
> At ~230 invoices/day/lane that is ~3,200 JOD/day from one till, and the JS bundle is served
> fleet-wide from one server. Job 5 asserts `card.points == Σ(applied ops)` — the inflated ops *are*
> applied, so it passes and the fraud is invisible to the one reconciliation that runs.

**[DECISION] Doc §7.4 Layer 3 is restored, in `services/earn.py`, as a hard server-side clamp:**

```python
# 1. The rate is clamped to the DOMAIN and to the partner's own recorded rate.
rate = min(snapshot_rate, partner.almond_earn_rate)
if rate not in (4, 6, 8, 10):
    quarantine(op); alert('rate_domain_violation', order.uuid, snapshot_rate); return

# 2. An absolute per-JOD ceiling, from ir.config_parameter, priced and signed.
#    almond_loyalty.abs_ceiling_pts_per_jod   (proposed 10 — the top live rate, no headroom
#    above it, because there is no legitimate mechanism that pays more than the top rate)
honoured = min(client_total, recomputed + ABS_CEILING_PTS_PER_JOD * invoice_jod)

# 3. The per-invoice absolute cap (§A.6.1), when a human has signed one.
# 4. Divergence is written to almond_earn_total vs almond_earn_honoured and reported daily.
```

plus **a per-till daily issuance cap** (`almond_loyalty.till_daily_issuance_cap`, in points) that
**trips an immediate alert, not a next-morning report line**, the moment one till crosses it —
`cron_almond_reconcile` job 6. Doc §7.4 prices the unbounded version at **~2,300–4,600 JOD/day**
fleet-wide for a compromised POS bundle and refuses to ship without a signed number; so does this
document. **T25 carries a vector whose snapshot exceeds the partner's rate and whose expectation is
the clamped value.**

**The last two columns are the forensic pair.** Without them A3 is undetectable: you cannot ask
afterwards *"which pad session identified this member, and did anyone prove they were the holder?"*
Note the honest limit of what they answer — with no staff identity in the BFF today (§C.5.2) they
identify a **pad and a till**, not a human, until `requireStaff` exists.

## B.6 `opKey` — four lines, and the two clauses that make it mechanical

```ts
// bff/src/plugins/idempotency.ts  — NEW export
export function opKey(req: FastifyRequest, leg: string): OpKey {
  const k = (req as { _idemKey?: string })._idemKey;
  if (!k) throw new Error('opKey() called on a route without idempotencyPreHandler');
  return `app:${k}:${leg}` as OpKey;
}
```

`_idemKey` is already set at `idempotency.ts:36`.

**And `keyFor()` stops bucketing unauthenticated callers together.** Today
`idempotency.ts:14-17` sets `who = 'anon'` whenever `memberId(req)` throws, so every unauthenticated
caller shares one namespace. Under this design the pad authenticates with a Pad token and the till
with a POS key, both of which land in `anon`, and `opKey(req, leg)` then derives Odoo's **global**
`op_key` from that string. Two consequences, one of them a cross-caller data leak: a later caller
reusing a key receives the first caller's cached body verbatim — including the `sessionId` §C.3
works to keep opaque — and an attacker who leaves a request in flight stalls that key for the length
of the lease.

```
who = memberId(req)            when a member JWT is present
    | `pad:${padId}`           from the verified pad token
    | `pos:${posConfigId}`     from the verified till credential
    | REJECT                   an Idempotency-Key with no resolvable principal is a 400,
                               never a bucket
```

**T17 clause 4** asserts no key produced by `keyFor` contains the literal `anon`.

## B.7 What each existing caller becomes

| File:line today | Becomes |
|---|---|
| `routes/auth.ts:20-21` — `verifyOtp(p, code)` then `findOrCreateByPhone(p, name)` | `verifyOtp` **returns a branded `OtpProof`** instead of `void`; `enrolByPhone(p, proof, ctx, name)`, which throws `already_enrolled` on a known phone. Proof becomes a value the type system requires rather than a side effect a future edit can drop. **And the dev bypass is deleted — gate 0.** |
| `routes/checkout.ts:39-85` — 8-call saga + `catch`/`creditWallet` | **one call**: `backend.settleOrder({…, spendAuths}, ctx)`. `recordOrderLines` stays local (analytics, `:51`). Compensation deleted. `paymentMethod === 'wallet'` with no matching `spendAuth` returns **401 `authorization_required`**. `computeEarn` is no longer called here — the route reports `r.result.earn`. |
| `routes/wallet.ts:22-26` — `creditWallet` then `addPoints` then `getMember` | `creditWallet(id, fils, { kind:'psp', provider, captureId }, ctx)` with **`captureId` required** (T30), **plus an explicit second leg** `addPoints(…, opKey(req,'topup_bonus'))` **written inside the same Odoo transaction as the credit**. An earlier draft moved the reload bonus into Odoo as a `loyalty.rule` restricted to the top-up product — but that rule evaluates **order lines**, and the app top-up path creates no order and no line, so the app would pay **zero bonus** while the same top-up at the till paid the full one. Two channels, two answers, silently. **T7d carries a vector: an identical 20 JOD top-up through the app and through the till yields identical points, and fails if either yields zero.** |
| `routes/loyalty.ts:16` — `spendPoints(id, points, ar, en)` | `spendPoints(auth, points, reason, ctx)` behind `requireAuthorization('points', { maxPoints: points })`. For an app-originated redemption the factor is a fresh `POST /v1/pos/token` on the member's own session — the member authorizes their own spend, one code path for app and till. |
| `routes/subscription.ts:25-33,40` | `activateSubscription(auth, ctx)` and `redeemSubscriptionDrink(auth, ctx)`; compensation deleted. A free drink is a spend and today it takes no proof at all. |
| `routes/me.ts:11,24,29` | `getSelf`, `getBalances`, `getHistory`, all unwrapped from `Fresh<T>` with `asOf` and `stale` **propagated to the client**. The `tierFromSpend`/`nextTier` block (`me.ts:12-20`) is **removed** — the committee cancelled the re-tiering; `/v1/me/balance` reports `earnRate`. That deletes the last `tierFromSpend` call in `bff/src/`. |
| `routes/pos.ts:12-13` — `issuePosToken(memberId(req))` | Shape kept (HMAC, `exp`, `jti`) plus `scp`/`mp`/`mf` so a token shown for a 3 JOD coffee cannot authorize a 50 JOD debit. `usedJti` becomes a TTL cache **only after** `almond.loyalty.grant.token_jti` exists (§A.7.1). |
| `routes/pos.ts:18-25` — `/v1/pos/scan` | **Fails closed:** `if (!config.POS_SCAN_KEY \|\| req.headers['x-pos-key'] !== config.POS_SCAN_KEY) throw unauthorized(...)`. Today the whole check is skipped when the env var is unset, and this route is being promoted from "returns a member id" to "mints a spend grant". Returns a **grant handle** `{ grantId, expiresAt, scope }`, never a bare member id, and the minted grant is **bound to the presenting till** (`posConfigId` derived from the key), so a grant minted from an arbitrary network client is unusable. |
| `backend/memory.ts:78` — `addSpend` | **deleted.** `windowSpend` derived from `orders[]` (which already carries `createdAt`) over `WINDOW_DAYS`. |
| `backend/memory.ts` (whole) | must **reject** a missing `SpendAuthorization` and a missing `opKey`, and **replay** on a repeated `opKey`. A mock more permissive than production is how a defect gets back in through the test suite. |
| `backend/odoo.ts:19-36` — 14 `todo()` stubs | implements the above; every write helper takes `op_key`; every `read_group` on `loyalty.card`/`loyalty.history` carries a `program_id` domain (T24). |
| `config.ts:5` — `'memory' \| 'odoo'` | **`'mock' \| 'shadow-read' \| 'odoo'`**, and `createBackend()` becomes a `switch`, not a two-branch ternary. Today `DATA_SOURCE=mock` selects memory by *falling through* a ternary at `backend/index.ts:8`, which happens to be right and would not be if the values ever mattered. The runtime default changes off `'memory'` in the same commit, or the declared union keeps lying. |
| `packages/shared/src/integration/index.ts:21-27` | `enabled.{loyalty,wallet,gift,pos,delivery}` gain **real per-system env inputs** instead of five aliases of one expression. The comment already claims each "can be turned on independently"; today there is no input that does it, and §E.2's waves cannot be expressed without one. **`enabled.gift` stays `false` — gift cards are out of scope this round (§E.2).** |
| **`almond-app/services/loyalty.service.live.ts`** | **Named here because no static test in §F sees it.** It activates on `DATA_SOURCE === 'odoo'`, posts to `config.LOYALTY_BASE_URL` (`'https://loyalty.almond.jo'`) rather than to the BFF, and its spend paths are `chargeWallet: (userId, amount) => post(E.walletCharge, { userId, amount })` (`:44-45`) and `redeemReward: (userId, input) => post(E.redeemReward, { userId, ...input })` (`:31-32`) — **client-supplied member id, no authorization, no idempotency key, a static bearer**. Every spend path is re-pointed at the BFF, `userId` is deleted from every body, and an `Idempotency-Key` is added. T16/T17's walk is extended to any file posting to a `walletCharge` / `redeemReward` / `walletTopup` endpoint, not just to `Backend` call sites — otherwise the seam is enforced only where it was already safe. |
| **NEW** `bff/src/authz/grant.ts` | `mintFromPosToken()`, `mintFromOtp()`, `mintFromManagerOverride()`, `consume(grantId)`. **The only module containing `AUTHZ_BRAND`**, and the only one that writes `almond.loyalty.grant`. |
| **NEW** `bff/src/authz/staff.ts` | `StaffAuthorization`, `requireStaff`, `requireManager`. The only module containing `STAFF_BRAND`. |
| **NEW** `bff/src/routes/pad.ts`, `bff/src/routes/pad_enrol.ts`, `bff/src/pad/{token,devices,sessions,claims}.ts` | §C |
| **NEW** `bff/src/backend/shadow.ts` | §E.2 — **read-diffing only**; there is no write-mirroring mode |

### B.7.1 Existing tests this change invalidates, and what each becomes

Naming these is not optional: `bff/test/earn.test.ts`'s structural tests are called assets by the
brief, and gate 3 is declared green on a suite that cannot be green while two of them contradict the
design.

| Test | Why it breaks | Becomes |
|---|---|---|
| `earn.test.ts:664-669` **T10b** — `expect(src).toMatch(/backend\.recordEarnBreakdown\(\s*order\.id\s*,\s*earn\s*\)/)` | `recordEarnBreakdown` is deleted from `Backend` and the checkout body reduces to one `settleOrder` call, so the regex can never match again | assert `settleOrder` is called and the breakdown is on the returned order |
| `earn.test.ts:600-662` **T10** — posts `paymentMethod: 'wallet'`, builds `ctx` with `paidFromBalance: true` (`:645`), asserts `pointsEarned > 0` (`:652`) | §A.6 mandates that a ticket paid entirely from the wallet earns on a base of **0** — T25's own first vector | **split**: a cash vector (earn > 0) and a wallet vector (earn 0). That split *is* the honest statement of the offer change in §A.6.2 |
| `checkout.test.ts:37-46, 48-58, 60-67` — three wallet checkouts | wallet payment now requires a `spendAuth`, else 401 | the fixture mints a grant; `:45`'s `pointsEarned > 0` moves to the cash vector |
| `checkout.test.ts:21-23`, `earn.test.ts:611-616` — verify with the literal `'123456'` | gate 0 deletes `OTP_DEV_CODE` | read the requested code from a test hook on `requestOtp` |
| `earn.test.ts:465-497` **T7c** — no route calls `computeEarn` | becomes vacuous once the route reports Odoo's number | **restated**, not deleted: no file under `bff/src/routes/` calls `computeEarn` or `earnedPoints`, and every route reports `SettledOrder.earn` |

**And `EarnBreakdown` itself.** `OrderRecord.earn` (`bff/src/backend/types.ts:58`) is persisted with
the full 14-field shape. At cutover, `OrderRecord.earn` becomes
`OdooEarnBreakdown | EarnBreakdown` — old rows keep their shape and new rows carry the Odoo shape,
discriminated by the presence of `earnRateApplied`. The affected files are
`bff/src/backend/types.ts:2,58,77`, `bff/src/backend/memory.ts:84-92`, `bff/src/earn.ts:7`, and
`bff/test/earn.test.ts:669,679`. Narrowing the type in place, without a discriminator, silently
invalidates every persisted order.

---

# C. The pad flow

## C.1 The owner's two unanswered questions

### (a) Pad → Odoo direct, or through the BFF? → **Through the BFF.**

The BFF already owns every primitive this needs: `bff/src/pos/token.ts` (short-lived HMAC
capability tokens), `bff/src/auth/otp.ts` (`normalizePhone` at `:5-11` already canonicalises to
`+9627XXXXXXXX`), `bff/src/plugins/idempotency.ts`.

*What changes if it must be direct:* an Odoo controller with `auth='public'`, its own pad token, its
own rate limiter, its own audit model, its own masking, and a `sudo()` read — **the same custom
endpoint, relocated**, with the token/OTP/idempotency machinery duplicated in Python. Nothing is
saved. The security cost is specific: an `auth='public'` controller **on the same Odoo instance that
holds `res.partner`** is one `sudo()` mistake away from the whole member base; a BFF endpoint is one
hop away from an Odoo credential it does not hold. The only argument for direct is one fewer hop
against doc §6.2's 2-second budget, and the phone path is already the slow path (4–6 s of typing
before anything is sent).

### (b) Odoo POS supplies the pad, or a separate device? → **A separate device, and this is not close.**

`pos_customer_display` is **display-only** — it renders order lines and totals and has no input
surface **[STOCK — must probe]** V9. `pos_self_order` is an *ordering* kiosk. **There is no stock
customer-facing phone-lookup pad in Odoo 19 [CUSTOM].**

The decisive fact is A5: the Odoo POS client **preloads a partner set into the browser**
(`res.partner._load_pos_data_fields` **[STOCK — verified in doc §8]**; whether that is all 47,720 or
a limited set is **[STOCK — must probe]**, V8). If the pad is the POS's own screen, **that preloaded
list — names and phone numbers — sits in the memory of a tablet facing the public.** A stolen or
inspected pad is then a member-base disclosure, not a lost tablet.

*What changes if it must be the POS's display:* identification dies exactly when the till's network
dies (§D.3); the route is gated by the display's `access_token` rather than an independent revocable
pad token; and V8's answer becomes a data-protection finding rather than a performance one. On (b) I
am not neutral — pending V8 and V12, a separate device may be the only lawful reading under
24/2023.

## C.2 What the pad may hold — the whole list

| On the pad | Not on the pad |
|---|---|
| a device secret in OS secure storage, exchangeable for a 15-min pad token | any Odoo credential |
| `padId`, `branchId`, the paired `posConfigId`, a persisted monotonic `boot_id`+`seq` | any member id, name, phone or balance — ever, even transiently after a response |
| the digits currently being typed, cleared on submit and on 20 s idle | any history of previously typed numbers |
| offline only: a queue of **sealed-box-encrypted** claims, each naming an order uuid (§D.4) | any plaintext phone number at rest |
| a «شكراً» rendering | any indication of whether the number matched an account |

**Physical:** one pad per till lane, bolted, sealed wipeable case, **fixed power not battery**, RTL
layout with an **LTR numeric keypad** (Arabic-Indic digits in an RTL container render in the wrong
order — the customer types 0795 and sees 5970), digit height ≥ 12 mm, one screen one purpose, daily
wipe on the opening checklist. **The lane count is [ASSUMPTION]** — `integrations/almond_branch/hooks.py`
establishes **9 branches from 4 companies** but no `pos.config` count is in the repo. The purchase
request needs the real number; every per-till bound in this document (deferral cap, issuance cap,
override cap) is expressed per till precisely so it does not depend on that count being known today.

## C.3 The flow, step by step

**Pairing (once, by a manager).** `POST /v1/pad/enrol-device` with a manager credential returns a
device secret bound to `(padId, branchId, posConfigId)`. `bff/src/pad/devices.ts` holds the registry;
revocation is one row. A pad not paired to a POS config identifies nobody, so a stolen pad taken to
another branch is inert.

**Step 1 — the customer types**, in parallel with the cashier ringing items. Pad-local
`normalizePhone()` mirrors `bff/src/auth/otp.ts:5-11`; malformed input never reaches the network.
**Till time: 0 s.**

**Step 2 — `POST /v1/pad/identify`**, body `{ phoneE164 }`, header `Authorization: Pad <padToken>`,
plus an `Idempotency-Key` namespaced by `padId` (§B.6). Server-side, in order: verify pad token →
rate-limit (§C.4) → `normalizePhone` again (never trust the client's) → **exact match, no prefix, no
autocomplete, no "did you mean"** → mint an opaque session.

**Step 3 — what the pad gets back, and this is the crux:**

```jsonc
{ "sessionId": "ps_9f3c…", "ok": true }
```

That is the entire body, **for a member and a non-member alike**. No `hasAccount`. No hint. No name.
No balance. No member id. No `affordableRungs`. The pad renders «شكراً — أعطِ الكاشير لحظة».
Response time is padded to a fixed floor so latency is not a side channel.

> **This closes A2 outright and takes most of A1 with it.** Every softer variant considered —
> `hasAccount` plus a masked name, or `hasAccount` plus the rungs the balance can afford — is a
> rate-limited **oracle**, and a rate limit does nothing at all against an attacker who needs **one**
> lookup to decide whether a specific contact is worth attacking. There is no version of this where
> the pad shows a greeting: «مرحباً أحمد» on a public screen is simultaneously the enumeration
> oracle, the 24/2023 disclosure, and the thing that makes A1 believe he is authenticated. **T18.**

**Step 4 — the employee screen, BEFORE authorization.** The existence signal goes **only** to the
paired till, on its branch channel (`GET /v1/pad/session/:id`, authenticated by the till's own
per-`posConfigId` credential — **not** the fleet-wide `POS_SCAN_KEY`). Pairing is what routes it, so
the cashier never types a session id.

```
┌──────────────────────────────────────┐
│ عضو ✓        ٨٩؟        ٦ نقاط/د.أ   │
└──────────────────────────────────────┘
```

| Field | Shown | Why |
|---|---|---|
| status | «عضو — تم التعرف» | the cashier must know whether earn applies |
| **`hintDigits`** | **the last two digits the customer just typed** | §C.6 |
| `earnRate` | «٦ نقاط/دينار» | it is printed on the receipt anyway |
| blocked | «موقوف — اتّصل بمدير الفرع» when `almond_loyalty_blocked` | §A.4 |
| points balance | **NOT SHOWN** | not needed to earn |
| wallet balance | **NOT SHOWN** | this is A1's prize; withhold it |
| full name | **NOT SHOWN** | §C.7 |
| phone | **NOT SHOWN** | the customer typed it; removes A3's "read it off the screen and reuse it later" |

**This screen is a real file with a real cost.** It is a custom OWL component,
`static/src/app/almond_pad_status.js`, living in the POS client, polling the BFF, holding a
per-`posConfigId` credential in the browser and rendering a countdown. It is listed in §A.9 and built
in gate 6, and it sits in the same "Highest churn" surface (`docs/LOYALTY-ODOO-MODULE.md:1514`) whose
volatility was the stated reason for rejecting the cheaper JS option in §A.3.2. Counting it is what
keeps that rejection honest.

**Step 5 — the cashier reads back the two digits: «٨٩؟»** — 1.2–2.0 s. §C.6.

**Step 6 — earn.** Proceeds on identification alone. Additive, clamped (§B.5), idempotent on
`pos.order.uuid` **[STOCK — verified in doc §7.4/§8]**. The session binds to the order's `uuid` on
first use (`pos.order.almond_pad_session_id`) and **cannot bind to a second order** — that is what
stops a session leaking onto the next customer's ticket.

**A probe decides whether step 6 works at all.** **V12** asks whether the POS client can set a
partner that is **not in its loaded set**, and at what cost. If V8 returns a limited partner set and
V12 says it cannot, the pad-identified partner may be unattachable at the till and the whole flow
needs a server round trip it does not budget for.

**Step 7 — spend requires a factor, and the pad is not one.** §C.5.

**Step 8 — the employee screen, AFTER authorization.** Now, and only now: full name, points balance,
wallet balance with `asOf`, and spend controls scoped to the authorized amount, expiring with the
grant (120 s). **The balance is not a greeting; it is the thing being protected.**

## C.4 Rate limits, and what they are and are not for

Per pad: 1 identify / 6 s, 10 / min, 200 / day. Per phone across all pads: 3 / 5 min, 10 / day. Per
branch: an anomaly alert when identify : completed-order exceeds 1.3 in a rolling hour.

Every identify writes an audit row: `padId`, `branchId`, `posConfigId`, `phoneHash` (HMAC — the log
must not become the enumeration list the endpoint refuses to be), `matched`, `sessionId`,
`actorLogin` at bind time **when staff identity exists** (§C.5.2), `outcome`. Retention 90 days,
then aggregate counts.

**Be honest about what this buys.** Rate limits do **not** stop A1 — he needs one lookup. They stop
A2, they raise A3's cost, and the audit log makes A3 *detectable* rather than prevented. What stops
A1 is step 3 (he sees nothing) and step 7 (he cannot produce a factor).

## C.5 The authorization ladder — and the rung that is not on it

| Factor | Path | Till seconds | Ceiling | Who can produce it |
|---|---|---|---|---|
| **App capability token** (primary) | member's app → `POST /v1/pos/token` → QR → till posts to `/v1/pos/scan` with its key | **~0.2 s scan**, and the tap happens in parallel | scoped by `scp`/`mp`/`mf`; bound to the presenting `posConfigId` | only someone holding the unlocked phone with a valid member JWT |
| **OTP to the registered number** (fallback) | `POST /v1/pad/authorize/start` → SMS **to the number on file, not the number typed** → 6 digits typed **on the pad** → `/confirm` | 8–20 s (doc §6.2's own price) | none | only someone holding the **SIM** |
| **Manager override** (exception) | manager PIN + a reason from a closed list, two-person, per-branch daily cap, daily report | — | **priced, §C.5.1** | A6 territory |

**A1 fails here and only here.** He knows the phone number; he does not have the phone. The OTP goes
to the *account's* number, so typing a number you control and receiving the code on it proves
nothing; and it is typed **on the pad**, not read aloud, so a complicit cashier still needs the SIM.

**No `pad_pin` rung.** A 4-digit PIN on the pad, value-capped at 5 JOD on the wallet, was proposed.
**Rejected**, for four reasons and the fourth is decisive: it is shoulder-surfable on a public
screen; it is a new shared secret for 47,720 people who did not ask for one; it is unrotatable by
the members with no name on file, who therefore have no out-of-band recovery; and **it caps the
wrong asset** — points and wallet are the same unit off by 100×, so a rung that caps the wallet at
5 JOD leaves a 5,000-point balance (50 JOD) fully spendable.

### C.5.1 The manager override is priced in ONE unit, or it does not ship

An earlier draft capped the override in **fils only** — which reproduces the exact error that killed
the `pad_pin` rung two paragraphs above:

> A manager knows a member's phone (a receipt, a delivery order, the branch call log). Identification
> succeeds on phone alone; the manager needs no factor from the customer. `manager_override` with a
> reason from the closed list, and the member's **entire points balance** is redeemed as a discount
> on an order the manager rings. `override_daily_cap_fils` never engages, because the debit is on the
> points programme. The report counts overrides, not their value, so the fils cap reads green
> throughout.

| Bound | Value | Derivation |
|---|---|---|
| `almond_loyalty.override_daily_cap_value_fils` **per branch** | **[DECISION NEEDED]** proposed **15,000 fils (15 JOD)/branch/day** | ~3× the measured median redemption of 3.50 JOD: a branch absorbs three genuine device failures a day and not a fourth. **A points debit counts against it at `points × 10` fils** — 1 point = 1 qirsh = 10 fils, §A.1's own measurement. One budget, both assets. |
| `almond_loyalty.override_daily_cap_count` **per employee** | proposed **2/day** | above this, the pattern is not device failure. **Requires staff identity — §C.5.2.** |
| `almond_loyalty.override_member_cap_days` | proposed **1 per member per 30 days** | a per-branch and per-employee cap says nothing about the same member being overridden repeatedly, which is what a targeted attack looks like |
| Trip behaviour | the override is **refused**, not warned; the customer takes a claim voucher | — |
| Report line | overrides per employee, per branch, **with their value in fils**, next to the manual-discount-after-failed-redemption count (doc §6.3) | — |

**Fleet exposure at the proposed cap: 9 branches × 15 JOD = 135 JOD/day maximum, ~49,000 JOD/year
worst case.** That number goes to the owner with a signature line (O-6). If it is judged too high the
cap comes down; it does not stay unstated. **T32-b** asserts that a points redemption under
`manager_override` consumes the same budget as an equal-value wallet debit.

### C.5.2 Staff identity does not exist, and the plan must say so

A repo-wide grep for `requireStaff|requireManager|cashier|manager|role` under `bff/src/` returns one
unrelated hit (`bff/src/analytics/orderLines.ts:23`, a channel enum). `bff/src/plugins/auth.ts`
contains exactly `requireMember` and `memberId`. The only non-member credential in the BFF is
`config.POS_SCAN_KEY` — **one shared secret for the whole fleet** (`bff/src/routes/pos.ts:19`), from
which no individual actor can be derived.

Against that, this design requires: a manager credential for pairing (§C.3), a till credential for
the session channel (§C.3 step 4), a manager PIN with two-person approval and a **per-employee**
cap (§C.5.1), `SpendAuthorization.actor` and `almond.loyalty.op.actor_login` (§B.1, §A.7.2),
`StaffAuthorization` for every void and correction (§B.1, §D.6), `actorLogin` in every pad audit row
(§C.4), and §0's claim that A3 is closed by forensics.

**[DECISION] Staff identity is its own gate (§G gate 3a), with named files:**
`bff/src/plugins/auth.ts` gains `requireStaff` / `requireManager`; `bff/src/staff/tokens.ts` issues
short-lived staff tokens carrying the Odoo `res.users` login relayed by the till;
`bff/src/staff/devices.ts` is the till registry keyed to `posConfigId`. **Until it exists, the
per-employee override cap is dropped and the A3 forensic claim is reduced in writing to what `padId`
+ `posConfigId` can actually support: which pad and which till, not which human.**

## C.6 The digit echo replaces the masked name — and dissolves the 29%

Every earlier design reached for a masked name («أحمد م.») on the employee screen. It is **empty for
3,369 of 11,628 active members**, and for the other 8,259 it confirms nothing: a cashier saying
«أحمد؟» and a customer saying «نعم» is not a check — **anyone says yes to a name**, and it trains
customers that saying a name is how you prove one.

**The failure that actually occurs at a counter, at volume, is a mistyped digit crediting a
stranger.** Echoing back the last two digits the customer just typed catches exactly that failure,
costs the same 1.5 s, discloses nothing to bystanders (the customer typed them), and **works for
100% of members**. The 29% stops being a designed-around constraint and becomes a non-case.

**Consequences that follow:**

- `findByPhone` returns `hintDigits`, not `displayHint`. **There is no `maskName()` function in this
  design** — **T19** asserts no name reaches the pre-authorization employee screen at all, which is
  a stronger and simpler assertion than a masking property test.
- Name capture is offered **only after an authorization event**, on the pad, in the customer's own
  hands, with the ق‑11 consent text. Letting anyone attach a name to an identified account is A1's
  dream: he types the colleague's number, sets the name to his own, and any name-based challenge
  passes forever. **`POST /v1/pad/identify` must never write to `res.partner` — T20.**
- The pad is also the **first surface in the estate on which a consent checkbox can lawfully live**
  — `docs/LOYALTY-DECISIONS.ar.md` ق‑11 records documented consent for **0 of 47,720** records and a
  24/2023 deadline that passed 17 March 2025, and states plainly that *"لا يوجد اليوم أيّ سطحٍ تعمل
  عليه خطوة موافقة."* That is worth more than every second of cashier time the pad saves, and it
  belongs in the purchase request instead of a labour-savings case that does not hold.

## C.7 Two disagreements with the brief, and the receipt

**Brief §1: *"The employee then sees the customer's name and balance."*** Not before authorization.

- The **balance** on phone-alone turns the pad into a balance oracle for anyone who knows a number,
  and it is A1's reconnaissance step. It is also operationally expensive: a balance on the cashier's
  screen manufactures the «ليش ٣ دنانير بس؟» conversation in a queue, several times a day at every
  till.
- The **full name** on phone-alone is a disclosure of personal data to a third party who supplied
  nothing but a phone number.

The owner's operational intent — the employee can serve the customer confidently — is met by the
digit echo plus the earn rate, and met *fully* after authorization. **What is given up is exactly
the part that is also the attack.**

**And the receipt is not the escape hatch.** An earlier draft routed the balance to the receipt
(«نقاطك: ٤٨٠ · حتى ١٣:٤٥») on the grounds that a member's own receipt after their own transaction is
different. **Under §C.3 step 6 the transaction is attributed on phone alone, with no authorization —
so "their own transaction" is an assumption the identification model does not support:**

> Attacker knows a colleague's phone number. Types it on the pad (learns nothing, as designed). Buys
> a 1.00 JOD coffee. The receipt prints at the end of that ticket carrying the *identified member's*
> balance. He walks away with the victim's balance on paper, having disclosed nothing to the pad and
> triggered no authorization — and at 1 point = 1 qirsh the printed figure also brackets the wallet's
> order of magnitude. Cost: 1 JOD. It is a 24/2023 disclosure of a third party's data to whoever is
> holding the receipt.

**[DECISION] The receipt prints the delta earned on this ticket («+١٤ نقطة») and never a balance,
unless the order carried a `spendAuth`.** The balance appears on the receipt under the same gate as
the employee screen. Otherwise it is delivered to the app, or by SMS **to the registered number** —
both of which require possession. **T19 clause 4:** no route that emits a receipt payload may include
`points`, `walletFils` or `balance` unless a `spendAuth` is present on the order.

**Brief §2: `findOrCreateByPhone` "is the pad flow".** It is half of it. Split into `findByPhone`
(no create, no balance) and `enrolByPhone(otpProof)`.

## C.8 Enrolment, and the coverage question that hangs on it

**The pad identifies existing members. It does not enrol them, and the failure-semantics tables must
not say it does.** An earlier draft had the pad "queue the partner" while offline, which
`enrolByPhone`'s own OTP requirement makes impossible and which T20 forbids by name.

- **Online enrolment at the counter** is a separate leg: `POST /v1/pad/enrol` in
  `bff/src/routes/pad_enrol.ts` — its own route, its own OTP round trip to the typed number, its own
  rate limit, its own consent text. **T20 names that module as the one place `enrolByPhone` may be
  called from**, so the exception is enforced rather than implied.
- **Offline enrolment does not exist.** Not "queue the partner": queue **nothing**, create nothing,
  grant no session, grant no welcome credit.

**The honest consequence.** Coverage is **6.23% of invoices, flat for 20 months**, and the brief
calls the pad "the intervention that changes this". Identification-only growth is real — it converts
walk-ins who are *already members* — but growth in the **member base** waits on the app, which
ق‑11 records is not in production. Do not let a slide claim otherwise.

## C.9 The governance item — raised, not gated

Committee decision خ‑3 caps acquisition-driven coverage at **420 identified transactions/day**
network-wide before the replacement status ladder ships. Today is ~201/day (6.2% × 3,238); ق‑8's
dark-branch restoration consumes ~411; **that leaves ~9/day of headroom.** Under the reading that the
pad is "acquisition", the project waits on a ladder ق‑4 cancelled.

**The pad is not acquisition, and خ‑3 itself drew the distinction:** restoring dark branches is
*"ليست نموّاً"* — service to members already registered and already walking in. The pad identifies
existing members already at the counter; it acquires nobody (§C.8 is what makes that literally true).

**But the cash consequence is real and belongs to the owner, expressed as money, not as a
transaction count:** each +100 identified transactions/day is **+14,700 JOD/year** of accrual at the
measured 0.404 JOD/txn. At 25% coverage (810/day) annual accrual is **~119,000 JOD against today's
~29,751**. **The ask is a monthly accrual budget in JOD with a monthly readout (O-5) — not a ruling
on خ‑3's wording.**

**This does not block engineering.** Staking the round's central deliverable on a governance reading
the committee has not made is a schedule risk the engineering spec would be *creating* rather than
resolving. Gates 0–4 proceed regardless; only the **hardware purchase** waits, at gate 6.

## C.10 The stop condition that decides whether the pad is worth buying

**V7 — does attaching a partner to a `pos.order` that ALREADY carries lines cause `pos_loyalty` to
recompute the loyalty programmes in the POS client?** **[STOCK — must probe]**

The pad's entire value is that 4–14 s of typing happens **in parallel** with ringing items. If
loyalty evaluation is bound to order creation rather than to `set_partner`, identification must
precede the first line, the typing re-enters the critical path, and **the pad is worse than the QR it
replaces.** That is a stop condition on the hardware purchase, and the fallback — a till-side "attach
and re-fire" patch — is yet another patched symbol in doc §8's highest-churn surface, which changes
the cost case.

**And the honest statement that goes with it.** The app is not in production (ق‑11), so the
app-token rung serves nobody today and **~100% of counter redemptions fall to OTP at 8–20 s**. Two
live options, both to the owner (O-7):

1. **Ship earn-only at the counter** until the app is in production. Spend stays in the app, where
   the member's own session is sufficient proof. **This is the safer default, it is my
   recommendation, and §A.3.3 already makes the module enforce it** — a points programme with a
   redeemable reward attached to a POS config refuses to load until the redemption confirm ships.
2. Ship OTP-gated counter redemption and accept 8–20 s on every one, with the button labelled
   `[ أرسل رمزاً · ≈١٥ ثانية ]` so the cashier knows the cost before pressing it.

Nothing in §A–§F changes under option 1; §C.5's ladder simply has one rung unused until the app
ships.

---

# D. Failure semantics

## D.1 The invariant

**[STOCK — verified in doc §7.1]:** *"Earning is additive and idempotent per order. Spending is not.
Therefore earn happens offline and spending never does."* It rests on doc §1.4
**[STOCK — must probe]**: `pos_loyalty` computes earn client-side in JS and the server re-derives on
save — *"Offline earn works by construction. Nothing needs to be built for it. What needs to be built
is the reconciliation."*

Doc §7.3's proof settles every "can we just cache it" conversation and is adopted verbatim: two
offline tills, one 300-point balance, two 300-point redemptions, *"600 points spent from a 300-point
balance, and no client can detect it… There is no client-side mitigation. Not a shorter cache TTL,
not a per-till reservation, not a signed balance."*

**And the mechanism that makes §7.3 true is named, not assumed.** Doc §6.3's answer to that proof is
a *custom* mandatory synchronous server confirm. §A.3.3 builds it, and §D.2's "spend blocked" row is
enforced by the server-side reward-line guard — not by a table in a document.

## D.2 Four outage domains

Doc §7 assumes one boundary (POS ↔ Odoo). With a separate pad there are four, failing independently:

```
[pad] ──1── [BFF] ──2── [Odoo] ──3── [POS/till]        4: Odoo itself
                    └── 1b ── [pad ↔ till, branch LAN] ──┘
```

| Operation | 1 pad↔BFF | 2 BFF↔Odoo | 3 POS↔Odoo | 4 Odoo down |
|---|---|---|---|---|
| Identify at the pad | ⚠️ **write-only**, §D.4 | ❌ fail closed, never a guess | ⚠️ **probe-dependent**, §D.3 | ❌ |
| Earn (till order) | ✅ unaffected once the session is bound | ✅ unaffected | ✅ **queued, uuid-keyed** **[verified in doc §7.2]**, issued by §B.3's sync override | ✅ queued |
| Earn (app order) | n/a | ⚠️ **rejected, not queued** — an app order is a payment | n/a | ⚠️ same |
| Show balance (app) | n/a | ⚠️ last value with `stale:true` + `asOf`, rendered «حتى ١٤:٣٢» | n/a | ⚠️ same |
| Show balance (employee) | ❌ not shown — it requires a grant | ❌ | ⚠️ stale, **labelled** | ❌ |
| **Spend points** | ❌ **blocked** — the redeem confirm cannot be reached, and the server guard rejects the line at sync | ❌ | ❌ | ❌ |
| **Debit wallet** | ❌ **blocked** | ❌ | ❌ — `send_payment_request` **fails closed**, exactly as a declined card does | ❌ |
| Wallet top-up | n/a | ❌ — do not capture a PSP payment you cannot record | n/a | ❌ |
| Mint an authorization | ❌ | ❌ | ❌ | ❌ — a factor verifiable offline is not a factor |
| **Enrol** | ❌ **not available** — enrolment needs an OTP round trip (§C.8). Nothing is queued. | ❌ | ❌ | ❌ |
| Manager override | ❌ | ❌ | ❌ | ❌ — an override is a spend |
| Void / refund | ❌ | ❌ | ❌ | ❌ — it moves money; §D.6 |

**And never a manual discount as a fallback.** Doc §6.3: the manual-discount button requires a
**manager PIN whenever a loyalty redemption failed on the same order**, and those events are counted.
Almond's whole commercial position is a no-discount culture at 1.5–2% of sales.

## D.3 The silent failure mode, and it is a probe

**V8.** If Odoo 19's POS loads a **limited** partner set with a server-side fallback, then offline
lookup at the till **silently reports "not a member" for everyone outside the preloaded subset** —
and the cashier cannot distinguish a non-member from an unreachable one. That is a false negative
dressed as a fact, and it produces the manual-adjustment vector doc §7.2 warns about, at scale.

**Mitigation [CUSTOM], not optional:** when the POS is offline the till must never say
«غير مسجّل». It says «لا يمكن التحقق الآن» and takes the §D.4 path if that path is available.
**Until V8 is answered, assume the limited set** — that is the safe reading.

## D.4 Offline identification is write-only, and every claim names an order

When the pad cannot reach the BFF it **cannot answer anything**, and that is the design. But an
offline claim is a **manual-credit channel**, and doc §6.2 names unauthenticated phone lookup *"the
classic cashier self-crediting channel"* at 3,238 invoices/day. An earlier draft queued
`{sealedPhone, padId, ts, localSeq}` and had the till tag orders `offline:<padId>:<localSeq>` — with
no specified transport for `localSeq` and nothing binding the claim to one order:

> The cashier waits for (or induces) a pad↔BFF outage. Types their own phone on the pad once at open;
> the pad queues sealed claim `seq=17`. For the rest of the outage the till writes
> `offline:<padId>:17` on **every** ticket. On reconnect the BFF opens one box, resolves one member,
> and applies the earn against each order's own uuid — every one a distinct, valid `pos:<uuid>:earn`
> key, no unique violation anywhere. The per-phone limit cannot apply: the phone was sealed at
> enqueue time. Yield: 0.404 JOD × ~230 invoices/day at one lane ≈ **93 JOD/day**, and it looks like
> a wifi outage in the report.

**[DECISION] An offline claim names the order it belongs to, or it does not exist.**

1. The till generates the `pos.order.uuid` **first** and pushes it to the paired pad over the
   **branch LAN** — the link that is up precisely when the WAN is down. `bff/src/pad/claims.ts`
   defines the payload; the pad↔till transport is a local HTTPS call to the pad's paired address,
   authenticated by the pairing secret from §C.3.
2. The customer types. The pad shows the same «شكراً» as always.
3. The pad **libsodium sealed-box** encrypts `{ phoneE164, posOrderUuid, padId, bootId, seq, ts }`
   to the BFF's public key and queues it. **No plaintext phone is ever at rest on the pad** — A5 gets
   an opaque blob, not the day's customer list.
4. The till marks the order `almond_pad_session_id = 'offline:<padId>:<bootId>:<seq>'`, under a
   **partial unique index on `pos.order.almond_pad_session_id` for values matching `offline:%`**, so
   one claim cannot land on two orders.
5. On reconnect the BFF opens the box, resolves the member, and applies the earn against **the uuid
   inside the sealed claim** (`pos:<uuid>:earn` — the **same namespace as the online path**, so if
   both ran there is one op and the second raises the named unique violation and reads back as
   "already issued"). No match → the order earned nothing and a report row is written.

**If the pad↔till local link is judged unacceptable, offline deferral is dropped entirely** — the pad
says «غير متاح» and the customer earns via the QR path or not at all. An unbound claim is a
manual-credit channel with no ceiling, and there is no third option.

**Bounded, because manual-credit channels get abused:**

- Queue TTL **7 days**, matching doc §7.4 Layer 4's quarantine rule; older is quarantined, not
  applied.
- **Per-till daily cap on outstanding deferrals, enforced at claim RESOLUTION in the BFF**, not at
  the pad. A cap the pad enforces is a cap an attacker with the pad can lift.
  **[DECISION NEEDED]** proposed **40/till/day** — ~17% of a peaked lane's ~230 invoices, i.e. a wifi
  outage of roughly two hours; sustained above that is not wifi.
- Every deferral is a line in the daily branch report with a per-till count. A till whose deferral
  rate is 10× its peers is not having wifi trouble.
- **Deferral covers earn only.** A pad claim can never produce a spend. **T21.**

**And deferred issuance pays the rate that was in effect at the sale, not at the sync.** The partner
is unknown at sale time, so there is no `almond_earn_rate_applied` snapshot to recompute from — which
is exactly the "recompute from today's partner state" §B.5 forbids. `services/earn.py` reads
`almond.loyalty.rate.change` (§A.4) for the rate in force at `pos.order.date_order`. Because the rate
is raise-only the error would always be in the customer's favour and always upward, so the money is
small; what is not small is that the golden vectors would all assume a snapshot and never see this
path. **T25 carries a vector: an order dated before a raise, synced after it, pays the old rate.**

## D.5 Duplicate submit — three real defects and four layers

> **Brief §3 defect 1, "no idempotency anywhere", is false as written**, and saying so precisely is
> what makes the real problems fixable. `bff/src/plugins/idempotency.ts` implements the Stripe/IETF
> convention (`:17`), is wired into every financial POST (`checkout.ts:26`, `wallet.ts:17`,
> `loyalty.ts:11`, `subscription.ts:14,37`) and is tested (`checkout.test.ts:31` asserts the key is
> required; `:48-58` asserts a replay returns the first response and charges once).

| # | The real defect | Fix |
|---|---|---|
| 1 | the store is an **in-process `Map` never evicted** (`:9`); `at: Date.now()` is written at `:35` and `:45` and **nothing reads it**. Lost on restart, invisible to a second instance. **A retry across a deploy double-charges.** | TTL (24 h `done`) + size ceiling + an `evict()` export; entries carry `expiresAt`. **No Redis** — see below. |
| 2 | **a crashed request wedges the key forever.** `:35` writes `pending`; `:45-47` is the only thing that clears it. Die after Odoo took the money and before `onSend`, and every retry gets **`409 request_in_progress` permanently, with the money already moved.** No lease, no timeout, no reaper. | `pending` becomes a **60 s lease**. On expiry the next retry does not get 409 — it calls `probeWrite(opKey, ctx)` and either replays the recorded result or proceeds. Safe **only because the key now crosses the seam.** |
| 3 | **the key never crosses the seam.** `debitWallet(id, fils)` / `spendPoints(id, points, …)` (`types.ts:66,70`) take no key, so HTTP idempotency protects one BFF process and **cannot make Odoo idempotent at all.** The till is a second writer the `Map` has never heard of. | `WriteContext.opKey` → `almond_loyalty_op.op_key` → `UNIQUE(op_key)` in Postgres, one namespace, both writers (§A.8). |

**No Redis.** Once `op_key` carries a Postgres unique index **inside Odoo, in the same transaction as
the balance change**, the `Map` is demoted from guarantee to response cache. A cache miss costs one
extra round trip that Odoo answers "already recorded". A distributed store buys milliseconds and
costs an operational dependency on the payment path.

**`usedJti` gets the same treatment — but only after §A.7.1's row exists.** It has the identical
never-evicted, lost-on-restart, invisible-to-a-second-instance bug **and it guards authorization
replay, which is worse than response replay.** An earlier draft demoted it to a cache and asserted
the durable guarantee "moves to `UNIQUE(authz_grant_id, source)`" — which is false by construction,
because a replayed token mints a grant with a *different* `grantId` and the index never sees the
collision. **Deleting the `Set` before `almond.loyalty.grant.token_jti` is deployed is a straight
downgrade of the only replay control on the authorization path.**

**Layer 4, and it is the highest-value probe in the round: V20.** `pos.order.uuid` is
**[STOCK — verified in doc §7.4/§8]**, client-generated, *"introduced in 17"*, and doc §8 calls it
*"the single most load-bearing stock field in this module"*, requiring a `post_init` **hard assert**
that aborts the install if absent, because the blast radius is *"Catastrophic and SILENT — the unique
constraint would sit on a NULL column, every replay would double-issue, and nothing would raise."*

### D.5.1 What the design becomes if V20 comes back negative

The probe must confirm **both**: (a) `uuid` present and non-null on recent orders
(`read_group('pos.order',[('uuid','!=',False)],['id:count'],['uuid'],lazy=False)` reporting any group
`>1`, plus the count with `uuid = False`), and (b) that `sync_from_ui` / `create_from_ui` actually
**de-duplicates on it**. **The field present-and-unused is the silent-failure case**: every replay
creates a second order with a fresh uuid, every replay double-issues, and nothing raises.

| V20 answer | The design |
|---|---|
| dedup uses `uuid` | as specified. `pos:<uuid>:earn` is the earn key. |
| `uuid` present, **dedup does not use it** | **[CUSTOM]** the module adds `UNIQUE(pos.order.uuid)` scoped to the Almond POS configs **and** an override on the sync entry point that looks up by `uuid` before create. A new patched symbol in doc §8's highest-churn surface — it changes the estimate and the upgrade checklist, and it is **reported as such, not absorbed**. |
| `uuid` null on recent orders, or duplicated | **STOP.** The earn idempotency key does not exist on this instance. Earn cannot go through the POS queue until it does; the fallback is server-round-trip earn, which forfeits offline earn (doc §7.2) and is a **different programme**, not a workaround. |

**Fleet cost of getting this wrong**, from doc §7.4: **~2,300–4,600 JOD/day**. That number is why the
assert aborts the install rather than warning.

## D.6 Void and refund — first-class, blocking, and tender-bound

It happens several times a day per branch: the drink is wrong, the order is voided after payment.
No earlier architecture had a void/refund path at all, and `reverseOrder` in an earlier draft took
`(orderUuid, ctx)` — an arbitrary uuid, no authorization, no ownership check, no amount, sitting
outside the entire authorization model while both subtracting points and crediting money.

| Event | Must happen | Status |
|---|---|---|
| Void an order paid from the wallet | wallet re-credited, `refund:<refund_uuid>:wallet` | **[STOCK — must probe]** V15(b) |
| Void an order that earned points | the earn op reversed, `refund:<refund_uuid>:earn` | **[CUSTOM]** |
| Void an order that **redeemed** points | points returned, `refund:<refund_uuid>:points` | **[STOCK — must probe]** V15(a) |
| **Partial refund of any leg** | its **own** key, and a bound | **[CUSTOM]** — §A.8's `refund:<refund_order_uuid>:<leg>`, plus Σ\|reversals\| per (order, leg) ≤ the original applied amount |
| Void whose returned points were **already spent** | must not let the till spend against a negative | **[CUSTOM]** — the **card** may go negative, the **till** may not spend against it; a manager reviews |

**Three hard rules, each closing a specific hole:**

1. **`reverseOrder` takes a `StaffAuthorization`** with a `reasonCode` from the closed list, counted
   against the §C.5.1 caps, and it is in `MUTATORS` for T15/T17. The op carries
   `auth_kind='reversal'`, `auth_user_id` set, `grant_id_ref` NULL, `reverses_op_id` naming the
   original — which also makes "never reverse twice" a constraint rather than a convention.
2. **A refund of a `pos.payment` on `almond_wallet` may only be returned to `almond_wallet`.**
   Enforced in `controllers/wallet_charge.py` and asserted in a test. Without it:

   > Top up 50 JOD from the app. Ring a 50 JOD order paid on the wallet tender. Void it and select
   > **cash** as the refund tender. The `refund:…:wallet` op is a *credit*, so neither
   > `_spend_needs_holder` nor `_staff_debit_names_human` applies. Net: 50 JOD of stored value out of
   > the drawer as cash, once per order, hidden inside the several-voids-per-day-per-branch that this
   > section says are normal.

   **V15(c) reports whether Odoo 19 permits a cross-method refund at all.** That answer is a blocker,
   not a detail.
3. **`send_payment_cancel` is implemented against a real void endpoint before gate 5 exits.** The
   reference on disk returns `true` while doing nothing (`payment_meps.js:44-47`).

**V15 is a hard blocker on writing any wallet-as-tender code.** Shipping a tender whose refund path
is unverified strands customer money at a counter with a queue behind it, several times a day per
branch.

## D.7 Partial failure, the ordering rule, and the reaper

**Money moves before points, always.** The debit is the **unrecoverable** half of a partial failure;
the earn is the additive, idempotent, reconstructable half. So `settleOrder` applies the tender
before it issues the earn. **That ordering is invisible at runtime six days out of seven, so it is a
source-level invariant: T31 asserts no source file calls `addPoints` on a line preceding
`debitWallet` inside the same `try` block.**

**The irreversible external action happens after the reversible internal one.** For the one window a
single Odoo transaction cannot cover (a PSP capture on the card path):

```
1. AUTHORIZE the card (hold, do not capture)
2. backend.settleOrder(...)     ← ONE Odoo transaction
3. CAPTURE the PSP hold
4. reply
```

Fails at 2 → void the hold, nothing moved. Fails at 3 → a compensating `reverseOrder` **that is
itself keyed** and **whose failure is loud**: a `mail.activity` on the order, an alert, and a row in
the daily exceptions report. Never `catch { /* best-effort */ }`. Fails at 4 → the retry hits the
unique index and gets the same result with `already: true`. **T21b:** in every route body,
`indexOf('settleOrder') < indexOf('capture')`, or neither appears.

**`cron_almond_reconcile`, every 10 minutes, seven jobs, each idempotent, each reporting a count into
the daily branch report:**

1. Resolve deferred pad claims (§D.4), enforcing the per-till daily cap **here**.
2. Re-drive BFF idempotency entries whose lease expired, using the same `op_key`.
   **Skips `source='migration'` rows entirely** — see the state note below.
3. `probeWrite` every `indeterminate` op and resolve it; **only a definite `not_applied` — a state
   the probe has transitioned the row into — triggers a compensating credit.**
4. Quarantine anything syncing >7 days after `date_order` (doc §7.4 Layer 4).
5. **Balance:** assert `loyalty.card.points == Σ(that card's applied ops)` on a rolling 1/24th of
   cards per hour, raising on any diff. Valid **only because §A.7.4 closes the ledger**; if V18 says
   closure is unachievable, this job is replaced by the bounded `loyalty.history` reconciliation
   described there — not weakened.
6. **Issuance ceiling:** per-till daily issued points against
   `almond_loyalty.till_daily_issuance_cap`; crossing it is an **immediate alert**, not a report
   line (§B.5).
7. **Issuance floor:** zero issued rows on a trading day, or issuance below 20% of the trailing
   7-day median, naming `services/earn.py` and the sync issuer (§A.5).
8. **Tender ↔ op:** every `applied` or `reserved` wallet op has exactly one `pos.payment` on a
   validated order with the same uuid, **and every such `pos.payment` has exactly one op** — both
   directions. This is what catches §A.7.3(c)'s lost response; nothing else in the design can see it.
9. **Reservations:** release `reserved` debits past their lease. **Releasing an unconsumed hold is
   additive**, which is why it is exempt from the rule below.
10. **Ledger agreement:** per card, `Σ(applied ops)` against `Σ(loyalty.history)` per programme —
    the check that catches the migration's opening credit being written to one ledger and not the
    other (§E.1 step 3).

> **The one rule the reaper must not break:** a **DEBIT** op stuck `pending` past its lease is set
> `state='failed'` and **alerted**. It is **never auto-completed**. Automatic completion of a debit
> whose outcome is unknown is how you charge twice. A human reconciles against `loyalty.history`.

> **And the state the reaper must not touch:** `state='staged'` exists precisely because
> `pending` + `direction='credit'` + a dead lease is the takeover branch, and the migration stages
> 47,720 credits for the length of the parallel run. Under the old single-`pending` scheme, job 2
> would have taken them over and **applied the entire opening balance within ten minutes of load** —
> before any gate was signed, while Wafii was still authoritative, letting a member redeem the same
> points in both systems. Gate 5's per-card assertion could not have detected it, because a
> prematurely applied op *satisfies* it.

## D.8 What may proceed offline — the closed list

| Operation | Offline | Authority |
|---|---|---|
| Earn on an identified order | ✅ | doc §7.2 **[verified in doc]**, issued by §B.3's sync override |
| Show rate | ✅ (snapshot) | doc §7.2 |
| Show a balance | ⚠️ **only with an explicit `asOf` label** | doc §7.2 |
| Identify at the pad | ⚠️ **write-only and order-bound**, §D.4 | this document |
| **Enrol** | ❌ | §C.8 — an OTP round trip is not optional and nothing is queued |
| **Spend points** | ❌ | doc §7.3 **[verified in doc]**, enforced by §A.3.3's server-side guard |
| **Debit the wallet** | ❌ | doc §7.2 **[verified in doc]** — *"Monetary balance. Same argument, higher stakes."* |
| **Mint an authorization** | ❌ | this document |
| **Void / refund** | ❌ | §D.6 |
| Manual discount after a failed redemption | ❌ without a manager PIN, and counted | doc §6.3 |

**The queue contains only earn.** Doc §7.4 Layer 5 asks for *"a test asserting no redemption record
can be created without a server round trip, because the day someone 'optimises' redemption into the
queue for latency, this entire section becomes false."* That is **T21**.

---

# E. Migration

Two migrations, and they gate each other.

## E.0 The export contract — settle this before anything else

Every number below depends on a file this repo has never held, and three of the review's fatal
findings are downstream of assuming its shape. **The only description of the source is
`docs/LOYALTY-WAFII-LIVE-AUDIT.ar.md:3`**, which lists the export's columns as *"الاسم، الهاتف،
تاريخ الميلاد، الشريحة، النقاط، الإنفاق التراكميّ"* — name, phone, birthdate, tier, points,
cumulative spend.

**Three things follow, and they are preconditions, not details:**

| # | Precondition | Why, and what happens if it is not met |
|---|---|---|
| **E0-a** | **A stable member identifier column.** The described export has **none**. `visit_id` — the key the brief proposes, unique across 171,293 rows — belongs to the **transaction log**, not to the member table; `tools/loyalty_measure.py` and `tools/loyalty_audit_live.py` are both live-Odoo XML-RPC tools and neither reads a Wafii file at all. | Absent one, the key is `sha256(normalized_phone)` and `almond_wafii_key` holds that hash. A **row ordinal is not stable across re-exports** and a re-run would duplicate. `wafii:<visit_id>` is **removed from §A.8's live namespace** and reserved for a future history replay, if a transaction export carrying that column is ever in hand. |
| **E0-b** | **Two named exceptions resolved in writing, before the batch runs.** `LOYALTY-WAFII-LIVE-AUDIT.ar.md` §6 records **1 duplicate phone** and **0 members with no phone**; `LOYALTY-DECISIONS.ar.md:204` records **154 non-normalizable numbers** and `:453` makes *"سلوكٌ مُعرَّفٌ للرقم المكرّر والـ154 غير القابلة للتطبيع"* an explicit **condition** attached to copying 47,720 records into a second system. | A phone key merges the duplicate pair and cannot key the 154. The duplicate needs a signed resolution (merge, or two members with a disambiguating rule); the 154 need a separately keyed, manually reconciled list. `:461` additionally flags the 154 itself as **awaiting re-derivation**. |
| **E0-c** | **A final export taken INSIDE the cutover window, with a recorded SHA-256 and an export timestamp** — plus either a Wafii-side write freeze for that window or a delta export keyed identically. | The September file was taken before a multi-week parallel run during which Wafii keeps earning and redeeming. Every Wafii earn between export and flip is **lost**; every Wafii redemption in that window is **double-credited**, because the loaded balance is the pre-redemption one. **Nothing in any gate can see this**, because gate 3 reconciles against the export's own total — it proves the loader parsed the file, not that the file matches the live system. **If the owner cannot obtain an export on demand, that is a stop condition on the cutover, not an operational detail** (O-1). |

> **The brief's `26 invalid phones` is the 2026-active figure.** The migration loads all 47,720, so
> the base-wide number governs: **154**, awaiting re-derivation. Sizing the branch remediation task
> at "26 people over 9 branches ≈ 3 per branch" understates it by ~6×.

## E.1 Wafii → Odoo

**Step 0 — probe.** VERIFICATION LIST. **Nothing below is designed until V2 has an answer.**

> **The wrong way, named so nobody proposes it:** create 47,720 `loyalty.card` rows with
> `points = <balance>`. If `points` is a plain stored Float **[STOCK — must probe]** Odoo accepts it
> in silence and the result is a balance with no ledger row, no provenance and no reconstruction —
> the "imported number nobody can explain". If `points` is **computed** from `loyalty.history`, the
> write is discarded or recomputed away, **which is worse because it looks like it worked.**
> `tools/loyalty_audit_live.py`'s `Odoo.fields()` already requests the `store` attribute, so the
> instrument needs no change.
>
> **And "skip the write entirely" is not the answer under the computed branch.** An earlier draft
> said that; it would have left the module writing only an `almond.loyalty.op` row and **never a
> `loyalty.history` row**, so the computed balance would read **0.00 for all 47,720 members** and the
> entire clean liability would disappear at cutover with the gates still green. **V2 returning
> "computed" is a declared STOP: the migration is redesigned around `loyalty.history` as the ledger
> of record, not patched.**

### Step 1 — programmes before members, and search before create

Resolve or create `almond_points` and `almond_wallet` with their rules, rewards, discount products
and accounts per §A.3. **Search first** (§A.1): Odoo has traded since January 2026 and V4/V6 both
sample live stored-value transactions, so a programme may already exist. If one does,
`ir.config_parameter` points at **it** and its existing cards are inventoried; creating a second
points programme next to a live one strands every card on the first.

**Assert `almond_followers_guard` is installed (V21).** It exists because loyalty-card and POS-order
creation auto-subscribe chatter followers — *"~10–15k dead `mail.followers` rows per trading day"* —
and `integrations/almond_followers_guard/models/loyalty_card.py:8-12` forces
`mail_create_nosubscribe=True`. **47,720 card creations in one batch does a year of that damage at
once**, and a migration that bypasses the ORM will not get the guard at all.

**Gate:** a 10-member smoke test through the full loop — top up, earn, redeem, wallet-pay, **void** —
with the resulting journal entries read and **signed off by whoever owns the balance sheet.** §A.3 is
an accounting claim and it is verified by an accountant.

### Step 2 — partners: match, then load

`res.partner` in batches of ~2,000, phone normalized to E.164 by a Python reimplementation of
`bff/src/auth/otp.ts:normalizePhone` **tested against the same vectors**, each row carrying an
external id `__almond_wafii__.member_<wafii_key>` in `ir.model.data`
**[STOCK — must probe at this volume]** V22 — Odoo's own idempotency mechanism, so a re-run updates
rather than duplicates — plus `almond_wafii_key` with its unique index as a queryable second belt.

**A match pass runs first, and its absence was a fatal defect.** Odoo went live at the start of 2026
and already holds partners who transact; `tools/loyalty_measure.py`'s section 1 is written to measure
*"share of `pos.order` carrying a partner who holds a POINTS-programme `loyalty.card`"* against live
data. A blind create keyed only on a **new** external id gives those members a **second identity, a
second card and a split balance**, and gate 5 — which checks duplicate `(program_id, partner_id)` —
**cannot see two partners.**

```
normalize phone  →  resolve against existing res.partner
                 →  MATCH:    write almond_wafii_key + the external id onto the EXISTING record
                 →  NO MATCH: create
                 →  MULTI:    quarantine the row; never pick one
publish the collision count as a pre-flight report, before the batch runs
```

- The **non-normalizable phones (E0-b: 154, re-derived)** load with `phone = NULL` and
  `almond_phone_unusable = True`. **Never a fabricated number** — a synthesised identifier in a
  payment system is a liability with a plausible face. **State the counter procedure for them
  explicitly:** with a NULL phone they are unreachable by `findByPhone`, by the pad and by the OTP
  rung, so they have **no counter identification route at all** — they are served by the app or by a
  manager-initiated back-office correction (§C.8's gate), and they keep their old terms per ق‑11.
- The **members with no name (47.9% base-wide)** load with `name = NULL`, not `"Member"`. A missing
  name is a fact about the member, not a data error.
- Both lists get a named owner.
- **ق‑11's precondition is a gate on this step, not a footnote:** `LOYALTY-DECISIONS.ar.md:453`
  makes the copy conditional on *"بعد تنفيذ الحذوفات داخل Wafii، وبأعمدةٍ محصورة"* — the deletions
  executed inside Wafii first, and a restricted column set. The batch refuses to run until the owner
  confirms both.

### Step 3 — the opening balance is a ledger movement, never a balance write

One `almond.loyalty.op` per member on the points programme, **plus one `loyalty.history` row in the
same transaction**:

```
op_key       = 'migration:<batch_id>:<wafii_key>'         -- UNIQUE (§A.8)
source       = 'migration'
direction    = 'credit'
auth_kind    = 'system'                                    -- legal: it is a credit
program_id   = the points programme
amount       = the member's reconciled clean opening balance, IN INTEGER POINTS
declared_amount = the member's RAW balance, in integer points
state        = 'staged'                                    -- NOT 'pending'  (§D.7)
batch_id     = <batch_id>
wafii_key    = <sha256(normalized_phone) or the export's own key, per E0-a>
as_of        = the export timestamp
note         = 'رصيد افتتاحي من وفيّ — Wafii opening balance as of <date>'
```

**Why the `loyalty.history` row is not optional.** `almond.loyalty.op` is the module's ledger;
`loyalty.history` is the one `bff/src/backend/odoo.ts:13` maps `getHistory` to, and the one
`settle_order` step 10 writes for post-cutover earn. Without an opening row there, **a member's
history shows only post-cutover movements against a balance that includes their entire pre-cutover
credit, with no explaining row** — which is precisely the "imported number nobody can explain",
relocated to the one surface a customer disputes a balance on. Reconciler job 10 asserts the two
ledgers agree per card.

**`state='staged'`, and the reason is in §D.7.** These rows sit through the entire parallel run.
Under a single `pending` state the reaper's *"dead lease, `direction='credit'` → take it over"*
branch matches every one of them and applies the whole opening balance within ten minutes.

**The card's `points` is the sum of its ledger, not an input.** If V2 says plain-stored, the write
happens **at the flip** (step 9), not at load, and the in-transaction assertion is

```
loyalty.card.points == Σ(that card's ops in state IN ('staged','applied'))
```

An assertion over `applied` alone is arithmetically incapable of firing at load time — Σ(applied)
is 0 for every card — so it either fails for all 47,720 or passes vacuously for all 47,720,
depending on how it is read. **Defining it over `('staged','applied')` is what makes it a check
rather than a formality.**

### Step 4 — which balance: load the clean figure, provision the expected cost

> **Disagreement with brief §5.** *"Balance sheet corrected to 17,166 JOD carried"* conflates two
> numbers doing two different jobs.
>
> - **The reconciled clean balance goes onto the cards.** It is what members can actually present at
>   a till. Loading less silently confiscates points customers hold — Dunkin' 2022, doc §2 row 7.
> - **17,166 JOD is the accounting provision** — `LOYALTY-DECISIONS.ar.md` ق‑12: the clean balance
>   weighted by the measured 38.2% redemption rate. It belongs in the balance-sheet entry, **not in
>   `loyalty.card.points`.**
>
> Loading 17,166 onto the cards under-issues by **~27,763 JOD across 47,720 members**, invisibly,
> discovered one customer at a time at the counter.

**And the clean figure is not 44,929 either — it is 44,929 plus the 31 anomalous accounts that are
NOT frozen.** `LOYALTY-MEASURED-TRUTH.ar.md` §3.2 derives clean = 4,492,915 points by subtracting
**all 33** anomalous accounts from raw. ق‑12 then rules that only the **two frozen** accounts have
their visible balance zeroed and *"أمّا الـ31 الباقية فيبقى رصيدها ويُصرَف"*. So:

```
loaded_points = clean_points_excluding_all_33  +  Σ(points of the 31 non-frozen anomalous accounts)
```

**Every one of those integers must come from the E0-c final export, not from this document**, and
that is not pedantry — the repo carries **two different raw totals** (32,881,625 in
`LOYALTY-MEASURED-TRUTH.ar.md` §3.2 vs 32,881,677 in `LOYALTY-WAFII-LIVE-AUDIT.ar.md` §3, a
**52-point** difference), **two different clean totals** (4,492,915 vs 4,479,832), and an **explicitly
unresolved 275-point discrepancy in the anomalous account itself** (28,342,875 vs 28,343,150 —
`LOYALTY-DECISIONS.ar.md:461`, listed among *"ثلاثة أرقامٍ ما زالت تنتظر إعادة اشتقاق"*).

**A zero-tolerance gate cannot be built on a number the repo says is still open.** Gate 3 reconciles
in **integer points against one checksummed file**, never in rounded JOD, and **the 275-point
discrepancy is settled before the batch runs.**

### Step 5 — the anomalies: gate on set membership, not on a count

An earlier draft set `migration_max_opening_jod = 500` with `EXPECTED_EXCEPTION_COUNT = 2`, on the
belief that *"the two anomalies hold ~141k each."* **That is wrong against this repo's own audit and
the batch would abort on every run:**

- `LOYALTY-WAFII-LIVE-AUDIT.ar.md` §2 names **one** account, `0795****89`, holding **28,343,150
  points = 283,432 JOD (86.2% of all programme points)**, plus *"**32 حساباً آخر** بنسبٍ مستحيلة
  (>20 نقطة/دينار) … مجموعها 45,560 نقطة (456 ديناراً)"* — so **no single one of those 32 can exceed
  456 JOD**, which is below a 500 JOD ceiling.
- The loader would therefore catch **exactly 1** row, `count != 2`, abort every time, and the only
  escape is editing the constant — which is exactly the gate-defeating move the gate exists to
  prevent.
- Worse, the 33 were selected by a **ratio** test (>20 points/JOD) while the gate is an **absolute
  JOD ceiling**. Even with a corrected count the two filters do not select the same population, so a
  count comparison is not evidence of anything.

**[DECISION] Carry the exception set, do not infer it.**

```
migration/anomalous_accounts.csv     — checked in: phone_hash, points, cumulative_spend,
                                       points_per_jod, frozen(bool), decision, decider, date
                                       — 33 rows, 2 of them frozen per ق-12
--approve-exceptions <path>          — passed EXPLICITLY; the batch will not run without it

The loader re-applies the SAME ratio test that produced the list (points ÷ cumulative_spend > 20)
and asserts the flagged set EQUALS the checked-in set exactly, reporting any symmetric difference.
A non-empty difference ABORTS: the distribution has moved since §3.2 was measured, and nobody
should proceed on a stale reading.
```

Four independent gates, because one is a hope:

1. **Programme separation.** It is a *points* balance, so even in the worst case it lands on
   `almond_points`, never on `almond_wallet`. It can never become customer cash by accident — that
   is what the two-programme decision buys.
2. **The set-membership assertion above.**
3. **The signed file.** Each row names its finding, decision, decider and date. **The two frozen
   accounts load as `state='quarantined'` ops with `amount = 0`, `declared_amount = <raw>`, and zero
   effect on `card.points`**, plus `almond_loyalty_blocked = True` on the partner (§A.4), so the
   evidence survives in Odoo and the balance does not. *"Never redeemed" is evidence, not
   authority*; silently dropping the rows destroys the audit trail as surely as loading them destroys
   the balance sheet.
4. **The other 31 load normally.** One of them holds 352 points (3.52 JOD) which is *above* the
   measured median redemption of 3.50 — an ordinary reward. A blanket ceiling that zeroes everything
   above it silently confiscates from **31 real customers to save 456 JOD**, and 456 JOD is cheaper
   than one dispute at a till.

**And the excluded figures stay inside the ledger:**
`Σ(applied.amount) + Σ(quarantined.declared_amount) = the export's raw total` reconciles **exactly**,
rather than "exactly, minus a CSV somebody has to find."

### Step 6 — the rate rides in the same batch, derived from the TIER column

**[DECISION] `almond_earn_rate` is derived from the export's `الشريحة` column**, using the mapping
`LOYALTY-WAFII-LIVE-AUDIT.ar.md` §4 measured against **160,672 earn rows with zero rows outside 0.5
points**:

```
Starter → 4      Silver → 6      Gold → 8      Platinum → 10
```

**Not from the transaction rows.** An earlier draft derived the rate from *"the member's observed live
rate"* in the earn rows. Only **23,812 members ever transacted** against 47,720 in the member table,
and **8,944 (18.7%) registered and never purchased at all** — so roughly half the base has no earn
row and no derivable rate, and the "exception list" the draft sized at two signed entries would hold
~24,000. The tier column covers 100% of rows and is the same fact measured from the other side.

- **Cross-check, gated:** for the 23,812 who do have earn rows, the derived rate must match the
  observed rate; **the mismatch count is a gate** with a signed threshold, not a log line.
- **A null or zero rate is a hard batch failure, not a default.** §A.5 sets
  `reward_point_amount = 0`, so a member left at `almond_earn_rate = 0` earns **nothing**, and §A.5's
  "zero issuance" alert cannot fire because the rest of the base earns normally.
- `almond_earn_rate_source = 'wafii_migration'`, `almond_earn_rate_set_on` = the export date,
  `almond_earn_rate_ref` = the batch id. **The rate is derived from data, never typed** — a rate
  typed by hand for 47,720 members is 47,720 opportunities to be wrong.
- **A documented, ticketed, time-boxed correction path exists** for a rate whose source is
  `wafii_migration`. The `@api.constrains` raises on any lowering, and rollback is total only until
  the first live earn (step 9) — so **without an explicit correction path, a migration-time error in
  the rate becomes a permanent liability.** The path: steward group, a ticket reference in
  `almond_earn_rate_ref`, a 30-day window from cutover, and a report of every use.
- **Acceptance test:** raise a test member 4 → 6 and assert the column moved and the next earn row
  paid 6.

### Step 7 — the wallet starts at zero, after it is checked

**Wafii carries no stored value.** The migration therefore creates **0.00 JOD of customer cash**,
which removes the "promotional liability becomes customer credit" risk from the migration entirely
and relocates it to ongoing aggregation, where the defence is the `program_id` filter and **T24**.

**But "the wallet starts at zero" is an assertion about Odoo, not about Wafii, and it must be
checked.** Odoo has traded since January 2026 and V1/V4 probe for `'ewallet'` and `'gift_card'`
programmes. Before this step asserts zero, the loader **reads and reports every existing
`loyalty.card` balance on any `'ewallet'` or `'gift_card'` programme** on the instance. A non-zero
total is not a blocker but it is a finding with an owner, and it must not be discovered after the
flip.

### Step 8 — six gates, all green, signed, in the cutover window

1. **Per card:** `loyalty.card.points == Σ(that card's ops in ('staged','applied'))` for all 47,720,
   asserted **in the load transaction**; and **re-run over `applied` alone across all 47,720 after
   the flip and before the till writes.** The repair wizard
   (`wizards/almond_loyalty_repair.py`) recomputes and diffs.
2. **Per member — split into a gate and a report.** The **gate** is narrow and satisfiable: the
   opening op's `amount` equals the E0-c export's balance column for that member, exactly, for all
   47,720. The **flow reconstruction is a reported artifact, not a gate**: per-member balance vs
   reconstructed net flow, with the unexplained residual carried as the named **23,395 JOD**
   figure that `LOYALTY-DECISIONS.ar.md:221` already requires be disclosed as an unmatched component,
   and the per-member rows attached for the finance owner.

   > **Why it cannot be a gate.** `LOYALTY-MEASURED-TRUTH.ar.md` §3.2 states plainly that
   > *"52٪ من الالتزام المعلَن لا يسنده أيّ تدفّق مسجَّل"* — the log is left-truncated at 2023-12-31
   > and the likely explanation is pre-2024 accumulation, *"لكنّه غير مُثبَت"*. A blocking gate that
   > must be green before the till writes would be red for roughly half the book, and the pressure at
   > that moment is to add a tolerance — which this document forbids two gates below.

3. **Fleet, in integer points against the E0-c checksummed file:**
   `Σ(applied) + Σ(quarantined.declared) == the export's raw total`, per programme, and the gap to
   the loaded clean figure is explained by **exactly** the named exception set — not approximately,
   not within a rounding tolerance. A gate that accepts a tolerance here accepts an unexplained
   283,432.
4. **No `almond.loyalty.op` row exists with `auth_kind != 'system'` before cutover.** If one does,
   something is already spending and the parallel run is not a parallel run.
5. **`SELECT program_id, partner_id, count(*) FROM loyalty_card GROUP BY 1,2 HAVING count(*) > 1`
   returns zero rows** — V3's check, **run against the loaded data**, not the empty instance — **and**
   `SELECT phone, count(*) FROM res_partner WHERE phone IS NOT NULL GROUP BY 1 HAVING count(*) > 1`
   returns zero rows, which is step 2's match pass proving itself.
6. **Gate 0, run immediately before the flip:**
   `SELECT count(*) FROM almond_loyalty_op WHERE source='migration' AND state <> 'staged'` returns
   **zero**. Anything else means a reaper or a retry path touched the batch.

Plus, if V5b passed and the accounts were remapped: **7.** the trial balance shows
`2310 Customer stored value` equal to the sum of wallet card balances to the fils, and it becomes a
nightly cron.

Ship all of them as a **signed migration report artifact**, and re-run 1, 3, 5 and the step-2
collision report nightly for the parallel-run period.

### Step 9 — one order, one window, and the parallel run that does not move the counter

```
E0 preconditions signed
  → probes (V1, V2, V3, V21, V22 at minimum)
  → programmes  → partners (match, then load)  → rates  → opening ops (STAGED)
  → gates 1–6 signed
  → FLIP: write loyalty.card.points from Σ(ops), move 'staged' → 'applied', in ONE transaction
  → gate 1 re-run over 'applied' across all 47,720
  → TILL CUTOVER — the SAME window
```

**There is exactly one sequence.** An earlier draft carried two: §E.1 said "the flip and the till
cutover are one window" while §E.2 gated only the *wallet* wave on the migration gates and put the
till cutover a wave earlier — under which **the till writes earn into Odoo against cards with no
opening balance**, and every member's visible balance collapses to what they have earned since. §E.2
below is corrected to match.

**Wafii stays authoritative until the flip**, and **the counter does not change during the parallel
run.** Changing the counter and the data on the same day means every discrepancy has two candidate
causes. So: cashiers keep using Wafii exactly as today; Odoo receives the same transactions through
the POS and computes what it **would** have granted; and a **nightly per-member diff on points
granted / spent / balance produces named rows with owners, not a percentage.** A diff expressed as a
percentage is a diff nobody acts on.

**Rollback** = delete the batch by `batch_id` (a real indexed column on the op, §A.7.2 — an earlier
draft called for this while the model had no such field, leaving `op_key LIKE 'migration:<batch>:%'`
as the only implementable form) plus the `ir.model.data` external ids. **Total only while no member
has earned or spent since**, which is why the flip and the till cutover are one window and not two.
Priced: at ~201 identified txns/day × 0.404 JOD, a week of wrong-rate issuance is ~570 JOD; at
411/day, ~1,160 JOD. **The expensive rollback is not the points, it is the balances** — a wrong
opening balance across 47,720 members is discovered one customer at a time and cannot be corrected
quietly.

**Also probe before the flip:** `loyalty.card.code` generation at 47,720 rows — stock generates a
random code; confirm a unique constraint and check for collisions (**V23**). **A code collision in a
stored-value system is a wallet that answers to two people.**

## E.2 `mock` → `odoo`

The switches exist and are the migration plan — `packages/shared/src/config/index.ts:6` (`DATA_SOURCE`)
and `packages/shared/src/integration/index.ts:21-27` (`enabled.*`) — **but neither can express a wave
today**, and saying "do not redesign them" would have left two lines of prose standing in for the only
mechanism that gates money going live:

- `enabled.{loyalty,wallet,gift,pos,delivery}` are **five aliases of one expression**
  (`config.DATA_SOURCE === 'odoo'`); the comment claims each can be turned on independently and there
  is no input that does it. **Fix: real per-system env inputs.**
- `bff/src/backend/index.ts:8` selects the backend from the **BFF's own** `DATA_SOURCE` and never
  consults `integration.enabled` at all. **Fix: `createBackend()` becomes a switch over the widened
  union, and reads the per-system flags.**
- The BFF union is `'memory' | 'odoo'` with a runtime default of `'memory'`; shared is
  `'mock' | 'odoo'`. **Fix: `'mock' | 'shadow-read' | 'odoo'` on both, default changed in the same
  commit.**

**Add one file: `bff/src/backend/shadow.ts`** — `createShadowBackend(primary, secondary)`, **read
diffing only.**

| Wave | Mode | Reads | Writes | Gate to the next |
|---|---|---|---|---|
| 0 | `mock` | memory | memory | **T15–T23, T30–T35 green against `memory`** — the invariants are cheaper to establish on the mock, and they then hold the Odoo adapter to them |
| 1 | `shadow-read` | memory answers | memory | Odoo reads performed and **diffed**, never returned. 7 days at <0.1% divergence on `getSelf` / `getBalances` |
| 2 | **§E.1 in full** | — | — | **gates 1–6 signed; the flip and the till cutover in ONE window** |
| 3 | `odoo`, `enabled.loyalty` + `enabled.pos` | Odoo | Odoo | earn live, additive and idempotent; **this is when the second writer appears**, and it is the same window as wave 2 |
| 4 | `enabled.wallet` | Odoo | Odoo | **money.** Gated on §E.1's gates **and** V15 **and** a working `send_payment_cancel` |

**There is no `shadow-write` wave.** An earlier draft had one — memory reads, writes to **both** —
and it contradicts this document's own rule that *two authoritative writers on a money path is the
defect, not the harness*. It also could not have worked: every mirrored `spendPoints` would have hit
a zero card and raised `insufficient_points`, making its own "zero balance divergence" gate
unreachable. **Reads are diffed; writes go one place.**

**`enabled.gift` stays `false`. Gift cards are out of scope for this round, in writing.** The app
already ships `giftSend` / `giftSent` / `giftRedeem` (`packages/shared/src/integration/index.ts:63-66`)
and the brief says the app has stored value — but this design creates **no gift programme, no gift
liability account, no gift key namespace and no gift gate**, and flipping a wave that has none of
those is how customer cash goes live unattended. Three consequences, all deliberate:

1. The app's gift endpoints stay on the standalone loyalty server until a gift round happens.
2. §E.1 step 7 **reads existing `gift_card` balances before asserting zero**, so an existing gift
   liability in Odoo is a finding rather than a surprise.
3. A `gift:` prefix is **reserved** in §A.8's namespace and in `SOURCE_KEY_PREFIXES` / T24b, so a
   later round does not have to change a test to add a leg.

**Flip order is `loyalty` before `wallet`, always.** Get the mechanism wrong on points and you
overpay a promotion; get it wrong on the wallet and you have lost somebody's money — 586 accounts
hold ≥10 JOD.

---

# F. Tests

New file `bff/test/seam.test.ts` unless noted, in the style of `bff/test/earn.test.ts`'s
T7/T7b/T7c/T8: **structural invariants over the source tree.** Extract `collectSources()`,
`stripComments()` and `isExempt()` from `earn.test.ts:363-408` into `bff/test/lib/sources.ts` and
import them from both; the existing tests keep their exact assertions.

## F.0 First, fix the walk — because otherwise every earn test in this round is theatre

`earn.test.ts:340` sets `ROOTS = ['almond-app','almond-web','bff','packages']`; `:387` collects only
`/\.tsx?$/`. **T7 will not "be made to lie" when the Odoo Python and POS JavaScript evaluators
appear — it will SILENTLY KEEP PASSING while two unguarded implementations exist.** That is the
hazard `earn.test.ts:499-507`'s own "the walk actually looked at the files it claims to guard"
self-check was written to prevent.

```ts
// bff/test/lib/sources.ts
const ROOTS = ['almond-app', 'almond-web', 'bff', 'packages', 'integrations'];
const EXT   = /\.(tsx?|py|js)$/;

// stripComments MUST be extension-dispatched. It is currently applied unconditionally
// to every collected file (earn.test.ts:387), and it takes only `lines: string[]` with
// no language parameter (:361). Adding a '#'-to-end-of-line branch to that single
// function BLANKS MOST OF THE TSX IN THE REPO — every hex colour literal truncates at
// the '#', and they are pervasive: almond-app/components/ui/Button.tsx:55,71,89,91;
// almond-app/components/loyalty/Cup.tsx:32,86,87,98,99,100;
// almond-app/components/cart/PickupInfo.tsx:35,43,66,75 — plus every SVG url(#…),
// every private #field, every fragment URL. T7, T8 and T24 would then stop seeing the
// code they guard and PASS. The section written to stop tests passing silently is the
// thing that makes them pass silently.
export function stripComments(lines: string[], lang: 'ts' | 'py'): string[]
//   lang === 'py' → '#'-to-end-of-line, plus TRIPLE-QUOTED STRING handling: an
//   earn.py docstring naming POINTS_PER_JOD would otherwise be a T7 offender.
```

**T27 — the walk reaches what it claims to guard, AND the stripper preserves code.** The direct
analogue of `earn.test.ts:499`, with the canary the original lacked:

```ts
const paths = new Set(sources.map(f => f.path));
expect(paths.has('bff/src/backend/odoo.ts')).toBe(true);
expect(paths.has('bff/src/routes/pad.ts')).toBe(true);
expect(paths.has('integrations/almond_loyalty/models/res_partner.py')).toBe(true);
expect(paths.has('integrations/almond_loyalty/services/earn.py')).toBe(true);
expect(paths.has('integrations/almond_loyalty/static/src/app/earn_formula.js')).toBe(true);
expect(sources.length).toBeGreaterThan(140);

// The canary: comment-stripping did not eat the code.
const btn = sources.find(f => f.path === 'almond-app/components/ui/Button.tsx')!;
expect(btn.code.join('\n')).toContain('#');            // hex literals survive
const earnPy = sources.find(f => f.path.endsWith('services/earn.py'))!;
expect(earnPy.code.join('\n')).not.toContain('ALMOND_STRIPPER_CANARY');  // a '#' comment in that file
```

**Write this one first.** A walk that silently found nothing passes every assertion above it.

## F.1 The suite

**T15 — the seam declares authorization structurally, and the partition is exhaustive.**
Parse `interface Backend` from `bff/src/backend/types.ts`. Assert:
1. every method is in exactly one of `READERS` / `MUTATORS` / `PROBES` (§B.2.1), **and the partition
   is exhaustive** — a new method in none of them **fails the build until a human classifies it**.
   Every other seam test in every draft enumerated a hardcoded list; the day someone adds a fifteenth
   `Backend` method, all of those pass while the new method carries no key and no auth. This is the
   only construction that survives code nobody has written yet, and it costs ten lines.
2. every name in `['debitWallet','spendPoints','redeemSubscriptionDrink','activateSubscription']` has
   a **first** parameter matching `/^\s*auth:\s*SpendAuthorization\b/`; `reverseOrder` has a first
   parameter matching `/^\s*auth:\s*StaffAuthorization\b/`.
3. none of those five signatures contains `/\bid\s*:\s*string\b/`.
4. every method in `READERS` returns `Fresh<…>` and has **no** `ctx: WriteContext`; every method in
   `MUTATORS` and `PROBES` **has** one.
5. `AUTHZ_BRAND`, `STAFF_BRAND` and `OTP_BRAND` are each declared `declare const` and appear in **no
   `export`** statement anywhere in `bff/src/` or `packages/`.

**T16 — no module can spend without an unforgeable authorization.** *(brief §6 required test #1)*
1. **Static:** every call site matching
   `/\.(debitWallet|spendPoints|redeemSubscriptionDrink|activateSubscription)\s*\(/` has as its first
   argument an identifier **assigned in the same file** from
   `/\b(requireAuthorization|consumeGrant|mintFrom[A-Za-z]+)\s*\(/`. An object literal, a member id,
   a `req.body` field, or a bare variable of unknown provenance is an offender. **The walk includes
   any file that issues an HTTP POST to a `walletCharge` / `redeemReward` / `walletTopup` endpoint**,
   not only `Backend` call sites — otherwise `almond-app/services/loyalty.service.live.ts:31-32,44-45`
   is invisible and the seam is enforced only where it was already safe.
2. **Static:** `bff/src/authz/grant.ts` is the only file containing `AUTHZ_BRAND`;
   `bff/src/authz/staff.ts` the only one containing `STAFF_BRAND`; `bff/src/auth/otp.ts` the only one
   containing `OTP_BRAND`. **Three files, three symbols, asserted by count.**
3. **Type-level:** a `@ts-expect-error` fixture compiled by `tsc --noEmit` in CI; the build fails if
   the `@ts-expect-error` becomes *unused*, i.e. if a signature ever loosens.
4. **Runtime:** `expect(() => backend.debitWallet({ memberId:'demo', scope:'wallet' } as any, 100, r, ctx))
   .rejects.toThrow('unauthorized')` — **a hand-cast literal is rejected at verification time,
   because `as any` compiles.** Same for a hand-built `OtpProof` at `enrolByPhone`.
5. **Runtime:** a grant is single-use (a second call with the same `grantId` → `grant_already_consumed`);
   an expired grant rejects; a `scope:'points'` grant rejects at `debitWallet`; a `maxFils: 1000`
   grant rejects a 1001-fils debit.
6. **Runtime, cross-account:** `mintFromPosToken(myToken)` yields `auth.memberId === me`, and there
   is no code path by which a different id reaches the debit — the type-level fact asserted at
   runtime.
7. **Runtime, multi-leg:** `settleOrder` with two `spendAuths` sharing one `grantId` is **rejected**,
   and the rejection comes from the **database** (`UNIQUE(grant_id_ref)`), not only from the type.
8. **Runtime, token replay across instances:** the same token string verified against **two
   independently constructed BFF instances** yields at most **one applied movement**. This is the
   test that would have caught keying single-use on the grant id instead of the token `jti`.

**T17 — every write path carries a key, and no key is invented server-side.** *(brief §6 required test #2)*
1. **Interface:** covered by T15 clause 4.
2. **Routes:** every `app.post|put|patch|delete(` in a file importing `../backend` lists
   `idempotencyPreHandler` in `preHandler` and `idempotencyOnSend` in `onSend` — **except the checked-in
   `IDEMPOTENCY_EXEMPT` set, which the test asserts exactly**:

   | Exempt route | Reason (one line, checked in beside it) |
   |---|---|
   | `POST /v1/pos/token` | a **mint**: `issuePosToken` produces a fresh `jti` per call and `verifyPosToken` consumes it single-use. Replaying a cached response hands the caller an already-consumed token. |
   | `POST /v1/pos/scan` | a **mint**: the durable single-use key is `almond.loyalty.grant.token_jti` in Postgres, not an HTTP header. |
   | `POST /v1/auth/otp/request` | non-mutating on the `Backend`; rate-limited instead. |
   | `POST /v1/auth/otp/verify` | a **mint**; `enrolByPhone` throws `already_enrolled` on replay. |

   Plus the complementary assertion the empty set was reaching for: **no route that calls a
   `MUTATORS` method may be on the exemption list.** An earlier draft asserted the set was exactly
   `[]` while four such routes exist today — so the test would have failed on day one, or been
   satisfied by breaking a token mint.
3. **The clause that matters:** no line in `bff/src/routes/` matches `/opKey\s*:\s*(?!opKey\()/` —
   **not a literal, not a template, not `randomUUID()`.**
4. **No `anon` bucket:** no key produced by `keyFor` contains the literal `anon` (§B.6).
5. **Odoo adapter:** every function in `bff/src/backend/odoo.ts` calling a write RPC
   (`/\b(create|write|unlink|call_kw\(['"]\w+['"],\s*['"](create|write)['"])/`) has `/\bop_key\b/`
   in its enclosing body.
6. **Runtime:** `POST /v1/wallet/topup` without `Idempotency-Key` → 400 `idempotency_key_required`,
   **enumerated from the router** rather than hardcoded, so a new route is covered the day it is
   added (extends `checkout.test.ts:31`).
7. **Runtime, the one that fails today:** the same key replayed **after the store is reconstructed**
   (simulating a restart) still returns the first response, from **two separate `build()` instances
   with separate stores**.

**T18 — the pad response leaks nothing.**
1. the zod schema for `POST /v1/pad/identify`'s reply is `.strict()` with keys exactly
   `['sessionId','ok']`;
2. **runtime, over a fixture of 200 phones (half members, half not): the set of distinct response
   bodies has size 1 modulo `sessionId`**, every response has the same status code, and **p50/p95 for
   the two halves differ by less than the padded floor**;
3. static: the handler's reply-construction path contains no identifier from
   `['points','walletFils','balance','partnerId','name','phone','hasAccount','memberId','affordableRungs','canRedeem']`.

Failure message: `"the pad became an oracle — see §C.3 step 3"`.

**T19 — no name and no balance reach the pre-authorization surfaces.**
1. `findByPhone`'s declared return type contains `hintDigits` and **no** `name`, **no** `displayHint`;
2. `hintDigits` is exactly two characters and equals the last two of the submitted phone (property
   test over a phone corpus);
3. `getMemberForStaff` is the **only** `Backend` method whose return type includes `name`, and it
   takes a `SpendAuthorization`;
4. **the receipt clause (§C.7):** no route that emits a receipt payload may include `points`,
   `walletFils` or `balance` unless a `spendAuth` is present on the order. A per-ticket **delta**
   (`pointsEarned`) is permitted; a balance is not.

**T20 — identification never writes, and never enrols.**
1. no file under `bff/src/pad/` or `bff/src/routes/pad.ts` calls
   `/\.(enrolByPhone|creditWallet|addPoints|debitWallet|spendPoints|settleOrder|recordSpend)\s*\(/`.
   **`bff/src/routes/pad_enrol.ts` is the single named exception for `enrolByPhone` and nothing
   else** (§C.8) — the exception is checked in, so an implementer reading §D.2's "enrol" row cannot
   quietly build the forbidden call;
2. `findByPhone` in `types.ts` returns a type containing `null` and **no** `Member`;
3. runtime: `POST /v1/pad/identify` with an unknown number, twice, leaves the backend member count
   unchanged. *(This is the test that would have caught "the pad calls `findOrCreateByPhone`".)*
4. **no prefix search exists:** no route handler passes an operator in
   `{'like','ilike','=like','child_of','=ilike'}` on `phone` or `mobile`.

**T21 — the offline queue contains only earn, and every claim names one order.**
*(doc §7.4 Layer 5's own request)*
1. no symbol from `['spendPoints','debitWallet','redeemSubscriptionDrink','mintFromOtp','SpendAuthorization']`
   appears in any file whose path matches `/(offline|queue|sync|deferred|pad_claim)/i`, in **either**
   language;
2. runtime: enqueueing a spend intent throws `offline_spend_forbidden`;
3. Odoo test with the connection stubbed to fail: adding a reward whose `program_id` is the wallet
   programme **raises** and adds no line; **and the same for the points programme** (§A.3.3's server
   guard — an earlier draft tested only the wallet half, which is exactly where the hole was); a
   points earn succeeds and queues;
4. **no two `pos.order` rows carry the same offline claim id** — the partial unique index on
   `almond_pad_session_id` for `offline:%` (§D.4), asserted at the database.

**T21b — capture is last:** in every route body, `indexOf('settleOrder') < indexOf('capture')`, or
neither appears.

**T22 — the idempotency and replay stores survive a restart.**
1. **Behavioural, not lexical.** Both `bff/src/plugins/idempotency.ts` and `bff/src/pos/token.ts`
   export `evict()`, and their entry types carry `expiresAt`; after 10,001 inserts with a 1 ms TTL,
   `size()` is bounded and `get()` on the first key returns `undefined`.
   *(An earlier draft forbade the literal `new Map(` / `new Set(` in those two files. That forbids
   the correct implementation — a bounded TTL store is naturally a `Map` behind an `evict()` — and
   permits the incorrect one, since moving `new Map()` one file away into a helper satisfies the
   regex with no eviction at all. It tested spelling.)*
2. runtime: a `pending` entry past its lease does **not** return `409 request_in_progress`; it calls
   `probeWrite`.
3. runtime: a `done` entry is evicted after TTL; the store is bounded under 10,000 sequential
   distinct keys.
4. **runtime: `usedJti` may only be a cache once the durable key exists** — a test asserts
   `almond.loyalty.grant.token_jti` carries a unique constraint before any test permits `token.ts`'s
   `Set` to be bounded.

**T23 — the spend window rolls off.**
1. static: `addSpend` appears nowhere; no line matches `/windowSpend\s*\+=/` (`memory.ts:78` today);
2. runtime, both backends: 100 orders over 400 days → `getWindowSpend` equals only those inside
   `WINDOW_DAYS`, and **decreases** when the clock advances past the oldest.

**T24 — points and money never share a number.**
1. no expression adds or compares a `points` identifier to a `*Fils`/`walletFils` identifier
   (`/\bpoints\b.*[+\-=<>].*\bwallet/i` and mirror), per-line exemption;
2. **every `read_group` / `search_read` / `search_count` / `sum` whose model is `'loyalty.card'` or
   `'loyalty.history'` has `program_id` within the same statement** (5-line window) — in
   `bff/src/backend/odoo.ts` **and** in `integrations/`. This is the test for the 50× error this repo
   already made (`tools/loyalty_measure.py:826-840`);
3. **no literal programme id anywhere:** no line matches `/program_id\s*[=:]\s*\d+/` outside the
   migration's own data file — ids come from `ir.config_parameter` only;
4. **T24b:** every `opKey` literal or template in `bff/src/` and in the Odoo module matches
   `/^(pos|pad|app|refund|correction|wafii|migration|gift):/`, and the TS prefix set equals
   `SOURCE_KEY_PREFIXES` in `integrations/almond_loyalty/services/source_key.py`, read from both
   files and compared. **One namespace, both writers.** Plus a vector asserting that **two claims of
   the same `reward_id` on one order produce two distinct keys** (§A.8), and that a second partial
   refund of one leg produces a key distinct from the first.

**T25 — the earn base, the clamp, and the budget.**
Golden vectors asserting **both mechanisms**:

| Ticket | Tender | Mechanism | Expected |
|---|---|---|---|
| 20 JOD | 20 JOD wallet | `pos.payment` | earn on **0** |
| 20 JOD | 15 cash + 5 wallet | `pos.payment` | earn on **15** |
| 20 JOD | 5 JOD points reward line | stock reward line | earn on **15**, with **no explicit subtraction in the evaluator** |
| 20 JOD | 5 JOD points reward line | — | **fails** if the evaluator subtracts again (double-netting) |
| 3.50 JOD | snapshot rate 400, partner rate 6 | sync | **clamped to 6** → 21 points, `almond_earn_total` 1400, `almond_earn_honoured` 21, divergence reported (§B.5) |
| 7.16 JOD | order dated before a 4→6 raise, synced after | deferred | pays **4**, from `almond.loyalty.rate.change` (§D.4) |
| 20 JOD | identical top-up through the app and through the till | both | **identical points**; fails if either yields zero (§B.7) |

Plus **the budget assertion, in the unit it was measured in**: the **traffic-weighted mean** accrual
across the vector table's distribution reproduces **0.404 ± 0.005 JOD per identified transaction**.

> **There is no per-row 0.45 JOD assertion, and §A.6.1 says why:** 50.00 JOD × 10 pts/JOD = 500
> points = **5.00 JOD** on one transaction, 11× the figure. A per-row assertion is unpassable while
> the rates are frozen, and the only ways to make it green are deleting it or capping the rates —
> the second of which breaches committee decision §5. The separate absolute per-invoice **fraud**
> cap is asserted only once a human has signed a value, and its JOD equivalent is printed in the
> failure message.

**T26 — the grandfathered rate is raise-only, asserted by outcome.**
A `group_pos_user` session writing `almond_earn_rate: 4` on a member whose rate is 8, and a
`group_almond_loyalty_manager` session doing the same, both leave **the stored value unchanged at 8**
— asserted on the **outcome**, not on whether an `AccessError` was raised. Whether Odoo 19 raises on
a write to an ACL-restricted field or silently drops it from the vals is **[STOCK — must probe]**
(V16), and a test that asserts the mechanism breaks whichever way the probe lands. Plus: only
`group_almond_loyalty_rate_steward` may write; only upward; only with `almond_earn_rate_ref` set; and
a write of `1000`, or of any value outside `{0,4,6,8,10}`, **raises** on the CHECK constraint. Doc
§8.2 item 5 requires this be a test, not a belief about ORM compute semantics.

**T28 — the install aborts without `pos.order.uuid`.**
`post_init` hard assert (doc §8.1). With the field mocked absent, the install **raises and names the
field**. Plus, per §D.5.1: if the probe recorded that the dedup path does not use `uuid`, the assert
additionally requires the module's own `UNIQUE(pos.order.uuid)` to be present. Plus the two boot
assertions §A.3.2 and §A.5 add: `'almond_wallet'` is in `pos.payment.method.use_payment_terminal`'s
selection, and `almond_earn_rate` is in the POS partner load field set.

**T29 — `verifyOtp` has no path that succeeds without a matching stored record.**
*(the highest-priority fix in the whole spec)*
1. **static:** `bff/src/auth/otp.ts` contains no `OTP_DEV_CODE`; `bff/src/config.ts` contains no
   `OTP_DEV_CODE`;
2. **runtime:** `verifyOtp('+962790000000', '123456')` with **no OTP requested** throws;
3. **runtime:** an OTP requested for phone A does not verify for phone B;
4. **runtime:** `requestOtp` generates a value that is not equal across two calls;
5. **rate limit:** 5 failed verifies for one phone in 15 minutes locks the phone for 15 minutes, and
   the lock is counted in the daily report;
6. **boot:** with `DATA_SOURCE === 'odoo'`, a default or empty `JWT_SECRET`, `POS_TOKEN_SECRET` or
   `POS_SCAN_KEY` **aborts startup**. `POS_SCAN_KEY` is in this list because `/v1/pos/scan` skips its
   entire check when the variable is unset (`routes/pos.ts:19`) and that route is being promoted to
   the grant mint.

> A1 is stopped at §C.5 by OTP-to-the-registered-number, and today that step is
> `config.OTP_DEV_CODE` defaulting to `'123456'`, accepted for **any** phone, with **no OTP ever
> requested and no rate limit** (`bff/src/auth/otp.ts:23-24`, `bff/src/config.ts:13`). Test-fixture
> impact: `bff/test/checkout.test.ts:21-23` and `earn.test.ts:611-616` currently verify with the
> literal `'123456'` and must read the requested code from a test hook.

**T30 — no route credits stored value without a settled funding reference.**
1. **interface:** `creditWallet` declares a required `funding: Funding` parameter;
2. **static:** every `creditWallet` call site passes a `funding` whose `kind` is a literal from the
   union, and where `kind === 'psp'` also passes `captureId`;
3. **runtime:** `POST /v1/wallet/topup` without `captureId` → 400; with a `captureId` already
   recorded on an applied op → replayed, credited once.

> `bff/src/routes/wallet.ts:21-22` credits `toFils(amount)` straight from a client-supplied body with
> **no payment reference of any kind.** That is a live free-money path — value **created** with proof
> of nothing — and it outranks all four defects the brief names.

**T31 — money moves before points.** No source file under `bff/src/` calls `addPoints` on a line
preceding a `debitWallet` call inside the same `try` block.

**T32 — a blocked account cannot spend, and no override lifts it.**
Runtime: a member with `almond_loyalty_blocked = True` throws `member_blocked` from `spendPoints` and
`debitWallet` under **every** arm of the authorization union, **including `manager_override`**.
Static: no code path reads the flag and continues.

**T32b — the override budget is one budget.** A points redemption under `manager_override` consumes
`points × 10` fils of `override_daily_cap_value_fils`, and an equal-value wallet debit consumes the
same amount. A branch that has spent its cap on points cannot then override a wallet debit (§C.5.1).

**T33 — compensations are idempotent under a derived key.** Every `creditWallet` / `addPoints` call
lexically inside a `catch` block passes an `opKey` matching `/:compensate$/`, derived from the
request's key. Never `randomUUID()`. `checkout.ts:82` and `subscription.ts:31` fail this today.

**T34 — `already` renders distinctly.** The till/app render path for `Movement` branches on `already`
and produces a different string («سبق خصمه — لا تُعِد» vs «تمّ الخصم»). Asserted at the component
level. An idempotent backend still produces a double-press if the cashier sees the same green tick
twice and concludes the first press failed.

**T35 — every read is dated.** Every method in `READERS` returns `Fresh<…>`; every route that emits a
`points`, `walletFils` or `balance` field also emits `asOf`; and no client component renders a
balance without rendering `asOf` when `stale` is true.

**T36 — the concurrency test the design's own arithmetic demands.** *(new)*
Runtime, against the Odoo adapter on a staging instance: **N concurrent debits with N distinct
`op_key`s and N distinct grants against one card sum to at most the starting balance.** Run at
N = 8. `UNIQUE(op_key)` serialises replays of one key; only the `FOR UPDATE` on `loyalty_card`
(§A.7.3(b)) serialises distinct operations against one balance, and nothing else in the suite would
notice its absence.

**T37 — the reconciler cannot pay twice.** *(new)*
Hold TXN 2 open on an in-flight debit, run `cron_almond_reconcile` job 3, release, and assert the net
movement is **exactly one debit or exactly zero** — never both a debit and a compensation. This is
the test for `probeWrite`'s tri-state and for the `pending → failed` transition (§B.2).

**T38 — the reaper never touches the migration.** *(new)*
Stage 100 `source='migration'` ops with expired leases, run every reaper job, assert all 100 are
still `state='staged'` and no `loyalty.card.points` moved.

## F.2 T7 restated, not deleted — one parameter set, three evaluators, one fixture

Three evaluators are unavoidable under doc §1.4: shared TypeScript, Odoo Python, Odoo POS JavaScript.
The repo invariant *"no module outside shared computes points"* cannot survive that literally. **It
must be restated, and the restatement written down now** — a test weakened at implementation time
because it became inconvenient is exactly how the client/server earn divergence (D2) comes back.

**T7 keeps its static walk unchanged** (`earn.test.ts:430-450`): nothing outside
`packages/shared/src/loyalty/earn.ts` may *declare* the constants. With `ROOTS` extended (§F.0), that
claim now covers `services/earn.py` and `earn_formula.js` too, which is the whole point.

**T7d adds cross-language agreement:**

1. **One fixture:** `packages/shared/src/loyalty/__fixtures__/earn-vectors.json` —
   `{4,6,8,10} × {0, 0.75, 1.75, 7.16, 20.30, 50.00}` invoices × both tax bases × both tender
   mechanisms × cap-binding and non-binding = ≥96 rows of
   `(earnRate, amountJod, taxBasis, tenderMechanism, perInvoiceCap) → expectedPoints`, **plus the
   clamp, deferred-rate and top-up-parity rows from T25**. If O-3 keeps any of the four repo
   promotions, the fixture additionally needs `weekday`, `bonusDay` and `comboPairs` columns and both
   Odoo evaluators need those inputs — including an Amman-clock weekday in Python and in POS JS,
   where `packages/shared/src/lib/ammanWeekday.ts` has no twin today.
2. **Loaded by all three test files:** `bff/test/earn.test.ts`,
   `integrations/almond_loyalty/tests/test_earn.py`,
   `integrations/almond_loyalty/static/tests/earn_formula.test.js`. Every row produces
   `expectedPoints` exactly; CI fails on any drift.
3. **T7d-b — the Python and JS suites read the SAME file, by path:**
   ```ts
   expect(read('integrations/almond_loyalty/tests/test_earn.py')).toMatch(/earn-vectors\.json/);
   expect(read('integrations/almond_loyalty/static/tests/earn_formula.test.js')).toMatch(/earn-vectors\.json/);
   ```
4. **T7d-c — no rate is duplicated.** Both evaluator files reference `partner.almond_earn_rate`,
   `ir.config_parameter almond_loyalty.earn_tax_basis` and
   `loyalty.program.almond_per_invoice_point_cap`, and **neither contains an assignment or a default
   argument whose right-hand side is a bare literal from `{4, 6, 8, 10}`.**
   *(An earlier draft forbade every numeric literal from the fixture's parameter columns. Those
   columns include `0`, which rules out `if x > 0`, indices, `round(x, 0)` and `digits=(6, 2)` — a
   value §A.4 already writes in the same file family. The assertion was unimplementable as stated.)*
5. **T7d-d — the cap is terminal:** in both evaluator files the `min(` line is the last statement
   before `return`, asserted source-level and behaviourally.
6. **T7c's successor:** no file under `bff/src/routes/` calls `computeEarn` or `earnedPoints`; every
   route reports `SettledOrder.earn`.

**Put the reason in the test's own header comment, as `earn.test.ts:411-413` already does for D2, so
the next person does not read the change as a retreat.** The invariant is no longer "one
implementation" — it is **one parameter set and one golden-vector table that all three
implementations are tested against, in CI, from the same file.**

---

# G. Build order — gates, not phases

| # | Gate | Contents | Green when |
|---|---|---|---|
| **0** | **Delete the OTP bypass and fail the mints closed** | `bff/src/auth/otp.ts:23-24`, `bff/src/config.ts:13`; `routes/pos.ts:19` fails closed; boot assertions on `JWT_SECRET`, `POS_TOKEN_SECRET`, `POS_SCAN_KEY` | **T29.** First, because A1's entire defence rests on it and it is a handful of deleted lines |
| **1** | **Fix the walk** | `bff/test/lib/sources.ts`; `ROOTS += 'integrations'`; `EXT += .py/.js`; **extension-dispatched** comment stripping | **T27**, canaries included. Second, because every subsequent structural test is theatre without it |
| **2** | **Probe** | the VERIFICATION LIST, in `tools/odoo_pos_measure.py::q5()/q6()` | results in, **four stop conditions cleared**, V15 answered, **both §A.3.1 estimates in front of the owner** |
| **2a** | **Probe logistics** | **the named target instance, the credential owner, the date, and what happens to the schedule if it does not arrive** — plus the seeded staging fixture for V4/V5/V6 if the instance has no stored-value history | an owner and a date exist. Without this, "probe first" defers four fatal-class unknowns instead of closing them |
| **3** | **The seam** | `SpendAuthorization`, `StaffAuthorization`, `OtpProof`, `WriteContext`, `Fresh<T>`, `WriteOutcome`, `Movement`, `Funding`, `OdooEarnBreakdown` in `types.ts`; `bff/src/authz/{grant,staff}.ts`; `opKey()` + `keyFor()` fix; `config.ts` union + `createBackend()` switch; rewrite `memory.ts`; re-point `loyalty.service.live.ts` | **T15–T17, T22, T23, T30, T31, T33, T35 green against `memory`.** The invariants are cheaper to establish on the mock, and they then hold the Odoo adapter to them |
| **3a** | **Staff identity** | `requireStaff` / `requireManager`, `bff/src/staff/{tokens,devices}.ts`, the per-`posConfigId` till registry | **§C.5.2.** Everything downstream that names a human — the per-employee override cap, `actor_login`, `StaffAuthorization`, the A3 forensic claim — is a promise without it |
| **4** | **The module skeleton** | two programmes; `almond.loyalty.grant` + `almond.loyalty.op` + `almond.loyalty.rate.change` with their constraints; `res.partner` rate field + steward ACL + raise-only constrains + domain CHECK + `almond_loyalty_blocked`; `models/pos_data_loading.py`; **`models/pos_order.py` — the sync issuer**; `models/loyalty_card.py` — the write closure + `expiration_date` guard; `services/earn.py` + `earn_formula.js` + the fixture **with the §B.5 clamp**; `hooks.py` asserts; the README expiry paragraph | **T7d, T24, T25, T26, T28, T32, T32b** |
| **5** | **The spend paths** | `controllers/redeem_confirm.py` + `static/src/app/redeem_confirm.js` + the **server-side reward-line guard**; `pos_payment_method.py` `selection_add`; `controllers/wallet_charge.py` + `payment_almond_wallet.js` **with a real `send_payment_cancel`**; `reverseOrder` | **blocked on V15.** **T21, T21b, T25's tender rows, T36, T37** |
| **6** | **The pad** | `routes/pad.ts`, `routes/pad_enrol.ts`, `pad/{token,devices,sessions,claims}.ts`, the sealed-box offline queue **with the pad↔till local link**, `static/src/app/almond_pad_status.js` | **blocked on V7 and V12, and on the §C.9 accrual ruling for hardware.** **T18, T19, T20, T34** |
| **7** | **Migration** | E0's preconditions signed; the loader; six gates; the checked-in 33-row exception file; the parallel run with the till on Wafii; **flip + cutover in ONE window**; laminated cards for 30 days | gates 1–6 signed, **T38** |

**The ordering is deliberate: the pad is built last, against a backend that already refuses to spend
without a grant, rather than first and then defended.** A public input added to a system that trusts
its callers is not fixable by adding checks to the input.

---

# VERIFICATION LIST

Every **[STOCK — must probe]** claim, its exact probe, **ordered by how much of the design collapses
if the answer is no.** All of it goes into `tools/odoo_pos_measure.py` as `q5()` / `q6()` — that file
already has `env()`, `connect()`, `make_call()` and `has_model()` (`:81-110`), so this is a new
section, not a new tool. **Read-only: `fields_get`, `search_read`, `search_count`, `read_group`
only** — all already in `tools/loyalty_audit_live.py`'s `SAFE_METHODS` (`:103-107`). The two probes
that need a write (V19, V15) run on **staging**, and gate 2a is where that instance is named.

| # | Question | Probe | What collapses if the answer is no |
|---|---|---|---|
| **V1** | Is `'ewallet'` a real `loyalty.program.program_type` on this instance? And `'gift_card'`? | `fields_get('loyalty.program')['program_type']['selection']` — **print every value** | **STOP.** §A.1, §A.3, §A.6, the whole stored-value design becomes `[CUSTOM]` from zero and §A.9's estimate is wrong |
| **V2** | Is `loyalty.card.points` stored-plain or **computed** from `loyalty.history`? | `fields_get('loyalty.card', attributes=['type','store','compute','readonly'])`. `tools/loyalty_audit_live.py`'s `Odoo.fields()` already requests `store` | **STOP.** §E.1 steps 3, 8 and 9 — the entire migration shape. A computed field silently discards a balance write and the gates stay green |
| **V20** | Is `pos.order.uuid` present, non-null and unique on recent orders — **and does the sync path de-duplicate on it?** | `read_group('pos.order',[('uuid','!=',False)],['id:count'],['uuid'],lazy=False)` → any group >1; plus the count with `uuid = False`; plus a **read of `sync_from_ui` / `create_from_ui` on the target source** to confirm the dedup path uses it | **STOP** on null or duplicate. §A.8, §D.5, §D.5.1, doc §8's install abort. **Present-and-unused is the silent case:** every replay double-issues and nothing raises. Doc §7.4 prices it at **~2,300–4,600 JOD/day** |
| **V15** | **Void/refund:** (a) does voiding a stock reward line restore `loyalty.card.points`? (b) on a refund against a custom `pos.payment.method`, negative `send_payment_request` or a separate hook? (c) **does Odoo 19 permit a refund to a DIFFERENT payment method than the original?** | staging: ring, pay, void, read the card and the payments. Reference: `pos_meps_apex/static/src/app/payment_meps.js:44-47` | **HARD BLOCKER on every line of wallet-as-tender code.** §D.6. (c) decides whether the wallet-to-cash wash is available to every cashier from day one |
| **V7** | Does attaching a partner to a `pos.order` that **already has lines** cause `pos_loyalty` to recompute the programmes client-side? | staging: set_partner after two lines; observe whether earn/rewards recompute | **STOP the hardware purchase.** §C.10 — the pad's entire value is that typing happens in parallel with ringing. If not, the pad is worse than the QR it replaces |
| **V18** | Which stock code paths write `loyalty.card.points` on this instance? | enumerate: the reward-claim path, the ewallet top-up rule, the void path, any `ir.rule`-permitted UI write | §A.7.4. Decides whether the ledger can be **closed** and therefore whether reconciler job 5 is a real detector or a false assertion that will be muted |
| **V4** | Do ewallet/gift redemptions post as `pos.order.line(is_reward_line=True)` with **no** `pos.payment`? | for each stored-value programme: `search_read` its reward lines, limit 20; read those orders' `payment_ids`; confirm the tender total excludes the redeemed amount | §A.3, §A.6 and therefore §A.3.2's whole recommendation |
| **V5** | Which **account** does that reward line hit? | `loyalty.reward.discount_line_product_id` → `property_account_income_id` (else `categ_id.property_account_income_categ_id`) → `account.account.account_type` | proves the finance defect is real on this instance rather than argued from the addon design |
| **V5b** | Does Odoo 19 accept a **liability-type** account in `product.template.property_account_income_id`? | `fields_get('product.template')['property_account_income_id']` — **read the domain** | §A.3.1 — **which of two estimates the owner is shown.** Most likely fails; presenting only the cheap number is a scoping failure |
| **V6** | Does paying by ewallet reduce the **earn** on the same ticket? | sample orders carrying an ewallet reward line **and** a points earn; compare `loyalty.history.issued` against `amount_total` and against `amount_total + \|reward_line\|`. Same instrument as `tools/loyalty_audit_live.py:1616 probe_money_mode_tax_basis`; **refuse a verdict below its evidence floor** | §A.6, and whether `docs/ODOO-INTEGRATION.md` §2's `WALLET_EARN_MULTIPLIER` is achievable or backwards |
| **V8** | Does the POS preload **all** `res.partner` rows, or a limited set? | `search_count('res.partner',[('customer_rank','>',0)])`; `fields_get('pos.config')` grepped for `partner` (`limited_partners_amount` or equivalent) | §C.1(b) and §D.3. A limited set makes offline lookup report **"not a member" for most members**, indistinguishably from a real non-member |
| **V12** | Can the POS client set a partner that is **not in its loaded set**, and at what cost? Report any `ir.rule` on `res.partner` for a POS session | staging + `ir.rule` read | §C.3 steps 4–6. If it cannot, the pad-identified partner may be unattachable at the till and the flow needs a round trip it does not budget for. Also: whether a compromised till is a member-base dump |
| **V19** | Does `settle_order` commit as one unit, **and is the TXN 1 op row visible from a second session mid-flight?** | staging: savepoint + deliberate failure at step 10, assert the tender is not visible; then a second session `SELECT`s the `pending` op while steps 2–12 are open | §B.3, §A.7.3. **Note the inversion:** the naive probe ("is it all one transaction?") would have *certified the bug* — a pass on that means the write-ahead record is invisible and the reaper is dead code |
| **V16** | Does a write to an **ACL-restricted** field by a non-member of the group **raise** or **silently drop** it from the vals? | staging: `partner.with_user(pos_user).write({'almond_earn_rate': 4})` | §A.4, T26. This is why T26 asserts the **outcome** (the stored value did not go down) rather than the mechanism |
| **V17** | What isolation level does this instance run at? | `SELECT current_setting('default_transaction_isolation')` | §A.7.3. Nothing may depend on `SERIALIZABLE`; the `FOR UPDATE` must be correct under `READ COMMITTED` |
| **V13** | Do `@point_of_sale/app/payment/payment_interface` and `register_payment_method` resolve on the target, with the signatures `pos_meps_apex` uses? | read the Odoo 19 source on the target; boot assert that `'almond_wallet'` is in `pos.payment.method.use_payment_terminal`'s selection | §A.3.2. **The repo's own file flags itself unverified** (`payment_meps.js:9-12`) in the surface doc §8 rates "Highest churn". A `register_payment_method` against a moved path fails the same way the rejected monkey-patch would |
| **V3** | Is there a unique constraint on `(program_id, partner_id)` in `loyalty.card`? | `read_group('loyalty.card',[],['id:count'],['program_id','partner_id'],lazy=False)` → any group >1. A duplicate **today** is the answer | §A.2. If absent, the module adds a partial unique index. Re-run against the **loaded** data as migration gate 5 |
| **V21** | Is `almond_followers_guard` installed on the target? | `ir.module.module` state | **STOPS the migration batch.** §E.1 step 1 — 47,720 card creations without it does a year of dead-`mail.followers` damage at once |
| **V14** | Does the POS create a `loyalty.card` lazily for a partner who has none? | staging: attach a partner with no card, observe | §B.3 step 3; gets the migration's card count right |
| **V11** | Does `loyalty.rule` accept `reward_point_amount = 0` without a validation error? | staging write | §A.5's fail-to-zero. If refused, the fallback is `0.01` and the alert threshold moves — **never 4** |
| **V10** | Does `loyalty.history` get exactly one row per movement, and are rows **deleted and recreated** on order edit, refund or session close? | staging: edit an order, refund one, close a session; diff the rows | Confirms §A.7's choice of a separate table was right, and sizes reconciler job 10 |
| **V22** | `ir.model.data` `load()` behaviour at 47,720 rows — timing and memory | staging restore, timed | §E.1 step 2 |
| **V23** | `loyalty.card.code` uniqueness and collision behaviour at volume | `fields_get` + a 47,720-row staging create | §E.1 step 9. **A code collision in a stored-value system is a wallet that answers to two people** |
| **V9** | What customer-facing surfaces exist? | `pos.config.customer_display_type` / `self_ordering_mode` selection **values**; `ir.module.module.state` for `pos_customer_display`, `pos_self_order` | §C.1(b) — confirms there is no stock phone-lookup pad, and what one would have to be built on if it must live in the POS |
| **V24** | Does a pad session survive an order being **parked**? | staging | the customer who steps aside to take a call — a daily event at a coffee counter |
| **V25** | Does `loyalty.history` record **who** wrote the row (`create_uid` or any actor field)? | `fields_get('loyalty.history')` | whether A3 is forensically detectable in stock, or whether `actor_login` on the op row is the only record |

**Plus one measurement, not a probe.** Extend doc §6.2's timing sampler
(`ir.config_parameter almond_loyalty.pos_timing_sample = 50`) so the recorded identification-method
enum includes `pad_identify`, `pad_otp`, `pad_deferred`. Doc §6.4's fleet cost is a **blend**, and
without the mix that blend is an assumption wearing a measurement's clothes — doc §6.4 says so
itself, and solves for the phone-fallback share at ≤3.4% for its own headline to hold.

**Stop conditions:** V1, V2, V7, V20. **Hard blocker:** V15. **Batch-stopper:** V21.
**Estimate-decider:** V5b.

---

# OPEN QUESTIONS FOR THE OWNER

Each carries what changes under each answer. None of them is an engineering preference dressed as a
question.

### O-1 — Can Wafii produce an export **on demand**, inside the cutover window? *(highest risk in the document)*

The only source described in this repo is *"تصدير جدول الأعضاء سلّمه المالك"*
(`docs/LOYALTY-WAFII-LIVE-AUDIT.ar.md:3`) — a file handed over once. `docs/LOYALTY-DECISIONS.ar.md:453`
already records that *"لا يوجد أيّ تدفّق بياناتٍ متكرّر من Wafii"*.

- **Yes, on demand:** §E.0(c) proceeds — a final export taken inside the cutover window, SHA-256
  recorded, gate 3 reconciled against **it**, and the September file demoted to calibration.
- **Only with notice, or not at all:** the alternative is a **Wafii-side write freeze** for the
  cutover window (an operational ask on the provider), or a delta export keyed identically. **Without
  one of the three there is no clean cutover boundary**: every Wafii earn between export and flip is
  lost and every Wafii redemption in that window is double-credited, and **no gate in this design can
  see it.** That is a stop condition on the cutover, not a detail to manage.

### O-2 — Does the pad talk to Odoo **directly**, or through the BFF? *(the owner has not answered this)*

**Designed for: through the BFF.** §C.1(a).

*If it must be direct:* an Odoo controller with `auth='public'`, its own pad token, rate limiter,
audit model and masking, and a `sudo()` read — **the same custom endpoint, relocated**, with the
token/OTP/idempotency machinery reimplemented in Python. Nothing is saved and one thing is lost: an
`auth='public'` controller **on the instance that holds `res.partner`** is one `sudo()` mistake away
from the whole member base.

### O-3 — Who supplies the pad: Odoo POS, or a separate device? *(the owner has not answered this)*

**Designed for: a separate device.** §C.1(b).

*If it must be the POS's own display:* the pad inherits the POS session's offline state, so
identification dies exactly when the till's network dies; the lookup is gated by the display's
`access_token` rather than an independent revocable pad token; and **V8's answer becomes a
data-protection finding rather than a performance one** — the POS client preloads a partner list
into the browser, and putting that browser in front of the public turns a lost tablet into a
member-base disclosure. Pending V8 and V12, a separate device may be the only lawful reading under
24/2023.

### O-4 — The four repo promotions: keep, or retire? *(needed before the T7d fixture is written)*

Wallet ×1.5, Tuesday ×2 ("Double Points Day"), Friday +50%, combo 50 points — all live in
`packages/shared/src/config/index.ts`, **all with zero rows in 171,291 live transactions**, in an app
that is not in production.

- **Retire:** §A.5's single-rate formula ships as written; §A.6.2 records the decision and the
  per-member cost; the 0.404 baseline moves and the §C.9 budget is re-based on the new figure.
- **Keep:** the fixture needs `weekday`, `bonusDay` and `comboPairs` columns; both Odoo evaluators
  need those inputs, **including an Amman-clock weekday in Python and in POS JavaScript** where
  `packages/shared/src/lib/ammanWeekday.ts` has no twin; and the combo needs a product-category rule
  the Odoo side does not have. That is a real increment on gate 4.

**My recommendation: retire, and retire `WALLET_EARN_MULTIPLIER` first** — it pays twice for one JOD
on money the customer already handed over (§A.6.2).

### O-5 — Is **0.45 JOD per identified transaction** a mean or a cap?

At the frozen rates a single 50 JOD ticket at 10 pts/JOD accrues **5.00 JOD** — 11× the figure.

- **A mean** (which is what the measured 0.404 is): T25 asserts the traffic-weighted mean and nothing
  per-row, and the budget is enforced monthly in JOD (O-6). **This is the reading the document
  builds.**
- **A cap:** `almond_per_invoice_point_cap` must be ~45 points, which cuts a Platinum member's earn
  by 91% and **re-opens committee decision §5** ("no current member's rate is touched"). That is a
  committee conversation, not a config value.

### O-6 — The monthly accrual budget, in JOD

Each +100 identified transactions/day is **+14,700 JOD/year** at the measured 0.404. At 25% coverage
(810/day) annual accrual is **~119,000 JOD against today's ~29,751**. §C.9 asks for a **monthly
accrual budget with a monthly readout** rather than a ruling on خ‑3's 420-transactions/day wording,
because a transactions/day cap on a non-acquisition intervention is the wrong instrument for the
thing being controlled.

### O-7 — Three priced bounds that need a signature

| Bound | Proposed | Fleet exposure |
|---|---|---|
| `override_daily_cap_value_fils` per branch | **15,000 fils (15 JOD)/day** | 9 × 15 = **135 JOD/day**, ~49,000 JOD/year worst case |
| offline pad deferrals per till per day | **40** | ~17% of a peaked lane; a two-hour outage |
| `till_daily_issuance_cap` (§B.5) | **[unset]** — must be set before gate 5 | doc §7.4 prices the unbounded case at **~2,300–4,600 JOD/day** |

Doc §7.4's own rule is that an unpriced bound does not ship. If a number is judged too high it comes
down; it does not stay unstated.

### O-8 — Earn-only at the counter until the app ships?

The app is not in production, so the app-token rung serves nobody today and **~100% of counter
redemptions fall to OTP at 8–20 s per redemption**.

- **Option 1 (recommended, and what §A.3.3 enforces by default):** ship earn-only at the counter.
  Spend stays in the app. Nothing in §A–§F changes; one rung of the ladder goes unused.
- **Option 2:** OTP-gated counter redemption, with the button labelled
  `[ أرسل رمزاً · ≈١٥ ثانية ]` so the cashier knows the cost before pressing it.

### O-9 — Gift cards: confirmed out of scope for this round?

The app already ships `giftSend` / `giftSent` / `giftRedeem`. This design creates **no** gift
programme, liability account, key namespace or gate. §E.2 keeps `enabled.gift = false` and reserves
the `gift:` prefix. **If gift cards must go live with the wallet, that is a fifth wave with its own
programme, its own account, its own migration step and its own gates** — and it is not costed here.

### O-10 — The two frozen accounts, and the 33-row exception file

ق‑12 rules: an accounting write-off for all 33, but the **visible balance zeroed for the two frozen
accounts only**, and the other 31 keep and spend their balances. The migration needs that file
**signed, with a decider and a date per row** (§E.1 step 5), and it needs the **275-point
discrepancy** in the largest account (28,342,875 vs 28,343,150 — `LOYALTY-DECISIONS.ar.md:461`)
settled before the batch runs. A zero-tolerance gate cannot be built on a number the repo says is
still open.

---

# CORRECTIONS LOG

**61 review findings. 56 applied by changing the design. 5 rejected in whole or in part, with
reasons.** Findings are cited by their number.

## Applied — the eleven that changed the shape of the design

| # | What was wrong | What the design is now |
|---|---|---|
| **1** | Nothing locked `loyalty.card`. `FOR UPDATE` was taken on the **op** row, so two debits with different `op_key`s against one card took two different locks, both read 50.00 and both wrote 20.00 — 30 JOD of free goods, repeatable at N-way concurrency. `UNIQUE(op_key)` serialises replays of one key, not distinct operations on one balance. | §A.7.3(b): TXN 2 opens with `SELECT … FROM loyalty_card … FOR UPDATE` and the sufficiency check runs **inside** that lock, against `points − Σ(reserved debits)`. **T36** runs 8 concurrent distinct debits and asserts the sum never exceeds the starting balance. **V17** reports the isolation level so nothing depends on `SERIALIZABLE`. |
| **2, 18** | `usedJti` was demoted to a cache on the claim that the durable guarantee "moves to `UNIQUE(authz_grant_id, source)`". **Self-refuting:** a replayed token mints a grant with a *different* `grantId`, so the index never sees it. Two BFF instances → one QR → two applied debits. | §A.7.1: **`almond.loyalty.grant` with `UNIQUE(token_jti)`.** The token's identity is the durable key. `usedJti` may become a cache **only after that row exists** — **T22 clause 4** asserts the constraint before any test permits the `Set` to be bounded, and **T16 clause 8** verifies one token against two independently constructed instances. |
| **6, 42** | `_debit_names_grant` was `CHECK (authz_grant_id <> '')` — a **string-presence test**. There was no grants table in Odoo, so the till's own wallet-charge controller had no way to check that a grant existed. A cashier with devtools posts `{partner_id: <any>, amount: 50000, authz_grant_id: 'x'}` and every constraint passes. | §A.7.1: the grant is a **row**, HMAC-signed, with `partner_id`, scope and ceilings as columns. The controllers take `{grant_token, op_key, amount}` and **no `partner_id`** — the partner comes from the row. `almond_loyalty_op.grant_id_ref` is a `Many2one` with `ondelete='restrict'`. |
| **17, 45** | Points redemption was left entirely on the stock client-side reward-claim path — which writes **no op row** and makes **no server round trip**. Every spend control was therefore unreachable on the surface A1 and A3 actually stand on, while the JS-patch alternative was rejected for the wallet on fail-open grounds. | §A.3.3: **`controllers/redeem_confirm.py`** (server-synchronous, doc §6.3's own design) **plus a server-side reward-line guard** in `models/pos_order.py` that rejects any points/wallet reward line with no matching applied grant-backed op. **The guard is the half that does not depend on the client patch loading.** Until both ship, the module **refuses to load** a points programme with a redeemable reward on a POS config. |
| **3** | Doc §7.4 Layer 2 was adopted (recompute from the client snapshot) and **Layer 3 dropped** — no issuance ceiling anywhere, only a *floor* alert. `almond_earn_rate_applied = 400` on one lane pays ~3,200 JOD/day and job 5 passes, because the inflated ops *are* applied. | §B.5: a hard server-side **clamp** — rate clamped to the partner's own recorded rate and to `{4,6,8,10}`, `ABS_CEILING_PTS_PER_JOD`, the signed per-invoice cap, divergence written and reported — plus **reaper job 6**, a per-till daily issuance cap that trips an **immediate** alert. **T25** carries a clamp vector. |
| **19** | The till-side wallet debit committed server-side and "failed closed" only on the **client**. A lost response left the money gone with no `pos.payment`, and **nothing in the design could see it**: the op and the card agree, so job 5 passes. | §A.7.3(c): the till debit is **two-phase** — `reserved` with a lease, confirmed at order validation, **released** by reaper job 9 (releasing a hold is additive, so it is exempt from "never auto-complete a debit"). **Reaper job 8** asserts op ↔ `pos.payment` 1:1 in **both** directions. A real `send_payment_cancel` is a gate-5 exit criterion. |
| **5, 25, 38, 43** | `reverseOrder(orderUuid, ctx)` took no authorization, no member, no amount and no ownership check, keyed on the **original** order (so a second partial refund silently no-ops), and the `direction`-scoped CHECKs made an earn reversal **unrecordable** — the only escape being a fabricated grant. | §B.1's `StaffAuthorization` (branded, `bff/src/authz/staff.ts`); §B.2's `reverseOrder(auth, originalUuid, refundOrderUuid, legs, ctx)`; §A.8's `refund:<refund_order_uuid>:<leg>`; §A.7.2's constraints **scoped to `source IN ('redeem','wallet_charge')`** with `auth_kind` gaining `reversal` and `correction`, a companion CHECK requiring a named human and a NULL grant, `reverses_op_id`, and **the sign convention stated once**. §D.6 adds **refund-to-same-tender** and V15(c). |
| **28, 29, 30, 31, 32, 33** | Six independent migration defects: gate 1 defined over `applied` alone (arithmetically incapable of firing); no Wafii snapshot boundary; an anomaly gate calibrated to a **count of 2** that this repo's own audit contradicts; a per-member watermark gate that 52% of the liability cannot satisfy; a key column the export does not have; and **no match pass against partners already in Odoo**. | §E.0 makes the export contract a **precondition** (key column, the duplicate and the 154, a checksummed in-window export). §E.1 step 2 is **match-then-load** with a collision report and a phone-duplicate gate. Step 3 stages over `('staged','applied')`. Step 5 gates on **set membership** against a checked-in 33-row file with the same ratio test. Step 8 splits gate 2 into a satisfiable gate and a reported artifact carrying the named 23,395 JOD residual. |
| **8** | The migration staged 47,720 ops as `pending`+`credit`, which is exactly the reaper's takeover branch. **Job 2 would have applied the entire opening balance within ten minutes**, before any gate, while Wafii was still authoritative. Gate 5 could not detect it — a prematurely applied op *satisfies* it. | §A.7.2 adds **`state='staged'`**; §D.7 scopes the takeover rule to `pending` only and makes job 2 skip `source='migration'`; §E.1 step 8 adds **gate 6** (`count(*) WHERE source='migration' AND state <> 'staged'` = 0) immediately before the flip; **T38** asserts the reaper leaves 100 stale staged rows untouched. |
| **21, 22, 23** | Nothing issued earn on the POS **sync** path — the only named issuer was a controller queued orders never reach, so "earn survives offline" had no implementation. Job 5's equality was false from day one. And §A.7.1 mandated two transactions while §B.3 numbered them as one and the probe would have **certified** the single-transaction bug. | §B.3 names `models/pos_order.py` as the sync issuer and adds it to doc §8's checklist as a **second** high-churn symbol (§A.9 retracts the "one file" claim). §A.7.4 **closes the ledger** with a `loyalty.card.write` override, with V18 deciding and a bounded fallback written down. §A.7.3(a) puts TXN 1 on `registry.cursor()` and **V19 is restated** to probe atomicity *and* mid-flight visibility. |
| **4, 44, 51, 57** | The receipt carried the balance on phone-alone identification (a 1 JOD disclosure of a third party's data). The single-rate formula deleted four repo promotions silently. **Staff identity does not exist anywhere in the BFF** while six mechanisms depend on it. And twenty probes had no instance, no owner and no date. | §C.7: **delta only, never a balance, unless the order carried a `spendAuth`** — T19 clause 4. §A.6.2 puts the four numbers to the owner as **O-4** and records why the committee constraint is not breached. §C.5.2 makes staff identity **gate 3a** with named files, and reduces the A3 forensic claim in writing until it exists. **Gate 2a** names the instance, the owner and the date. |

## Applied — the remaining forty-five, by area

| Area | Findings | Change |
|---|---|---|
| Authorization model | 7, 11, 12, 26 | `UNIQUE(grant_id_ref)` with no `source` (one grant, one movement); `spendAuths: SpendAuthorization[]` for mixed tender; `OTP_BRAND`; `enrolByPhone` throws `already_enrolled`; `/v1/pos/scan` **fails closed** and binds the grant to the presenting till |
| Concurrency & reconciliation | 20, 37 | `probeWrite` is **tri-state and transitional** (`pending → failed` under `FOR UPDATE` before answering) — T37; the migration's opening credit gets a `loyalty.history` row and reaper job 10 asserts the two ledgers agree |
| Keys | 15, 54 | `keyFor` namespaces by real principal (no `anon` bucket) — T17.4; `pos:<uuid>:line<line_id>`, `refund:<refund_uuid>:<leg>`, `pad:<session>:<boot_id>:<seq>`; T24b vectors for double-claim and partial refund |
| Rate field | 13, 27, 35, 59 | One stored `almond_earn_rate` (floor/current/`max()` deleted with tiers), `CHECK IN (0,4,6,8,10)`, `tracking=True`, **no `groups=` and no `readonly=True`** (V16), steward ACL + raise-only constrains; `almond.loyalty.rate.change` so deferred issuance pays the sale-date rate; **derived from the export's tier column**, not from earn rows half the base does not have; T26 asserts the **outcome** |
| Offline & the pad | 10, 16, 56, 58 | Sealed claims **name a `pos.order.uuid`** over a pad↔till local link, with a partial unique index and the cap enforced at **resolution** — or deferral is dropped; phone correction OTPs the **old** number with a 72-hour spend hold; the employee screen is a named file in gate 6 with V12; **enrolment is online-only in its own module**, named as T20's single exception |
| Caps & budgets | 9, 14 | `override_daily_cap_value_fils` with points at ×10 fils plus a per-member 30-day cap (T32b); the 0.45 figure restated as a **mean** with the per-invoice fraud cap separated and signed |
| Wallet & bonus | 24, 40, 55 | The reload bonus is an **explicit second leg in the same transaction**, not a `loyalty.rule` that never fires for app top-ups (T25 parity vector); **gift cards out of scope in writing**, `enabled.gift=false`, existing gift balances read before step 7 asserts zero, `gift:` prefix reserved; the `PaymentInterface` idiom **downgraded to [STOCK — must probe]** with V13 and a boot assertion |
| Migration detail | 34, 36, 39, 41 | **One** cutover sequence (§E.2's waves corrected; `shadow-write` deleted); reconciliation in **integer points against a checksummed file** with the 275-point discrepancy settled first; **154** not 26, with a counter procedure and ق‑11's precondition as a gate; `batch_id`, `wafii_key`, `as_of`, `note` added to the op model so the gates and the rollback read fields that exist |
| Tests & tooling | 46, 47, 48, 49, 50, 52, 53, 60, 61 | `stripComments` **extension-dispatched** with canary assertions (a `#` branch applied to `.tsx` blanks every hex literal); three checked-in method sets with an exhaustive partition; a **named** idempotency exemption set of four mint-shaped routes; the T16/T17 walk extended to `loyalty.service.live.ts`; real per-system `enabled.*` env inputs and a `createBackend()` switch; `OdooEarnBreakdown` defined and `OrderRecord.earn` discriminated; **§B.7.1 lists every existing test this change invalidates**; T7d-c restricted to `{4,6,8,10}` as an assignment RHS; T22 clause 1 made **behavioural** |

## Rejected, in whole or in part

| # | The finding said | Rejected because |
|---|---|---|
| **44** (premise) | The single-rate formula "silently deletes three promotions that are **live** … which the committee forbade" (decision §5, "no promotion stops"). | **The four promotions have never run.** `LOYALTY-WAFII-LIVE-AUDIT.ar.md` §8 and `LOYALTY-MEASURED-TRUTH.ar.md` §2 both record **zero rows out of 171,291** for the wallet multiplier, the bonus day and the Friday bonus; the combo reward lives in an app ق‑11 records is **not in production**. No member has ever received one, so retiring them does not stop a promotion. **The remedy is adopted in full anyway** (O-4, §A.6.2): the decision is made explicitly by the owner before the fixture is written, not by a red test at implementation time. |
| **17/45** (option b) | *"Either restore the server confirm, **or** accept that points redemption is authorized only by the cashier and say so plainly in §0's adversary table."* | The second branch is rejected. It would leave the entire clean customer-held points liability spendable by anyone who knows a phone number, at a counter this document has just built a pad for — and it contradicts §0's own sentence on the half of the balance where A1 actually stands. Option (a) is built (§A.3.3). Making points a **tender** instead is also rejected: a promotional point *is* a discount, and putting a marketing accrual in a journal misrepresents it as customer cash — and a fully-points-paid ticket would then earn full points on the full ticket. |
| **24** (option a) | *"Either route app top-ups through `settleOrder` so a real `sale.order` line for the top-up product exists, or keep the bonus as an explicit second leg."* | The first branch is rejected. It manufactures a `sale.order` for something that is not a sale, drags a payment into the re-pricing path, and makes the app's top-up depend on the product catalogue being correct. The second branch closes the crash window at least as well — one transaction, two op rows — and is what §B.7 specifies. |
| **26** (option b) | *"…or a single grant carrying a per-scope ceiling map."* | Rejected. A ceiling map re-creates the multi-leg problem **inside one row** and makes `UNIQUE(grant_id_ref)` unusable as the one-grant-one-movement guarantee — which is the constraint that closes finding 7. One grant per leg, each scoped, each capped (§A.7.1). |
| **50 / 59** (parts) | 50: widen the union to `'mock' \| 'shadow-read' \| 'shadow-write' \| 'odoo'`. 59: probe *"does a stored compute depending on a `groups=`-restricted field compute correctly?"* | 50's `'shadow-write'` is rejected because finding **34** deletes that wave: two authoritative writers on a money path is the defect, not the harness, and its own "zero divergence" gate was unreachable against zero-balance cards. The union is `'mock' \| 'shadow-read' \| 'odoo'`. 59's second probe is **moot by design change**, not by disagreement: §A.4 deletes the compute and the `groups=` restriction, so only the ACL-write question (V16) remains. |

---

# Appendix — what this design deliberately does NOT build

| Not building | Why |
|---|---|
| Prefix search, autocomplete or "did you mean" on the pad | an enumeration API with a nicer name, over 47,720 members and a public keyboard. Also slower at a counter: autocomplete invites browsing |
| `hasAccount`, a name, a balance or `affordableRungs` in the pad's response | all four are rate-limited **oracles**, and a rate limit does nothing against an attacker who needs one lookup. §C.3 |
| A masked name as the identity challenge | empty for 3,369 active members and it confirms nothing anyway — anyone says yes to a name. Replaced by the digit echo, which works for 100% and catches the failure that actually occurs. §C.6 |
| A 4-digit `pad_pin` | shoulder-surfable on a public screen; a new shared secret for 47,720 people; unrotatable by those with no name on file; and it caps the wallet while leaving points uncapped — the wrong asset at 1 point = 1 qirsh |
| `findOrCreateByPhone` reachable from the pad | creation at an unauthenticated public input is an account-creation oracle and a `res.partner` spam gun |
| Biometrics at the pad | biometric data under 24/2023 in a coffee queue, to save 8 seconds, protecting an average balance under 1 JOD |
| Offline spend of any kind, including "just a small limit" | doc §7.3's two-tills proof does not weaken with the amount, and an exception is an exception someone will widen |
| An **unbound** offline pad claim | a manual-credit channel with no ceiling: ~93 JOD/day at one lane, and it looks like a wifi outage in the report. Bind it to an order uuid or drop the feature |
| A pad-side member cache "for speed" | turns A5 from a lost tablet into a member-base disclosure and re-creates the oracle §D.4 removes. The pad's cache is the empty set |
| The pad inside Odoo POS | a public-facing input on the till's origin and session; and pending V8/V12, the POS's preloaded partner list in the memory of a device facing the public |
| Any Odoo credential on the pad | Odoo's access model is model-level; there is no stock record rule expressing "may read exactly the one partner whose full phone number you already know", and inventing one with `sudo()` in a public controller is that rule's absence wearing a costume |
| A JS monkey-patch as the offline wallet guard | it fails **open** and **silent** if it does not load, in doc §8's highest-churn surface. §A.3.2 |
| A `pos.payment.method` for **points** | a point *is* a discount. Making a promotional liability a tender puts it in a journal as customer cash, and it earns full points on a fully-points-paid ticket |
| Leaving points redemption on the stock path with no server confirm | the mirror image of the line above, and the more dangerous one — it rejects a JS patch for the wallet on fail-open grounds and then relies on **nothing** for points. §A.3.3 |
| `UNIQUE` on stock `loyalty.history` | a vendor table the module does not own; V10 may show rows are recreated; and a ledger row cannot hold a `pending` state, so there is no write-ahead record |
| Redis, or any shared idempotency store | once `op_key` is a Postgres unique index in the same transaction as the money, the `Map` is a response cache. A store buys milliseconds and costs an operational dependency on the payment path |
| Best-effort compensation on an ambiguous failure | `checkout.ts:82` is a coin flip with the customer's money. Replaced by `indeterminate` + a **transitional** `probeWrite` |
| Auto-completion of a stuck **debit** | it is how you charge twice. Alert and reconcile by hand. Releasing an unconsumed **reservation** is different, and is the one exception, because it is additive |
| A write-mirroring dual backend for the parallel run | two authoritative writers on a money path is the defect, not the harness. Reads are diffed; writes go one place |
| An assertion known to be false (`points == Σ applied ops` over an open ledger) | it gets muted within a week, and then there is no balance detector at all. Close the ledger (§A.7.4) or replace the assertion with a bounded one and say why in the README |
| `almond.loyalty.tier`, `.window.bucket`, `.timewindow`, `.availability`, `.reprice.log`, `.birthday.grant`, `.point.lot`, and seven of the eight crons | the committee cancelled the re-tiering and the threshold redesign. Building doc §3's model list "because the spec has them" is the single most expensive mistake available in this round |
| Point expiry — the cron, the notices, Phase 3's gates | a silent devaluation of the entire clean customer-held balance plus a breach of a term ق‑11 requires be published, delivered by someone faithfully following the repo's own spec. §A.9.1 |
| A rolling-window engine in the BFF | the cumulative-spend defect is fixed by **deleting** `addSpend`, not by adding a window to the wrong process |
| A cashier-editable phone number at the till | the cleanest full-account takeover in the system. Manager, back office, with ID, OTP to the **old** number, logged, with a 72-hour spend hold |
| A cashier-side "adjust points" button | doc §6.2's classic self-crediting channel. The claim voucher already exists and is slow **on purpose** |
| A labour-savings business case for the pads | at 6.2% coverage the saving is small enough to be audited away. The real cases are §C.10 (coverage) and §C.6 (the only lawful consent surface in the estate — documented consent exists for **0 of 47,720** records) |
| SMS or receipts containing a **balance** | free reconnaissance on a channel we do not control, attributed on phone alone. A per-ticket delta is fine; a balance is not |
| Loading the provision figure onto the cards | the clean balance is what customers hold; 17,166 is the provision. Conflating them under-issues ~27,763 JOD invisibly |
| Silently dropping the anomalous accounts, or blanket-zeroing all 33 | the first destroys the audit trail; the second confiscates 456 JOD from 31 real customers to save 456 JOD, one of whom holds an ordinary 3.52 JOD reward |
| Deleting T7 | restate it. A test deleted because it became inconvenient is how client/server earn divergence comes back. §F.2 |
