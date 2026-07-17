# Almond Web — UX Context Brief

> **Purpose:** a self-contained context brief for `almond-web` to hand to Claude Code
> (or any prompt/skill generator) when working on **UX improvements**. It captures the
> product, stack, design system, routes, current UX, known gaps, and the hard rules any
> UX change must respect. Read this first, then scope the task against §10–§11.

---

## 1. What it is
Bilingual (**Arabic-RTL default / English-LTR**) **e-commerce + loyalty website** for
**Almond Coffee House** (Evora for Food & Beverages — Amman, Jordan). It mirrors the
Almond mobile app: same real menu, same ordering, and the **same points + wallet
account** (one customer across web and app). Currency: **JOD, 3 decimals** (`2.500 د.أ`).
The loyalty currency is always called **"points / نقاط"** (never "beans" in UI).

## 2. Tech stack
- **Next.js 15 (App Router)** + **React 19** + **TypeScript (strict)**
- **Tailwind CSS** — brand tokens wired via CSS variables (never hardcode colors)
- **next-intl** — `ar` (default, `dir=rtl`) + `en` (`dir=ltr`); Arabic at `/`, English at `/en`
- **TanStack Query v5** + **Zustand** for state
- **lucide-react** icons (one line-icon family, no emoji in UI)
- Fonts: **Helvetica Neue LT Arabic** (Light / Roman / Bold) — single bilingual family
- Deployed on **Vercel** (currently mock-data mode, fully demoable offline)

## 3. Monorepo & single source of truth
```
almond/
  almond-web/      ← THIS website (Next.js)
  almond-app/      ← mobile app (React Native + Expo)
  admin-panel/     ← Vite admin (spin wheel, campaigns)
  bff/             ← server-authoritative money/loyalty backend
  packages/shared/ ← @almond/shared: types, theme tokens, menu.generated (267 items/31 cats),
                     loyalty constants, format(), categoryKind — IMPORTED, never duplicated
```
Rule: anything customers see that must match app+web (theme, menu, loyalty numbers,
wording) lives in `@almond/shared` and is imported. **Data switch:**
`NEXT_PUBLIC_DATA_SOURCE = mock | odoo` (mock today; flipping to `odoo` changes nothing else).

## 4. Design system (tokens — from `@almond/shared/theme`)
Palette is **violet / white / black** (no gold, no green):
```
primary       #6C5CB4   (actions, active states, prices)
primaryDark   #2E2552   (primary text + dark surfaces)
accentLight   #E3DEF3   (chips, badges)
neutralWarm   #ECE7F6   (icon chips, dividers, hover)
textPrimary   #2E2552   textSecondary #7A7390
error         #C0392B   success = primary (#6C5CB4)
```
Gradients: `rainbow` (signature loyalty/hero banner, dark text) · `purple` (most hero
blocks) · `dark`. Radius: cards `lg=16`, `pill=999`. Shadows: card / raised. Motion base
`300ms`. Tailwind tokens map to CSS vars: `bg-primary`, `text-text-secondary`,
`bg-gradient-rainbow`, `rounded-pill`, etc.

## 5. Sitemap (routes under `src/app/[locale]/`)
| Route | Purpose |
|---|---|
| `/` | Home: Hero → ValueProps → Your Usual → Most Loved → Loyalty cup → Branches |
| `/menu` | Full menu — category rail + live search |
| `/menu/[id]` | Item page — size, customizations, size-upsell, "goes well with" |
| `/cart` | Cart, combo banner, promo, free-drink progress, cross-sell |
| `/checkout` | Order type (pickup/dine-in/delivery), branch, payment, trust badges |
| `/checkout/success` | Confirmation, ready-in ETA, points earned |
| `/rewards` | Points balance, tier progress, redeem rewards, vouchers, activity |
| `/wallet` | Stored-value balance, top-up (+bonus points), history |
| `/gifts` | Send / redeem e-gift cards (occasions) |
| `/account` | Profile, phone, quick links |
| `/login` | Phone OTP (mock: any 4-digit code) — shared identity with app |
| `/branches` | Branch list + nearest-branch geolocation |
| `/careers`, `/franchise` | Application forms |
| `/admin` | Password-gated menu editor (mock; instant edits to site) |

## 6. Header / global nav
Sticky, `bg-white/90 backdrop-blur`. Desktop nav: **Menu · Rewards · Branches · Gifts**.
Right side: language switcher, account/login icon, **cart icon with live count badge**,
**"Order now"** button. Mobile: hamburger panel.
> ⚠️ **Points balance is NOT shown in the header yet** — it's the top pending
> loyalty-visibility item.

## 7. Components (by area, in `src/components/`)
- **home/**: Hero, ValueProps, HomeUsual, FeaturedRow, LoyaltySection, BranchesSection, ProductCard, BranchCard
- **menu/**: MenuBrowser, CategoryRail, MenuItemCard, ItemConfigurator, CrossSell
- **cart/**: CartView, CartLine, CartSummary, ComboBanner, PromoInput
- **checkout/**: CheckoutView, OrderTypeTabs, BranchPicker, PaymentMethods, OrderSuccessView
- **rewards/** RewardsView · **wallet/** WalletView · **gifts/** GiftsView
- **auth/** LoginView, AccountView · **admin/** AdminGate, MenuEditor · **branches/** BranchesExplorer
- **ui/**: Button, Cup (loyalty SVG), Logo, QtyStepper · Header, Footer, LanguageSwitcher, AppDownloadBanner, ComingSoon
- **stores/**: cartStore, loyaltyStore, orderStore, authStore, adminAuth, menuOverlayStore

## 8. Loyalty & commerce rules (from `@almond/shared`)
Earn **5 pts/JOD** · redeem **100 pts = 1 JOD** · pay-from-wallet earns **×1.5** points ·
bonus-day **×2** · tiers **bean→silver→gold→black** (×1.0/1.25/1.5/2.0) from rolling
12-month spend (0/100/300/750 JOD) · **free-drink cup fills at 10 drinks** (1 head-start) ·
**8% sales tax**. Order types: **pickup (first-class, curbside), dine-in, delivery (redirect to
Careem/Talabat)**. Payments: Wallet, CliQ, Cash, Visa, Mastercard, PayPal.

## 9. UX already shipped (the baseline — don't re-do these)
Size-upsell on item · cross-sell at cart + checkout · "Your usual" reorder · trust badges
at checkout · "N drinks to free drink" in cart · combo banner (add food/drink → +points) ·
points-earned shown at each step · loyalty cup SVG with progressbar · abandoned-cart &
expiring-points nudges · a11y pass (AA contrast, darker hero, card separation, Latin
numerals, line icons) · CDN image resize + memoized lists · nearest-branch geolocation.

## 10. Known UX gaps / opportunities (highest value)
1. **Loyalty not always visible** — no points balance / "earn N" in header or menu.
2. **No "Popular / Recommended" badges** on items; no recently-viewed / popular searches.
3. **No skeleton loaders** (menu, branches, item) — bare loading states.
4. **Prices shown ex-VAT** — tax-inclusive display is a pending decision.
5. **WCAG 2.2 AA** goals open: CI contrast guard, surface-elevation system, RTL numeral
   correctness, reduce-motion, focus-visible, dynamic type.
6. **SEO / perf** open (mostly invisible-UX): metadata + hreflang, JSON-LD
   (Restaurant/Menu/Offer), sitemap/robots/manifest/OG image, font subsetting, custom image
   loader for the deliveryhero CDN, SSG for product pages, Lighthouse budgets.
7. **Guest checkout & saved addresses** — blocked on real auth/backend.
8. **Mock only**: OTP/payments are stubbed; **no dark mode**; **no analytics/funnel** yet.
9. Minor inconsistency: emoji still appear in a few combo/cart strings (`🍽️ ☕ 🎉`) despite
   the "no emoji, line-icons only" rule.

## 11. Hard constraints for any UX change
- **RTL-first**: Arabic is the default. Use logical CSS (`start`/`end`, `ms-`/`me-`), mirror chevrons.
- **Import tokens/menu/loyalty from `@almond/shared`** — never duplicate, never hardcode hex.
- **Currency**: JOD, 3 decimals, Latin numerals; use `format()` from shared.
- **Wording**: "points / نقاط" everywhere; keep all copy in `messages/ar.json` + `en.json` (both locales).
- **Icons**: lucide line icons only, no emoji in UI.
- Don't break app↔web parity for shared data.

## 12. Run locally
```bash
npm install          # from repo root (workspaces)
npm run web:dev      # http://localhost:3000  (ar at /, en at /en)
npm run web:typecheck
```

---

## Priority UX focus areas (point Claude Code here first)
1. **Always-visible loyalty** — points balance + "earn N" in the header and on the menu (Starbucks-style). Currently hidden.
2. **Skeletons + honest empty/loading states** for menu, branches, and item pages.
3. **"Most ordered / recommended" badges** + recently-viewed + popular searches to speed decisions.
4. **Accessibility (WCAG 2.2 AA) + RTL correctness** — contrast, visible focus, reduce-motion, Latin numerals, dynamic type.
5. **Tax-inclusive prices** + remove the leftover emoji in cart strings (conflicts with the line-icon rule).

**Guidance for the tool:** instruct it to *"respect `@almond/shared` tokens, stay RTL-first,
and keep all copy in `messages/ar.json` + `en.json`"* — so any generated code fits the
system instead of breaking it.
