# Almond Coffee House — Website Handoff

Build a **bilingual (AR-RTL / EN-LTR) e-commerce + loyalty website** that mirrors
the mobile app: customers browse the real menu, order (pickup / delivery), pay,
and **earn / redeem the same loyalty "beans" points as the app — on one shared
account**. This doc is the single source of truth to start a fresh session.

> Repo: `engineeringjo-dev/almond` · the existing app lives in `almond-app/`
> (React Native + Expo). Put the website in a **new top-level folder
> `almond-web/`** in this same repo (monorepo) so it can reuse the theme, types,
> and menu directly.

---

## 0. Why a new session (in this same repo)

The app sessions are long and full of mobile-fix context. Start the website in a
**fresh session** for a clean context budget, but **in this repo** so you can
import/copy the design tokens, `types/index.ts`, and `services/menu.generated.ts`
instead of re-deriving them. A copy of the kickoff prompt is at the end.

---

## 1. Primary goal & scope

- **Sell like the app:** real menu, item customization, cart, checkout, order
  type (pickup / dine-in / delivery), payment.
- **Loyalty parity:** show beans balance, tier, earn on purchase, **redeem beans
  for rewards**, gift cards, wallet (stored value) top-up & pay.
- **Same account across app + web:** one customer, one beans/wallet balance.
  Login by phone (OTP) — identical identity to the app.
- **Bilingual + RTL-first:** Arabic is the default language (RTL); English is LTR.

Out of scope for v1 (confirm with owner): admin dashboard, KDS, spin-wheel admin.

---

## 2. Recommended tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript (strict)** | SSR/SEO for a sales site; RSC-friendly. |
| Styling | **Tailwind CSS** with the brand tokens below mapped into `tailwind.config` | Or CSS variables — keep tokens centralized like the app's `theme.ts`. |
| i18n / RTL | `next-intl` (or `next-i18next`), `dir="rtl"` on `<html>` for AR | AR default; mirror the app's `locales/ar.json` + `en.json` keys where useful. |
| State / data | TanStack Query v5 (same as app) + lightweight store (Zustand) | Keep a `DATA_SOURCE: 'mock' | 'odoo'` switch like the app. |
| Forms / OTP | Phone-first auth (Jordan `+962`) | Must resolve to the **same user id** as the app. |
| Fonts | **Helvetica Neue LT Arabic** (Light / Roman / Bold) — bilingual | Files in `almond-app/assets/fonts/` (reuse). |
| Deploy | Vercel (preferred) or GitHub Pages static export | App already deploys web preview via GitHub Pages workflow. |

Keep an explicit **mock data layer first** (so the site is fully demoable before
the Odoo/loyalty backend is wired), exactly like the app.

---

## 3. Brand & theme tokens (authoritative — copy verbatim)

Active theme is **violet / white / black** (NO gold, NO green). Source:
`almond-app/constants/theme.ts`.

### Colors
```
primary        #6C5CB4   // violet — primary actions, active states, brand fills, prices
primaryDark    #2E2552   // deep violet — primary text + dark surfaces
accent         #6C5CB4   // = primary (prices/highlights)
accentLight    #E3DEF3   // light violet (chips, badges)
secondary      #8478C0   // lighter violet (mid tone)
neutralWarm    #ECE7F6   // soft lavender tint (icon chips / thumbs / dividers)
background     #FFFFFF   // pure white (no beige)
card           #FFFFFF
textPrimary    #2E2552
textSecondary  #7A7390   // muted violet-gray
success        #6C5CB4   // violet (no green)
error          #C0392B
white          #FFFFFF
```
Tier colors (loyalty badges): bean `#8C6239`, silver `#9AA0A6`, gold `#C9A06A`,
black `#2B2B2B`. (Note: app's tier ramp also defined; use these from `tiers`.)

### Gradients (hero blocks)
```
rainbow  #EAF4EC → #F7F1D4 → #F3D9B6 → #E6A2AF → #C796C1   // signature loyalty/hero banner (dark text)
purple   #C2B9DB → #9DAAD1 → #7E84C8 → #6C5CB4              // most hero blocks (lavender → violet)
dark     #6C5CB4 → #2E2552
```

### Type scale
```
font family: Helvetica Neue LT Arabic (Light/Roman/Bold) — single bilingual family
weights available: Light, Roman(regular), Bold (no medium → use Bold for emphasis)
sizes (px): xs 12 · sm 14 · md 16 · lg 18 · xl 22 · xxl 28 · display 36
```

### Spacing / radius / shadow
```
spacing:  xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32
radius:   sm 8 · md 12 · lg 16(cards) · xl 24 · pill 999
shadow.card:   y3 blur10 rgba(46,37,82,.12)
shadow.raised: y6 blur16 rgba(46,37,82,.20)
timing.base: 300ms ease
```

### Logo & assets
- Brand mark + product photos: `almond-app/assets/` (logo variants in
  `assets/`/`components/ui/Logo.tsx`; ~75 product photos in `assets/menu/`).
- The loyalty "cup" is a custom line-art SVG (`components/loyalty/Cup.tsx`) — a
  paper cup with a 2-bean logo that fills with coffee toward a 10-drink target.
  Recreate as an SVG on web for the loyalty widget.

---

## 4. Design language (match the app)

- Starbucks-grade, clean, generous spacing, rounded cards (`radius.lg`).
- **One line-icon family** (lucide). No emoji in UI. The app maps each menu
  category to one icon by name — see `almond-app/lib/categoryKind.ts` +
  `lib/productIcon.ts` (reuse the same name-based classification).
- Product thumbnails: white background, `object-fit: contain`, square.
- RTL: mirror rows, chevrons point left in AR. AR default.
- Currency: **JOD**, 3 decimals (e.g., `2.500 د.أ`). Helper in `lib/format.ts`.

---

## 5. Data model (reuse `almond-app/types/index.ts` verbatim)

Key entities — copy the TypeScript interfaces directly:
- `Category`, `MenuItem` (`sizes: ItemSize[]`, `customizations: CustomizationGroup[]`,
  `imageUrl`, `isDrink`), `CustomizationGroup/Option`, `ItemSize` (S/M/L, JOD).
- `CartItem`, `Order` (`type`, `branchId`, `subtotal/tax/discount/total`,
  `paymentMethod`, `status`, `targetReadyAt`).
- Loyalty: `TierId` (`bean|silver|gold|black`), `Tier`, `LoyaltyBalance`
  (`points`, `windowSpend`, `tier`, `multiplier`, `cup`, `beansExpireAt`),
  `CupState`, `Voucher`, `PointsLogEntry`, `EarnResult`.
- `GiftCard` + `GiftOccasion`, `Branch`, `PaymentMethod`, `User`.

**Menu data:** the real menu is generated from the Talabat export at
`almond-app/services/menu.generated.ts` (31 categories, 267 items, with AR/EN
names, descriptions, prices, modifiers, and Talabat CDN `imageUrl`s). **Reuse
this file** as the website's menu source under mock mode.

---

## 6. Loyalty / points / wallet logic (authoritative constants)

From `almond-app/constants/config.ts` — the website MUST use the same numbers so
balances match the app:
```
POINTS_PER_JOD          5      // earn: 5 beans per 1 JOD (× tier multiplier; × wallet 1.5; × bonus-day)
POINTS_PER_JOD_REDEEM   100    // redeem: 100 beans = 1 JOD
WALLET_EARN_MULTIPLIER  1.5    // paying from wallet earns +50% beans (before tier multiplier)
WALLET_RELOAD_BONUS     [{20→+50 beans}, {35→+120 beans}]
BONUS_BEAN_DAY          { enabled, multiplier 2, weekdays, must Activate }
BEAN_EXPIRY_MONTHS      12     // Bean/Silver expire after 12mo inactivity; Gold/Black never
TAX_RATE                0.16   // 16%
CUP_TARGET              10     // free-drink cup; CUP_HEAD_START 1
DEFAULT_PREP_MINUTES    7
```
Tiers from **rolling 12-month spend** (`almond-app/services/seed.ts`):
`bean 0 (×1.0) → silver 100 (×1.25) → gold 300 (×1.5) → black 750 (×2.0)`
(thresholds in JOD). Helpers: `tierFromSpend`, `nextTier`.

Rewards/redeem, gift cards, wallet top-up/charge: see the app's
`hooks/useLoyalty`, `stores/cartStore.ts` (`computeTotals` = subtotal + tax −
discounts), and `app/(tabs)/rewards.tsx`.

---

## 7. Backend integration (the critical part for "shared points")

The app keeps **all integration behind one switch** and never calls live APIs
under `mock`. Mirror this exactly. Source: `almond-app/constants/integration.ts`
+ `constants/config.ts` + `docs/ODOO-INTEGRATION.md`.

```
DATA_SOURCE: 'mock' | 'odoo'           // flip to go live; nothing else changes
ODOO_BASE_URL:    https://api.almond.jo/v1
LOYALTY_BASE_URL: https://loyalty.almond.jo
Per-system flags: enabled.{ loyalty, wallet, gift, pos }
Auth: Odoo API key (X-Odoo-Api-Key), loyalty Bearer token (env at build time)
```
Loyalty/wallet/gift endpoints (relative to the loyalty base URL):
```
GET  /loyalty/balance/:userId
POST /loyalty/earn
POST /loyalty/redeem-reward
GET  /loyalty/history/:userId
GET  /loyalty/vouchers/:userId
GET  /loyalty/wallet/:userId
POST /loyalty/wallet/topup
POST /loyalty/wallet/charge
POST /loyalty/gifts/send · GET /loyalty/gifts/sent/:userId · POST /loyalty/gifts/redeem
```
**Shared-account requirement:** the website must authenticate the customer to the
**same `userId`** the app uses (phone-based identity in Odoo/loyalty server), so
the beans balance, wallet, tier, vouchers, and gift cards are one and the same
across app and web. Source of truth in production: **Odoo 19**. Until the backend
is live, run the website on the **same mock contracts** as the app.

---

## 8. Branches & payments (reuse from `services/seed.ts`)

8 real branches (coords approximate — TODO replace with exact Google Maps pins):
Mecca Street, Drive Thru, 8th Circle, Rabyeh, University of Jordan, Khalda,
City Mall (10:00–23:00), Shafa Badran. Default hours 07:00–24:00.

Payments (ordered by local preference): Wallet, CliQ, Cash, Visa, Mastercard,
PayPal.

---

## 9. Suggested website sitemap

```
/                     Home — hero (rainbow loyalty banner), order CTA, featured, branches
/menu                 Full menu (category nav, search) — RTL-aware
/menu/[id]            Item page/modal — sizes, customizations, nutrition, cross-sell
/cart                 Cart + cross-sell ("complete your order")
/checkout             Order type, branch/pickup, payment, place order
/rewards              Beans balance, tier progress, redeem rewards, vouchers
/wallet               Stored-value balance, top-up (reload bonus), history
/gifts                Send/redeem e-gift cards (occasions)
/account              Profile, orders, addresses, language
/login                Phone OTP (shared identity with the app)
/branches             Branch list + map
```
Reuse the app's cross-sell engine logic (`lib/recommendations.ts` +
`lib/categoryKind.ts`) for "goes great with" and cart suggestions.

---

## 10. Reuse strategy (don't duplicate)

Cleanest options, pick one:
1. **Shared package** `packages/shared/` (types, theme tokens as plain TS,
   `menu.generated.ts`, loyalty/pricing constants, categoryKind, format helpers)
   imported by both `almond-app/` and `almond-web/`. Best long-term.
2. **Copy + reference** for v1 speed: copy `types/index.ts`,
   `services/menu.generated.ts`, the constants, and `lib/categoryKind.ts` into
   `almond-web/`, and keep this handoff as the contract.

Either way: **theme tokens, loyalty constants, and the menu file are the contract
between app and web** — keep them identical.

---

## 11. Open decisions to confirm with the owner

- Domain: `almondcoffeehouse.com` (the app already references
  `https://almondcoffeehouse.com/order` as `DELIVERY_REDIRECT_URL`).
- Delivery: in-house vs redirect to Talabat/Careem for delivery (app currently
  redirects). Pickup is first-class.
- Auth provider for web OTP that maps to the same Odoo/loyalty `userId`.
- Exact branch coordinates (still approximate).
- Whether v1 web is **mock-only demo** (recommended first) or wired to live Odoo.

---

## 12. Kickoff prompt for the new session (paste this)

> Build the Almond Coffee House **website** in this repo under `almond-web/`,
> following `docs/WEBSITE-HANDOFF.md` exactly. Goal: a bilingual (Arabic-RTL
> default, English-LTR) e-commerce + loyalty site that sells the real menu and
> shares the same beans/points + wallet account as the mobile app in `almond-app/`.
> Use Next.js (App Router) + TypeScript strict + Tailwind, the violet/white/black
> theme tokens from the handoff, Helvetica Neue LT Arabic fonts, and a
> `DATA_SOURCE: 'mock' | 'odoo'` switch (start in mock). Reuse `types/index.ts`,
> `services/menu.generated.ts`, the loyalty constants from `constants/config.ts`,
> and `lib/categoryKind.ts` from `almond-app/`. Start by scaffolding the project +
> theme + i18n/RTL + home page, then menu → cart → checkout → rewards/wallet/gifts.
> Commit + push to a feature branch and open a PR per section. Do NOT touch
> `almond-app/`’s runtime behavior.

---

_Generated from the live app source: `constants/theme.ts`, `constants/config.ts`,
`constants/integration.ts`, `types/index.ts`, `services/seed.ts`,
`services/menu.generated.ts`, `lib/categoryKind.ts`._
