# Odoo / Loyalty-Server / POS Integration — Wiring Guide

Everything below is **prepared but inactive**. The app runs entirely on the mock
(`config.DATA_SOURCE = 'mock'`). When the backend is ready you flip switches and
fill URLs/keys — no UI rewrites.

## How to go live (3 steps)
1. **Set base URLs + auth** (build-time env, inlined by Expo):
   - `EXPO_PUBLIC_ODOO_API_KEY`, `EXPO_PUBLIC_LOYALTY_TOKEN`
   - `config.ODOO_BASE_URL`, `config.LOYALTY_BASE_URL` (`constants/config.ts`)
2. **Enable systems** — flip `config.DATA_SOURCE` to `'odoo'`, or bring one
   system online first via `integration.enabled.{loyalty|wallet|gift|pos}`
   (`constants/integration.ts`).
3. **Implement/confirm the server endpoints** below. The app's live clients
   already call them (`services/loyalty.service.live.ts`, shared
   `lib/apiClient.ts`).

All endpoint paths live in one place: `integration.endpoints`. All calls go
through `lib/apiClient.ts` (base URL + bearer/API-key + timeout).

---

## 1) POS deduction (earn / redeem / wallet charge at the till)

The barcode screen shows `ALMOND|MEMBER|{userId}|MODE=PAY|EARN`.

- **MODE=PAY** → till charges the order (cash/card/wallet) **and** earns beans.
- **MODE=EARN** → earn only (customer pays separately).

Flow:
1. Odoo POS scans the token and `POST`s to the loyalty server:
   `POST /pos/scan` → `{ memberId, mode, invoiceAmount, paidFromWallet, branchId }`
   The server then earns beans (`/loyalty/earn` logic), redeems any applied
   reward, and—if `paidFromWallet`—charges the wallet (`/loyalty/wallet/charge`).
2. The app, while the barcode is on screen, polls
   `GET /loyalty/scan-status/{userId}` → `{ scanned: boolean, result? }`.
   On `scanned: true` it shows the success state and refreshes the balance.
   (Hook: `useScanStatus`, active only when `integration.enabled.pos`.)

> The app never calls `/pos/scan` — that's server-to-server from Odoo POS.

## 2) E-wallet (stored value)

- `GET  /loyalty/wallet/{userId}` → `{ balance }`
- `POST /loyalty/wallet/topup` → `{ userId, amount }` → `{ balance }`
  (server also grants reload-bonus beans, see `WALLET_RELOAD_BONUS`)
- `POST /loyalty/wallet/charge` → `{ userId, amount }` → `{ walletBalance }`
  Used for **in-app** wallet payment (cart, gated by `integration.enabled.wallet`)
  and **POS** wallet payment. Pay-from-wallet still earns +50% beans
  (`WALLET_EARN_MULTIPLIER`).

## 3) Gift cards (eGifts)

- `POST /loyalty/gifts/send` → `{ senderId, designId, amount, recipientName,
  recipientPhone?, message? }` → `GiftCard` (server charges the sender and
  generates the code; group gifting = one call per recipient).
- `GET  /loyalty/gifts/sent/{userId}` → `GiftCard[]`
- `POST /loyalty/gifts/redeem` → `{ userId, code }` → `{ amount, walletBalance }`
  (gift value flows into the wallet).

---

## Loyalty (beans) endpoints (already wired in the live client)
`/loyalty/balance/{id}` · `/loyalty/earn` · `/loyalty/redeem-reward` ·
`/loyalty/history/{id}` · `/loyalty/vouchers/{id}` · referral + rate-branch.

`earn` payload includes `paidFromBalance`, `bonusMultiplier`, `isFriday` so the
server reproduces the +50% wallet, Double Beans Day, and Friday bonuses.

## Menu / Orders (Odoo) — already stubbed
- `services/menu.service.odoo.ts` (JSON-RPC `product.template` / `product.category`).
- `services/order.service.ts` → `odooOrderService`: app order → Odoo POS/sale
  order, status sync back. Confirm endpoints when Odoo 19 is up.

## Security notes
- Tokens are build-time `EXPO_PUBLIC_*` — fine for a public client only if the
  server scopes them per-member; otherwise use a short-lived session token from
  the OTP login and inject it in `loyaltyAuthHeaders()` instead.
- The QR encodes a stable member token. Replace with a rotating/POS-issued token
  when Odoo POS is connected (see `app/(tabs)/pay.tsx` `qrValue`).
