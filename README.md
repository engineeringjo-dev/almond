# Almond Coffee House ☕

Mobile app + admin panel for **Almond Coffee House** (Evora for Food & Beverages — Amman, Jordan).
Menu browsing, smart pickup ordering, delivery hand-off, and a full loyalty/rewards system.

Built per `ALMOND-APP-SPEC-v2.md`. Arabic-first (RTL) with an English toggle. Currency: JOD (`X.XXX د.أ`).

## Monorepo layout

```
almond/
├── almond-app/     # React Native + Expo (SDK 51) mobile app — iOS + Android
└── admin-panel/    # React + Vite admin web app — Spin Wheel + notifications control
```

## Mobile app (`almond-app/`)

**Stack:** Expo Router · TypeScript (strict) · Zustand · React Query (TanStack v5) ·
i18next · react-native-svg · expo-location / expo-notifications.

### Run
```bash
cd almond-app
npm install
npm start          # then press i / a, or scan with Expo Go
npm run lint       # tsc --noEmit (type-check)
```

### Mock vs. real backend — one switch
`constants/config.ts` → `DATA_SOURCE: 'mock' | 'odoo'`.
- `mock` (default): everything runs offline from the in-memory mock layer (`services/*.mock.ts`).
- `odoo`: menu/orders hit Odoo 19 (`services/*.odoo.ts`), loyalty/notifications hit the
  Node loyalty server (`*.live.ts`). Endpoint paths are stubbed with `// TODO: confirm Odoo endpoint`.

Every domain has a service interface + both implementations selected by the switch:
`menu`, `branch`, `auth`, `order`, `payment`, `aggregator` (stub), `loyalty`, `notification`.

### What's implemented
- **Auth:** phone (+962) + 6-digit OTP (60s resend, auto-fill), guest mode.
- **Home:** GPS nearest-branch, time greeting, My Usual reorder, loyalty card, quick actions,
  promos, branch list, visit-reward banner.
- **Menu:** categories, live search, 2-col grid, item bottom sheet (size + milk/sugar/ice/extras),
  brunch combo logic (−1.000 JOD).
- **Cart:** smart pickup (nearest open branch, prep-vs-travel ready estimate, `targetReadyAt`),
  dine-in, delivery → external redirect; promo codes; 16% tax; 6 payment methods.
- **Orders:** animated confirmation, status timeline + countdown, reorder, branch rating.
- **Loyalty:** points, filling Cup (head-start), tiers, redeem, vouchers, history,
  **server-decided weighted Spin Wheel** reading live admin config.
- **Profile:** history, vouchers, addresses, payments, wallet (top-up), referral, language, help.
- **Notifications:** inbox + per-category settings, background **geofence** balance nudge
  (daily cap, opt-in explainer), visit rewards with countdown.

### Loyalty rules (mirrored in `loyalty.service.mock.ts`)
5 pts/JOD · tiers Bean/Silver/Gold/Black (×1.0/1.25/1.5/2.0) · Friday ×1.5 · Cup fills at 10
(1 head-start; pay-from-balance = 1.5 beans) · referral + first-rating = 50 pts each, one-time.

## Admin panel (`admin-panel/`)

**Stack:** React + Vite + TypeScript, Arabic RTL.

```bash
cd admin-panel
npm install
npm run dev        # http://localhost:5174  (login: any username + password in mock mode)
npm run build
```

Controls (stored via mock store mirroring the loyalty-server `/admin/*` endpoints; flip
`src/config.ts` `DATA_SOURCE` to `live`):
- **Spin Wheel:** master switch, visits-per-spin, top-up amount, free-spin days, prize CRUD
  with reorder + **live odds preview**, scheduled campaigns (start/end).
- **Campaigns:** compose/schedule promo push, audience-size estimate.
- **Geofence:** enable, radius (1000m), daily cap, quiet hours.
- **Visit Reward:** discount vs. spin, value, redemption window.

## Out of scope (MVP stubs, per spec §0.3)
Real aggregator integration (interface only), live GPS driver map (timeline only),
real payment processing (mocked `paymentService`).
