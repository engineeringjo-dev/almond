# MEPS SmartPOS (Apex ECR) → Odoo 19 — Integration Handoff

**Status: paused, waiting on the Apex ECR message contract from MEPS/Apex.**
Everything build-able without that spec is done. Resume by filling ONE class.

> Authoritative brief: [`apex_ecr_claude_brief.md`](./apex_ecr_claude_brief.md) — read it first.
> Module: [`../../integrations/pos_meps_apex/`](../../integrations/pos_meps_apex/) (ships in mock mode).
> Terminal mapping: [`mecca-terminals-mapping.xlsx`](./mecca-terminals-mapping.xlsx).

## Decision (expert panel, unanimous)
Path **D (phased)**: build the custom `pos_meps_apex` cloud module on the **existing** MEPS fleet (keep the machines — the goal is only to *speed up* payment, not replace hardware); run a semi-manual bridge in the interim; do NOT switch to N-Genius (its Odoo module is online-redirect, not card-present). Reconsider only if Apex won't share the spec in ~2 weeks or N-Genius MDR is materially lower.

## What's DONE (mock mode — runnable today in a TEST Odoo 19 only)
- `models/apex_ecr_client.py` — `ApexEcrClient` isolation layer (`sale/void/refund`), **mock + live** modes, SecureKey signing scaffold, Asia/Amman **+03:00** stamping. **Server-only.**
- `models/pos_payment_method.py` — payment method `MEPS (Apex ECR)` + per-method MID/TID.
- `controllers/main.py` — `/pos_meps_apex/sale` (browser never sees the key).
- `static/src/app/payment_meps.js` — Odoo 19 POS PaymentInterface.
- `data/ir_config_parameter.xml` — defaults to `mode=mock`.
- `mock/apex_mock_server.py` — optional stdlib HTTP mock.

## What's MISSING (the ONLY gap — 3 unknowns, from MEPS/Apex only)
Isolated in `apex_ecr_client.py`, marked `TODO(Apex)`:
1. `_build_request` — endpoint + request format + amount encoding (likely int×1000, unconfirmed → param).
2. `_sign` — SecureKey signature algorithm.
3. `_parse_response` — response field names + error codes.
Plus: sandbox TID + test SecureKey (MEPS/Apex only). Then set `mode=live` + `gateway_url`.

## Gaps to close on resume (from the brief)
- [x] **Idempotency** — DONE. New `pos_meps_apex.txn` ledger keys every SALE/REFUND by a
  stable `reference`: an APPROVED retry returns the prior result (no re-charge); a
  PENDING/UNKNOWN (timeout) attempt is BLOCKED until a status/reconcile — never silently
  re-charges. (Server-verified by a guard-logic simulation.)
- [x] **Amount encoding** a config param — DONE (`pos_meps_apex.amount_encoding` = `decimal3`|`int1000`).
- [x] `status()` added to the client (timeout/UNKNOWN recovery; live endpoint still `TODO(Apex)`).
- [ ] Wire VOID/REFUND to the POS UI (client methods exist; UI buttons pending).
- [ ] SETTLE/batch reconciliation report; reconcile by **RRN** (ledger stores it), align day-close to MEPS batch at +03:00.
- [ ] JoFotara posts on the **sale**, not the auth.
- [ ] **POS should pass a stable `reference`** (idempotency key) per payment attempt so a
  real retry dedupes (payment_meps.js currently may omit it → fallback is best-effort).

## Guardrails (non-negotiable)
- SecureKey backend-only (`ir.config_parameter`), **never** in JS/QWeb/log/commit; `.env*` gitignored.
- Odoo never receives/stores PAN → out of PCI scope (SAQ B-IP). Get MEPS **ECR-cert letter + PCI AoC** before go-live.
- **Do NOT** decompile the APK or capture gateway traffic.
- **Do NOT run in live branches** until the go-live gate passes (real spec wired → sandbox → 1 test terminal → 1 pilot branch off-peak → roll out).

## Terminal mapping (Mecca branch — MID `190028450000000`, SecureKey server-side)
| Machine | TID | Serial | Model | SIM | Receipt name |
|---|---|---|---|---|---|
| Mecca 1 | 19062845 | NCAC00312988 | Newland N950S | Orange JO | KHALDA ⚠️ |
| Mecca 2 | 19022845 | NEC100043118 | Newland N950S | Umniah | UM ALSUMAQ ⚠️ |
| Mecca 3 | 19012845 | — | Newland N950S | — | — |
> ⚠️ MEPS-printed branch names are inconsistent (Khalda / Um Alsumaq) vs "Mecca" — confirm the real physical branch per TID with MEPS.

## Next action (to unblock)
Open a MEPS merchant-support ticket (portal + info@mepspay.com, CC info@apex.jo) requesting the Apex SmartPOS ECR cloud integration guide (SALE/VOID/REFUND request+response, SecureKey signature, endpoint/port, timeout model) + a UAT sandbox TID + test SecureKey. In parallel, ask a Jordan Odoo partner (Flex Ops / Smart Way) if they already have a compliant connector.
