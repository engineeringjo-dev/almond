# pos_meps_apex — MEPS SmartPOS (Apex ECR) for Odoo 19 POS

Card-present Visa/Mastercard on your **existing MEPS SmartPOS** terminals
(Apex app, `com.apex.smartpos_meps`), **cloud / semi-integrated** — the amount
is pushed to the terminal automatically (no re-keying). **Ships in MOCK mode**
so you can run the whole flow today, before Apex hands over their spec.

## ▶️ See it working TODAY (mock mode — no Apex needed)
1. Copy `pos_meps_apex/` into your Odoo 19 addons; **Apps → Update List → Install**.
   (Ships with system param `pos_meps_apex.mode = mock`.)
2. **Point of Sale → Configuration → Payment Methods → New**:
   - Name: `Visa (MEPS)` · Use a Payment Terminal: **MEPS (Apex ECR)**
   - MID `190028450000000` · TID `19062845` (or `19022845`)
   - Assign it to your POS.
3. Open a POS session → add a product → **Payment → Visa (MEPS) → Validate**.
   → the mock returns **APPROVED** with a fake auth/RRN, the payment posts on the
   order, and it reconciles like a real card line. **Full cashier flow, end-to-end.**

Optional HTTP-path test: run `python3 mock/apex_mock_server.py`, then set
`pos_meps_apex.mode=live` + `pos_meps_apex.gateway_url=http://127.0.0.1:8899/sale`.

## Architecture
```
POS (browser)                 Odoo (server)                 Apex cloud / MOCK
  pick "Visa (MEPS)" ──rpc──> /pos_meps_apex/sale ──SALE(signed,SecureKey)──► terminal (by TID)
  approval on line <────────── ApexEcrClient  ◄──── {approved, auth, rrn, maskedPan} ◄─┘
```
PAN never touches Odoo → **out of PCI scope**. Timestamps are **+03:00**.

## When Apex sends ONE real sample → change 3 methods only
Everything vendor-specific is isolated in `models/apex_ecr_client.py`:
- `_build_request` — the request fields/shape
- `_sign` — the SecureKey signing algorithm
- `_parse_response` — the response field names
Then set `pos_meps_apex.mode = live` and `pos_meps_apex.gateway_url`. Nothing
else in the module changes.

## Config (System Parameters — server-only)
| key | value |
|---|---|
| `pos_meps_apex.mode` | `mock` (default) / `live` |
| `pos_meps_apex.gateway_url` | Apex ECR endpoint (live) |
| `pos_meps_apex.securekey.<MID>` | e.g. `pos_meps_apex.securekey.190028450000000` = `F510…` |

## Files
- `models/apex_ecr_client.py` — the mock/live adapter (**the only place Apex lives**)
- `models/pos_payment_method.py` — `MEPS (Apex ECR)` terminal + MID/TID fields
- `controllers/main.py` — server endpoint (holds no secrets on the client)
- `static/src/app/payment_meps.js` — POS payment interface (Odoo 19)
- `mock/apex_mock_server.py` — optional stdlib HTTP mock

## Compliance guardrails (from the review panel)
- Store only **masked PAN + auth + RRN** — never full PAN/track/CVV.
- Reconcile by **RRN**, align POS day-close to the MEPS **batch** at **+03:00**.
- **JoFotara** posts on the **sale**, not the auth. Get MEPS's **ECR-cert letter + PCI AoC** before going live (SAQ B-IP).

## Next iteration
VOID/REFUND wired to the UI, SETTLE/batch reconciliation report, offline/timeout
UX. `refund()` / `void()` already scaffolded in the adapter.

> Needs a real Odoo 19 env to run; mock mode removes the Apex dependency so it's
> runnable the moment it's installed. Verify the JS against an existing Odoo 19
> terminal module (Stripe/PAX) on first install.
