# @almond/bff — Almond backend-for-frontend

Server-authoritative money & loyalty API that sits between the clients
(Expo app on GitHub Pages, Next.js website) and the source of truth
(Odoo 19 / loyalty server). **Secrets live only here** — never in a
client bundle. Built per `docs/IMPLEMENTATION-PLAYBOOK.md` §1.

## Why
The app used to charge the wallet, create the order and grant points as three
separate client calls, trusted a client-supplied `userId`, and inlined API keys
into a public bundle. This service fixes all of that:

- **Identity from the token** — every endpoint reads the member from the JWT
  `sub`; clients never send a `userId`.
- **Idempotency** — financial POSTs require a client-generated `Idempotency-Key`
  (UUID) header; a retry returns the first response instead of charging twice.
- **Atomic checkout** — `POST /v1/checkout` re-prices from the menu (client
  totals are ignored), debits the wallet, creates the order and grants
  server-computed points as one saga, compensating (refunding the wallet) on
  failure.
- **Signed, single-use POS tokens** — short-lived HMAC tokens replace the old
  static, replayable QR string.
- **Secrets server-side** — Odoo/loyalty keys are read from the environment.

## Endpoints
| Method | Path | Notes |
|---|---|---|
| POST | `/v1/auth/otp/request` | `{ phone }` → sends OTP (dev: fixed code) |
| POST | `/v1/auth/otp/verify` | `{ phone, code }` → `{ token, member }` |
| POST | `/v1/checkout` | 🔒 + Idempotency-Key — atomic order + earn |
| POST | `/v1/wallet/topup` | 🔒 + Idempotency-Key — reload + bonus |
| POST | `/v1/loyalty/redeem` | 🔒 + Idempotency-Key — spend points |
| POST | `/v1/pos/token` | 🔒 — issue a short-lived POS token |
| POST | `/v1/pos/scan` | server-to-server (`x-pos-key`) — verify a token |
| GET | `/v1/me/balance` `/wallet` `/history` | 🔒 |
| GET | `/health` | liveness |

🔒 = requires `Authorization: Bearer <jwt>`.

## Run
```bash
npm install --legacy-peer-deps          # from the repo root
cp bff/.env.example bff/.env            # set secrets
npm run dev  -w @almond/bff            # tsx watch on :8080
npm test     -w @almond/bff            # vitest smoke suite
```

## Shared logic
Pricing, tax, tiers, the earn formula and the `MAX_EARN_MULTIPLIER` cap all come
from `@almond/shared` — the same source the app and website use — so all three
always agree.

## Going live (Odoo 19)
Set `DATA_SOURCE=odoo` and implement `src/backend/odoo.ts` (each method maps to
an Odoo call; see the file's comments and IMPLEMENTATION-PLAYBOOK §2). Nothing
else changes — routes, auth, idempotency and the saga stay the same.
