# almond_loyalty_pos — Almond Loyalty connector for Odoo 19 POS

**Status: foundation / skeleton — authored against the Odoo 19.0 source, NOT installed or run on any Odoo.**
There is no Odoo in the environment where this was written. Everything marked
**UNVERIFIED** below must be proven on `dev-almond` before production (Abu Laith pipeline:
introspect → review → gate → dev → prod with `APPROVE PROD`).

---

## بالعربي — ما هو هذا الموديول

يربط كاشيرات ألموند (Odoo 19 POS) بنظام الولاء (الـ API المنفصل `bff/`) **من خادم إلى خادم**:

- زر **«ألموند»** في شاشة المنتجات + قارئ الباركود: يقرأ QR العضو (صالح لمرة واحدة، 60 ثانية)، ويربط العضو بالطلب.
- **أعضاء الشركات:** نسبة الخصم الخاصة بهم، **ولا نقاط**.
- **الاستبدال (redemption):** تسوية كود العضو (QR أو كتابة الكود `AB2C-D3EF`) ثم خصم قيمته من الفاتورة كسطر دفع على طريقة دفع مخصّصة «Almond redemption».
- **النقاط تُكسب على الخادم فقط وبعد تأكيد الدفع**، عبر طابور (outbox) مع إعادة محاولة. **فشل الـ API لا يوقف البيع أبداً.**
- **المرتجع:** يعكس نقاط الطلب الأصلي (عكس كامل — قرار المالك).
- **تصنيف الأخطاء حسب رمز الـ API:** مفتاح خاطئ (`pos_key_invalid`) = مشكلة إعداد تُسجَّل وتظهر للعمليات ولا يُعاد إرسالها تلقائياً (يُعاد يدوياً بعد إصلاح المفتاح)؛ تذكرة/QR منتهية أو مستخدمة، تعارض الطلب، دفع خارج نافذة الصلاحية = فشل نهائي بسبب مسجَّل؛ ضغط (`rate_limited`) أو انقطاع = إعادة محاولة تدريجية.
- **وقت الدفع (`paidAt`)** يُرسل دائماً بوقت الدفع الفعلي وبمنطقة زمنية صريحة، لأن الـ API يقبل البيع فقط إذا دُفع خلال [المسح − 30 دقيقة، المسح + 6 ساعات].
- مفتاح الـ POS (`x-pos-key`) محفوظ في `ir.config_parameter` لمدير النظام فقط، **ولا يصل للمتصفح أبداً**.

الحالة: **هيكل أساسي** — السباكة الحقيقية مكتوبة، واختبارات العميل تعمل هنا، لكن الموديول **لم يُثبَّت على Odoo بعد**. المطلوب من Ishbek: التثبيت على `dev-almond`، إكمال بنود TODO، وإثبات بنود UNVERIFIED.

## English — what it does

Connects every Almond till to the Almond loyalty API (the BFF), server-to-server. Same list as above.

---

## Flow

```
TILL (browser, OWL)                ODOO (server)                                  ALMOND API (BFF)
───────────────────                ─────────────                                  ────────────────
«ألموند» / scanner ── rpc ──> /almond_loyalty/scan ── x-pos-key ─> POST /v1/pos/scan {token}
   shows member,     <─ display ── stores almond.loyalty.scan    <── {memberId, mode, earnsPoints,
   corporate %,          only       (earn ticket, member id,          earnTicket|null, earnTicketExpiresIn,
   redemption value                  redemption code: SERVER only)    corporate|null, redemption|null}
   applies corporate
   % as line discount

"Use it" / code ──── rpc ──> /almond_loyalty/settle ── x-pos-key ─> POST /v1/pos/redemption/settle
   adds payment line <── valueJod ── stores almond.loyalty.redemption <── 201 {valueJod, points, ...}
   on "Almond redemption"            (value comes from the API, not the till)
   method (≤ amount due)

PAY / VALIDATE ── sync_from_ui ──> _process_order (drops almond_* keys sent by browser)
                                   _process_saved_order  → order is PAID, name assigned
                                     └─ _almond_loyalty_link (savepoint, never raises):
                                          copy scans/redemptions onto pos.order
                                          flag redemption mismatch
                                          INSERT almond.loyalty.outbox(earn)  ← no network
                                            paidAt = PAYMENT time (date_order / payment_date), "…Z"
                                          ir.cron._trigger()
                                   ir.cron "Almond Loyalty: send earn/reverse outbox"
                                     └─ POST /v1/pos/earn {earnTicket, posOrderRef=order.name,
                                          branchId, paidTotal (money only), paidAt}
                                        201 grant / 200 replay → done, pos.order earn_state=sent
                                        otherwise → see "Outbox failure policy"

REFUND (paid) ───────────────────> _process_saved_order on the refund order
                                     └─ outbox(reverse) for the ORIGINAL posOrderRef
                                        (waits until that earn is done; cancelled if it never was)
                                        POST /v1/pos/earn/reverse {posOrderRef, reason} → 201 / 200 replay
```

**A redeem visit is two scans.** By contract a `redeem`-mode scan never carries an earn ticket.
To earn on the cash part the member also shows their **pay** QR. The server keeps both scans of
the same member on the order (the redeem one for "Use it", the pay one for the earn); a scan
of a *different* member replaces the earlier ones. The till says so ("scan the pay QR too").

---

## API contract (final — BFF commit e9f6c15, `bff/src/routes/pos.ts`, `bff/src/pos/*.ts`)

Every till route: header `x-pos-key`, checked first, fail-closed. Errors are always
`{error: <machine code>, message}`; the client maps the **machine code** to a typed exception
(`_ERRORS_BY_CODE` in `models/almond_loyalty_client.py`) and never reads the message text.

| Route | Success | Notes |
|---|---|---|
| `POST /v1/pos/scan {token}` | 200 `{memberId, mode, redemption, corporate, earnsPoints, earnTicket, earnTicketExpiresIn}` | `earnTicket` only for a `pay`/`earn` QR of a member who earns (never corporate, never `redeem`) |
| `POST /v1/pos/earn {earnTicket, posOrderRef, branchId, paidTotal, paidAt}` | 201 grant · **200 `replay:true`** (same ref + member + amount + branch — even after the ticket expired, even after a reversal) | limits checked by the client too: ticket ≤1024, ref ≤64, branch ≤64, 0 ≤ paidTotal ≤ 100000 (3 decimals), paidAt ISO-8601 **with offset** |
| `POST /v1/pos/earn/reverse {posOrderRef, reason}` | 201 · 200 `replay:true` → `{posOrderRef, reversedPoints, shortfall, pointsBalance, replay}` | reason 1–200 (the client trims/truncates); 404 unknown ref |
| `POST /v1/pos/redemption/settle {token}\|{code}` | 201 `{settled, memberId, valueJod, points, redemption}` | one 404 for every refusal; rate-limited per till and per key |

Earn ticket: lives **7 days**, but the sale must be **paid within [scan − 30 min, scan + 6 h]**
however late it is delivered. So the module **always** sends `paidAt` = the order's payment time
(`almond_loyalty_policy.payment_time` = max(`date_order`, payment lines' `payment_date`) — in
19.0 the till re-stamps `date_order` at validation; the payment date covers the back-office
wizard), formatted `YYYY-MM-DDTHH:MM:SSZ` from Odoo's naive-UTC value. The client refuses to
send an earn without an offset-qualified `paidAt` (`ClientValidationError`).

### Outbox failure policy (`almond_loyalty_policy.classify`)

| BFF answer | Client error | Outbox | `failure_kind` |
|---|---|---|---|
| 201 / **200 replay** | — (result) | `done` | — |
| 401 `pos_key_invalid`, unknown 401, local URL/key missing | `PosKeyInvalidError` / `AuthError` / `ConfigError` | `failed`, logged at **ERROR** (every till is affected) | `config` — fix Settings, then select rows → **Retry now** |
| 401 `token_invalid` / `token_expired`, 409 `pos_token_replay` | `TokenInvalidError` / `TokenExpiredError` / `TokenReplayError` | `failed` | `ticket` |
| 401 `ticket_invalid` / `ticket_expired`, 409 `ticket_used` | `TicketInvalidError` / `TicketExpiredError` / `TicketUsedError` | `failed` | `ticket` |
| 409 `pos_order_conflict` | `PosOrderConflictError` | `failed`, never retried | `conflict` |
| 400 `paid_at_outside_ticket_window` | `PaidAtOutsideWindowError` | `failed` | `window` |
| 400 validation, 404, refused before sending | `BadRequestError` / `NotFoundError` / `ClientValidationError` | `failed` | `rejected` |
| 429 `rate_limited`, 5xx, timeout, connection, unreadable body | `RateLimitedError` / `UnavailableError` / `ProtocolError` | retried: 1, 2, 4 … min, capped at 6 h; after 25 attempts `failed` | `exhausted` |

At the till (scan/settle), the same codes become short cashier messages: expired QR → "refresh
it", replayed QR → "already used", `rate_limited` → "wait a minute", `pos_key_invalid` → "not
configured, ask the manager" (and an ERROR log line).

---

## Decisions (visible on purpose — confirm with the ERP/finance team)

1. **Redemption = payment line on a dedicated payment method, not a discount line.** A redemption consumes a liability (points already issued = money owed to the member); it is not a sales discount. With a payment method the sale stays at full price (revenue and 8% VAT on the full price) and the redemption leg books against the liability: set the method's **Outstanding account** (bank-type journal) to the loyalty liability account. **Open questions for the accountant:** (a) the JoFotara/VAT treatment of a loyalty redemption in Jordan (full price + non-cash tender vs. reduced price) — this module's choice keeps full price; (b) which journal/account. Switching to a discount line later means changing only `almondSettleRedemption` in `static/src/app/pos_store_patch.js`.
2. **Corporate discount = per-line discount** (`line.setDiscount(pct)`), applied at scan time and re-applied in `pay()` for lines added later; never lowers a bigger manual discount; removed if the member is detached. Alternative: a corporate **pricelist** per company (cleaner reporting). Not decided.
3. **posOrderRef = `pos.order.name`** (as the contract says; ≤64 chars). Odoo 19 assigns it when the order is paid (`write()` on `state='paid'`). It is unique in practice (sequence prefix + receipt number) but **not DB-enforced**; `pos.order.uuid` is. If the BFF sees collisions across companies, switch to `uuid`.
4. **Refund → full reversal** of the original's points — **owner decision**: the contract has no amount, so a *partial* refund reverses all points (never below zero: already-spent points come back as `shortfall` on the BFF's sale row).
5. **A refunded redemption is not given back to the member** (the API has no "un-settle"); the refund order gets a chatter note.
6. **Redemption larger than the bill:** the payment line is capped at the amount due; the rest is lost (the cashier is asked first when the value is known before settling). Business rule to confirm.
7. **Earn only if money was collected:** `paidTotal` = Σ payment lines excluding the Almond method (the cash-change line is negative, so it nets out); if 0, no earn.
8. **A config failure fails the row instead of retrying it** (contract: `pos_key_invalid` must not be retried). Nothing is lost: after fixing the key, select the failed `config` rows in the outbox list and press **Retry now** — the earns are replayed with their original `paidAt`, so they still fall inside the sale window if the ticket is < 7 days old.

---

## What is DONE and VERIFIED (here)

- `models/almond_loyalty_client.py` — dependency-free client (only `requests`); **every BFF machine code mapped to a typed error**, status fallback for unknown codes; 200 replay and 201 both success; client-side limits (lengths, paidTotal range, offset-qualified `paidAt`); HTTPS enforced; no secret/token/code/ticket in logs, errors or `repr`; no internal retries.
- `models/almond_loyalty_policy.py` — `classify` (decision + operator-visible reason), backoff, `paid_total`, redemption mismatch, `payment_time` + `iso_utc`.
- **40 unit tests green** against the mock (`tests/test_client.py`): each machine code → the right error class **and** outbox outcome; replay 200 = success (also after ticket expiry and after a reversal); sale window (7 h late refused; late delivery with the real payment time accepted; 31 min before scan refused, 29 min fine); future `paidAt` = 400 validation; `paidAt` sent and offset-qualified; naive/missing `paidAt` never leaves Odoo; reverse 201 → 200 replay; settle once; secrets never logged.
- Guards proven by **deliberate mutation** (each made the tests fail, then reverted). Round 1: logging the key, retrying a 409, counting the redemption in `paidTotal`, printing the redemption in `repr`, plain http to a remote host. Round 2 (final contract): retrying `pos_key_invalid`; retrying `ticket_*`; retrying `pos_order_conflict`; not distinguishing the window error; failing instead of retrying 429/5xx/timeouts; mapping 429 to a bad request; dropping the `ticket_used` mapping; not sending `paidAt`; accepting a naive `paidAt`; dropping the `Z`; using the earliest instead of the latest payment time; treating a replay as an error; classifying an unknown 401 as a member problem.
- `mock/almond_bff_mock.py` — stdlib mock of the 4 endpoints mirroring the BFF's codes, statuses and **order of checks** (key → rate limit → schema → ticket signature → future paidAt → replay/conflict → ticket_used → expired/window → grant).
- All `.py` compile, all XML well-formed, all JS parses (acorn, ES2022 modules) and passes the repo ESLint.

## What is DONE but UNVERIFIED (written against the Odoo 19.0 source; never executed in Odoo)

Checked line-by-line against `odoo/odoo@19.0` (`addons/point_of_sale`, `odoo/http.py`, `odoo/orm/models.py`, `odoo/sql_db.py`, `odoo/addons/base/models/ir_cron.py`, `res_config.py`, `web/static/src/core/...`):

| Piece | Verified in source | Still to prove on dev-almond |
|---|---|---|
| Hook `pos.order._process_saved_order(draft)` | only caller of `action_pos_order_paid` in `point_of_sale`; used by `sync_from_ui` and by the back-office payment wizard | the earn row appears once per paid order; Almond's custom JoFotara modules (`agile_consulting_l10n_jo_edi_pos`, `l10n_jo_edi_pos`) don't break the chain |
| `_process_order` strips `almond_*` keys | the POS serializer sends every non-computed field, `false` when unset | a till sync does not reset server values; no AccessError on `almond_earn_ticket` |
| `_load_pos_data_read` override | pattern used by `pos_loyalty.loyalty_reward`; `read([])` skips group-restricted fields | ticket never visible in the browser's order data |
| `pos.payment.method._load_pos_data_fields` + `almond_is_redemption` | same pattern as `pos_adyen` | method visible to the till JS |
| routes `type="jsonrpc"` | 19.0 renamed `json` → `jsonrpc` | — |
| outbox cron with `ir.cron._commit_progress` + `_trigger()` | both exist in 19.0 | near-real-time earn; commit per row |
| settings: `config_parameter` URL/timeout, write-only key via `set_values` | `res_config.py` get/set logic | saving settings as a non-system POS manager does not touch the key |
| settings view xpath `//block[@id='pos_payment_terminals_section']` | exists in 19.0 POS settings view | renders |
| pos.order form xpath `//page[@name='extra']`, payment method `field config_ids` | exist in 19.0 views | render |
| JS patches: `PosStore` (`getOrder`, `pay`, `session`, `notification`, `dialog`), `ControlButtons`, `ProductScreen._barcodeProductAction` + `useBarcodeReader`, `PaymentScreen.payment_methods_from_config` / `addNewPaymentLine`, `order.addPaymentline`, `line.setAmount`, `line.setDiscount`, `order.remainingDue`, `order.uiState` persistence | all names/paths exist in 19.0 | the whole till flow (see test plan) |
| Template xpath `//SelectPartnerButton` in `point_of_sale.ControlButtons` | present once in 19.0 | button renders in the always-visible row |

UNVERIFIED specifically called out in code comments (`UNVERIFIED (Odoo 19)`):
- corporate `setDiscount` interaction with pricelists / combos / `pos_loyalty` reward lines;
- the branch handheld scanners emit the full ~150-char QR as one burst the barcode service accepts (fallback: the dialog input);
- the button label refresh (`order.uiState` reactivity) after a scan.

## What is TODO (for Ishbek) — precise

1. **Install on dev-almond** and run the test plan below; fix what breaks.
2. **Odoo tests**: `TransactionCase` for `_almond_loyalty_link` (paid order → one earn row; corporate → none; refund → reverse; mismatch flag; exception inside → sale still commits) and for `_cron_process_outbox` with the client patched; a POS **tour** for button → scan → pay. (Put them in `tests/` with an `__init__.py` **and move `test_client.py` out**, or keep it and make Odoo ignore it — Odoo's loader expects `odoo.tests` cases.)
3. **Receipt**: print member ref / "points will be credited" on the ticket (earn result is async, so no points number at print time).
4. **Order reload**: re-fetch the member state for a draft order opened on another device (server has it in `almond.loyalty.scan` by `order_uuid`; add a `/almond_loyalty/order_state` route).
5. **Settle timeout** is ambiguous (the API may have consumed the code): today the cashier sees "not reachable" and a retry returns "refused". Add a "check status" call if the BFF provides one.
6. **Alerting**: failed outbox rows only show in the back office (a `config` failure is also logged at ERROR). Hook `failure_kind = config` rows into the existing alert mail/cron — one of them means every till is losing earns.
7. **Housekeeping**: purge archived `almond.loyalty.scan` rows older than N days.
8. **Arabic translations**: all user strings go through `_()` / `_t()` / template auto-translation; generate `i18n/ar.po` (`--i18n-export`) and translate.

### BFF contract points — status

Resolved by the BFF (commit e9f6c15) and adopted here:
- ~~401 ambiguous between wrong key and bad QR~~ → distinct machine codes (`pos_key_invalid`, `token_invalid`, `token_expired`, `ticket_*`); message-text inference removed.
- ~~earn ticket lifetime unknown~~ → 7 days + sale window [scan − 30 min, scan + 6 h]; `earnTicketExpiresIn` returned.
- ~~`paidAt` format~~ → ISO-8601 with explicit offset; naive refused; > 5 min in the future refused.
- ~~brute force of codes via `/settle`~~ → rate-limited per till and per key (`rate_limited` 429).
- ~~earn/reverse replay semantics~~ → 201 new / 200 `replay:true`.

Still open (not blocking):
- **Partial-refund reversal** — the reverse call has no amount; full reversal is the owner's decision (Decision 4).
- ~~A scanned QR cannot then settle by token~~ — **confirmed intended** by the BFF side (e9f6c15): the redemption code returned by `/scan` IS the settle credential, single-use at settle. Settling a scanned redemption by that code is the designed path.
- ~~Redemption code input format~~ — **confirmed**: the BFF stores codes without the dash and normalises input (`normalizeRedemptionCode`: upper-case, spaces and dashes removed) before lookup, so `AB2C-D3EF`, `ab2cd3ef` and ` ab2c d3ef ` all settle the same code.
- **Settle timeout is ambiguous** (the code may have been consumed); there is no status endpoint to ask.
- **Redeem visit = two scans** (redeem QR + pay QR) because a redeem scan carries no earn ticket — a cashier-training point; a combined flow would need a contract change.

---

## Test with the mock (no real API needed)

Client + policy unit tests (no Odoo):

```bash
python3 -m unittest discover integrations/almond_loyalty_pos/tests -v
```

Full till flow on dev-almond against the mock:

```bash
python3 integrations/almond_loyalty_pos/mock/almond_bff_mock.py --port 8898 --key mock-pos-key
# Settings: API URL http://127.0.0.1:8898 (or set almond_loyalty_pos.allow_insecure_http=1 for another host), POS key mock-pos-key
# Mint member QR tokens (paste into the dialog, or render as a QR for the scanner):
curl -s -XPOST localhost:8898/__mock/token -d '{"memberId":"m1","mode":"pay"}'
curl -s -XPOST localhost:8898/__mock/token -d '{"memberId":"c1","mode":"corporate","percentOff":15}'
curl -s -XPOST localhost:8898/__mock/token -d '{"memberId":"r1","mode":"redeem","redemptionValueJod":2.5}'   # returns the code too
curl -s -XPOST localhost:8898/__mock/config -d '{"delaySeconds":10}'   # simulate a slow API
curl -s -XPOST localhost:8898/__mock/config -d '{"failNext":503}'      # simulate an outage
curl -s -XPOST localhost:8898/__mock/config -d '{"failNext":429}'      # simulate rate_limited (earn/reverse/settle)
curl -s -XPOST localhost:8898/__mock/age_ticket -d '{"earnTicket":"<from the outbox payload>","seconds":25200}'  # scanned 7 h ago
```

Test plan on the till: (1) pay member → paid → outbox row `done`, order `almond_earn_state=sent`; (2) corporate → 15% on lines, no outbox row; (3) redeem → "Use it" → payment line 2.500 on the Almond method → pay rest → earn `paidTotal` excludes 2.500; (4) mock down (`failNext`/stop it) → sale completes, row `pending` with backoff, restart → `done`; (5) re-scan same QR → "already used"; (6) refund the paid order → reverse row → `done`, original `reversed`; (7) wrong key → cashier sees "not configured", ERROR log `pos_key_invalid`, earn rows `failed / config`; fix the key → select them → **Retry now** → `done`; (8) redeem visit: scan redeem QR → "Use it" → scan pay QR → pay → one earn on the cash part; (9) lost response: set `delaySeconds` above the Odoo timeout → the mock grants but Odoo times out → row retried → 200 `replay:true` → `done` (nothing granted twice).

---

## Files

| path | role |
|---|---|
| `__manifest__.py` | 19.0.1.0.0, depends `point_of_sale`, assets in `point_of_sale._assets_pos` |
| `models/almond_loyalty_client.py` | HTTP client, **no Odoo imports** |
| `models/almond_loyalty_policy.py` | `classify` (retry/fail + reason), backoff, `paid_total`, `payment_time`/`iso_utc`, **no Odoo imports** |
| `models/almond_loyalty_service.py` | builds the client from `ir.config_parameter` (the one place settings are read) |
| `models/almond_loyalty_ledger.py` | `almond.loyalty.scan` + `almond.loyalty.redemption` (server-side truth, keyed by order uuid) |
| `models/almond_loyalty_outbox.py` | `almond.loyalty.outbox` + cron processor |
| `models/pos_order.py` | fields + hooks (`_process_saved_order`, `_process_order`, `_load_pos_data_read`) |
| `models/pos_config.py` | per-shop enable + branch id |
| `models/pos_payment_method.py` | `almond_is_redemption` + POS loading |
| `models/res_config_settings.py` | settings (write-only key) |
| `controllers/main.py` | `/almond_loyalty/scan`, `/detach`, `/settle` (`jsonrpc`, `auth='user'`, open POS session required) |
| `data/ir_cron.xml` | outbox cron (5 min + triggered on each paid order) |
| `security/ir.model.access.csv` | POS managers read; system writes |
| `views/*.xml` | settings block, payment-method flag, order tab/columns, outbox/log menus |
| `static/src/app/*` | OWL: store patch, dialog, control button, barcode routing, payment-screen guard |
| `mock/almond_bff_mock.py` | stdlib mock BFF |
| `tests/test_client.py` | plain unittest (no `__init__.py` on purpose: Odoo's loader ignores it) |
