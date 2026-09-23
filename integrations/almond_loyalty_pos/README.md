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
- **المرتجع:** يعكس نقاط الطلب الأصلي.
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
   shows member,     <─ display ── stores almond.loyalty.scan    <── {memberId, mode, earnTicket?,
   corporate %,          only       (earn ticket, member id,          corporate?, redemption?}
   redemption value                  redemption code: SERVER only)
   applies corporate
   % as line discount

"Use it" / code ──── rpc ──> /almond_loyalty/settle ── x-pos-key ─> POST /v1/pos/redemption/settle
   adds payment line <── valueJod ── stores almond.loyalty.redemption <── {valueJod, points, ...}
   on "Almond redemption"            (value comes from the API, not the till)
   method (≤ amount due)

PAY / VALIDATE ── sync_from_ui ──> _process_order (drops almond_* keys sent by browser)
                                   _process_saved_order  → order is PAID, name assigned
                                     └─ _almond_loyalty_link (savepoint, never raises):
                                          copy scan/redemptions onto pos.order
                                          flag redemption mismatch
                                          INSERT almond.loyalty.outbox(earn)  ← no network
                                          ir.cron._trigger()
                                   ir.cron "Almond Loyalty: send earn/reverse outbox"
                                     └─ POST /v1/pos/earn {earnTicket, posOrderRef=order.name,
                                          branchId, paidTotal (money only, no redemption), paidAt}
                                        ok → pos.order.almond_earn_state=sent, points stored
                                        409 → failed, NO retry · timeout/5xx/401 → backoff retry

REFUND (paid) ───────────────────> _process_saved_order on the refund order
                                     └─ outbox(reverse) for the ORIGINAL posOrderRef
                                        (waits until that earn is done; cancelled if it never was)
                                        POST /v1/pos/earn/reverse {posOrderRef, reason}
```

---

## Install (dev-almond first)

1. Copy `almond_loyalty_pos/` into the addons path. Apps → Update Apps List → install **Almond Loyalty — POS connector** (depends only on `point_of_sale`; Python `requests`, which Odoo already ships).
2. **Settings → Point of Sale** → section **Almond Loyalty**:
   - *Almond API (all shops)* — **system administrators only**: API URL (`https://…`; plain `http` is refused except `localhost`), timeout (default 5 s), **New POS key** (write-only: typed, saved, never shown again; the form only says *Set / Not set*; *Clear key* removes it).
   - *Almond Loyalty on this shop* — per POS (the shop selected at the top): enable + **Almond branch id** (the `branchId` the API knows, e.g. `mecca-st`; the app's list is in `packages/shared/src/menu/seed.ts` — **confirm the real ids with the BFF**, Madinah Street is not in that list).
3. **Payment method for redemptions**: Point of Sale → Configuration → Payment Methods → new, e.g. «استبدال ألموند / Almond redemption», tick **Almond redemption**, add it to the shops. Accounting set-up: see *Decisions* below — **agree it with the accountant first**.
4. Open a session: the **ألموند** button appears next to the customer button.

System parameters used (all server-side):

| key | meaning |
|---|---|
| `almond_loyalty_pos.api_url` | BFF base URL |
| `almond_loyalty_pos.pos_key` | the `x-pos-key` secret (set via the write-only field) |
| `almond_loyalty_pos.timeout` | seconds, default 5 |
| `almond_loyalty_pos.allow_insecure_http` | `1` only for a dev mock on a non-localhost host |

Back office: **Point of Sale → Configuration → Almond Loyalty** → Outbox (failed/pending first; *Retry now* / *Cancel* for system admins), Redemptions log, Member scans log. POS orders get an **Almond Loyalty** tab and optional list columns.

---

## Decisions (visible on purpose — confirm with the ERP/finance team)

1. **Redemption = payment line on a dedicated payment method, not a discount line.** A redemption consumes a liability (points already issued = money owed to the member); it is not a sales discount. With a payment method the sale stays at full price (revenue and 8% VAT on the full price) and the redemption leg books against the liability: set the method's **Outstanding account** (bank-type journal) to the loyalty liability account. **Open questions for the accountant:** (a) the JoFotara/VAT treatment of a loyalty redemption in Jordan (full price + non-cash tender vs. reduced price) — this module's choice keeps full price; (b) which journal/account. Switching to a discount line later means changing only `almondSettleRedemption` in `static/src/app/pos_store_patch.js`.
2. **Corporate discount = per-line discount** (`line.setDiscount(pct)`), applied at scan time and re-applied in `pay()` for lines added later; never lowers a bigger manual discount; removed if the member is detached. Alternative: a corporate **pricelist** per company (cleaner reporting). Not decided.
3. **posOrderRef = `pos.order.name`** (as the contract says). Odoo 19 assigns it when the order is paid (`write()` on `state='paid'`). It is unique in practice (sequence prefix + receipt number) but **not DB-enforced**; `pos.order.uuid` is. If the BFF sees collisions across companies, switch to `uuid`.
4. **Refund → full reversal** of the original's points (the contract has no amount). A *partial* refund therefore reverses all points. Needs a contract change (`amount` on reverse) to be exact.
5. **A refunded redemption is not given back to the member** (the API has no "un-settle"); the refund order gets a chatter note.
6. **Redemption larger than the bill:** the payment line is capped at the amount due; the rest is lost (the cashier is asked first when the value is known before settling). Business rule to confirm.
7. **Earn only if money was collected:** `paidTotal` = Σ payment lines excluding the Almond method (the cash-change line is negative, so it nets out); if 0, no earn.

---

## What is DONE and VERIFIED (here)

- `models/almond_loyalty_client.py` — dependency-free client (only `requests`), typed errors, HTTPS enforced, no secret/token/code/ticket in logs, errors or `repr`, no internal retries. **22 unit tests green** against the mock (`tests/test_client.py`).
- `models/almond_loyalty_policy.py` — backoff, retry/fail decision (409 never retried), `paid_total`, redemption-mismatch rule. Unit-tested.
- Guards proven by **deliberate mutation** (each mutation made a test fail, then reverted): logging the key, retrying a 409, counting the redemption in `paidTotal`, printing the redemption in `repr`, allowing plain http to a remote host.
- `mock/almond_bff_mock.py` — stdlib mock of the 4 endpoints mirroring the BFF's real behaviour (fail-closed key, single-use 60 s tokens, 409 replay, earn idempotency + 409 conflict, settle-once 404).
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
6. **Alerting**: failed outbox rows only show in the back office. Hook them into the existing alert mail/cron.
7. **Housekeeping**: purge archived `almond.loyalty.scan` rows older than N days.
8. **Arabic translations**: all user strings go through `_()` / `_t()` / template auto-translation; generate `i18n/ar.po` (`--i18n-export`) and translate.

### Contract gaps to raise with the BFF (found while building)

- **401 is ambiguous on `/scan` and `/settle`:** the BFF returns 401 both for a wrong POS key and for a bad/expired member token (`bff/src/pos/token.ts`). The client tells them apart by message text (`AuthError.key_rejected`) — ask for a distinct `error` code.
- **A scanned token cannot be reused to settle:** `/scan` consumes the single-use token, so "scan the redeem QR, then settle with the same token" gets 409. This module therefore settles a scanned redemption **by the code the server kept from the scan**. Confirm that is intended.
- `earnTicket` lifetime (orders paid hours later, or retried days later by the outbox) — how long is it valid?
- `paidAt` format — sent as UTC `YYYY-MM-DDTHH:MM:SSZ`.
- Redemption code format on input — sent upper-cased with spaces removed, dash kept.
- Brute-force of 8-char codes via `/settle` — rate-limit per POS key on the BFF.
- Partial-refund reversal (needs an amount).

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
```

Test plan on the till: (1) pay member → paid → outbox row `done`, order `almond_earn_state=sent`; (2) corporate → 15% on lines, no outbox row; (3) redeem → "Use it" → payment line 2.500 on the Almond method → pay rest → earn `paidTotal` excludes 2.500; (4) mock down (`failNext`/stop it) → sale completes, row `pending` with backoff, restart → `done`; (5) re-scan same QR → "already used"; (6) refund the paid order → reverse row → `done`, original `reversed`; (7) wrong key → cashier sees "not configured", log says key refused, outbox retries after the key is fixed.

---

## Files

| path | role |
|---|---|
| `__manifest__.py` | 19.0.1.0.0, depends `point_of_sale`, assets in `point_of_sale._assets_pos` |
| `models/almond_loyalty_client.py` | HTTP client, **no Odoo imports** |
| `models/almond_loyalty_policy.py` | retry/backoff + money rules, **no Odoo imports** |
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
