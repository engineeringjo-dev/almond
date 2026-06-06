# Auth & payments — secure, shared-account design

Two requirements: (1) **one customer account across web + app** so points/wallet
are shared, and (2) a **secure** site since it takes card payments.

> Mock now (no secrets in the client); the seams below flip to live with
> `DATA_SOURCE='odoo'` + the relevant keys.

## 1. Identity — phone OTP → the same `userId`

- Login is **phone‑first (Jordan +962) OTP**, identical to the app.
- The OTP is verified by the loyalty/Odoo auth service, which resolves the phone
  to a **single `userId`**. Web and app both authenticate to that id, so the
  **beans/points, wallet, tier, vouchers and gift cards are one and the same**.
- The website never stores a password; the session is a short‑lived token.

```
POST /auth/otp/request   { phone }            → sends a code
POST /auth/otp/verify    { phone, code }      → { userId, token }
```

Mock: any 4‑digit code logs you in; the `userId` is derived deterministically
from the phone (so the "same phone = same account" idea is demoable). Live: the
loyalty server issues the token + the real `userId`.

## 2. Payments — PCI‑safe by construction

- **Never** touch raw card data in our code. Use a PCI‑DSS gateway with **hosted
  fields / a hosted page** (e.g. HyperPay or Checkout.com for Jordan; tap/CliQ
  for local rails). The card is tokenised by the gateway; we only see a token.
- Flow: create a payment intent on the server (Odoo) → gateway collects the card
  (hosted) → webhook confirms → order marked paid → loyalty earn fires.
- Wallet / CliQ / cash are handled as today (wallet is stored value in Odoo).

```
POST /payments/intent    { orderId, amount } → { clientSecret }   (server-side)
gateway hosted fields/redirect collects the card  (no PAN in our app)
POST webhook /payments/confirm                → mark paid + earn points
```

Mock: `data/payment.ts#payForOrder` approves instantly. Live: create the intent
server‑side and hand off to the gateway — **no card data in `almond-web`**.

## 3. Transport & session security (live)

- HTTPS only; secure, http‑only session cookie (or short‑lived bearer) — not in
  `localStorage` for the real token.
- Rate‑limit OTP requests; lock after N failed codes.
- Secrets (gateway, loyalty, Ishbek, Odoo) are **server‑side env**, never shipped
  to the browser. The mock client uses no secrets.

## To go live (checklist)

1. Pick the gateway (HyperPay / Checkout.com) + get keys.
2. Implement `auth/otp/*` against the loyalty server; map phone → `userId`.
3. Implement `payments/intent` + the confirm webhook server‑side.
4. Move the session token to an http‑only cookie.
5. Flip `DATA_SOURCE` (or the per‑system flags) to `odoo`.
