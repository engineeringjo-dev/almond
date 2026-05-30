# Almond Coffee House — Mobile App
## Master Build Specification for Claude Code (v2.0 — FINAL)

> **CLAUDE CODE: READ THIS ENTIRE FILE FIRST. ALL DECISIONS ARE FINAL.**
> **DO NOT ask the user to confirm any choice marked in the DECISIONS section.**
> **When something is ambiguous, default to the rule in section 0 and KEEP BUILDING.**

---

# 0. OPERATING RULES FOR CLAUDE CODE — READ FIRST

These rules exist so you build the entire MVP **without stopping to ask questions**. Every decision below is final.

### 0.1 When in doubt, follow these defaults (DO NOT ASK)
- **Language/Framework:** React Native + Expo (SDK 51+), TypeScript, Expo Router. No exceptions.
- **State:** Zustand. **Data fetching:** React Query (TanStack Query v5).
- **Styling:** StyleSheet with a central theme file. No external UI kits.
- **Missing asset (image/icon):** use an emoji or a colored placeholder `View`. Never stop to ask for assets.
- **Missing backend:** use the **mock data layer** (section 6). Never block on a real API.
- **Unclear copy/text:** write it in Arabic using the tone in this doc, then continue.
- **Unclear number/price:** use the values in section 5. If still missing, use a sensible default and add a `// TODO:` comment.
- **Any new sub-decision not covered here:** pick the simplest option that ships, add a `// DECISION:` comment explaining what you chose, and CONTINUE. Do not pause.

### 0.2 Build order (do these in sequence, commit after each)
1. Project scaffold + theme + fonts + i18n (AR default, RTL)
2. Mock data layer + service abstraction (section 6)
3. Tab navigation (5 tabs) + splash + onboarding
4. Home screen (nearest branch, loyalty card, quick actions, usual order)
5. Menu screen (categories, search, item modal, customization)
6. Cart screen (Pickup smart flow, payment methods, summary)
7. Pickup confirmation + order tracking (status timeline)
8. Loyalty screen (points, tiers, cup, spin wheel)
9. Profile (history, addresses, payment methods, language toggle)
10. Delivery button → external redirect (section 7.4)
11. Spin Wheel reads live config from loyalty server (section 13.4)
12. Admin Panel web app — spin wheel control (section 13)
13. Notifications + Geofence engine (section 14) + visit rewards
14. Polish, animations, empty states, error states

### 0.3 What NOT to build in this MVP (stubs only, with TODO)
- Real aggregator integration (Talabat/Careem/Jahez) — build the **service interface** only, leave implementation as `// TODO: aggregator`
- Live GPS driver map — show status timeline only
- Real payment processing — build the UI + a mock `paymentService` that returns success

### 0.4 Code quality bar
- TypeScript strict mode ON
- Every screen handles: loading, empty, error states
- All text via i18n keys (no hardcoded strings in components)
- RTL-safe layouts (use `start`/`end`, never `left`/`right`)
- Commit messages in English, conventional commits style

---

# 1. PROJECT OVERVIEW

| | |
|---|---|
| **App Name** | Almond Coffee House |
| **Trademark (EN)** | Almond Coffee House |
| **Trademark (AR)** | ألموند كوفي هاوس |
| **Operator** | Evora for Food & Beverages — Amman, Jordan |
| **Platforms** | iOS + Android (via Expo) |
| **Scope** | Real, launchable MVP |
| **Default Language** | Arabic (RTL) — English toggle available |
| **Currency** | JOD (Jordanian Dinar), format `X.XXX د.أ` |

---

# 2. DECISIONS — FINAL (DO NOT ASK)

### 2.1 Authentication
- **Primary:** Phone number (+962) + 6-digit OTP
- OTP: 60-second resend timer, auto-fill from SMS
- Guest mode: browse only; prompt login at checkout
- Email/password: NOT in MVP

### 2.2 Payment Methods (all in MVP UI; processing is mocked)
1. 💵 Cash (on pickup / on delivery)
2. 📱 CliQ (Jordanian instant transfer)
3. 💳 Visa
4. 💳 Mastercard
5. 🅿️ PayPal
6. 💰 Wallet balance (stored value / Gift Card)

### 2.3 Order Types
- 🏃 **Pickup (SMART)** — primary in-app flow (section 7.3)
- 🛵 **Delivery** — button redirects EXTERNALLY (section 7.4)
- ☕ **Dine-in** — order ahead, pick up at counter

### 2.4 Loyalty System (separate Node.js server — section 8)
- **Points:** 5 points per 1 JOD; 1 point = 1 fils (100 pts = 1 JOD redeem)
- **Tiers (rolling 12-month spend — Revision Pack §A):** Bean (0) → Silver (100) → Gold (300) → Black (750). Computed from qualifying spend in the last 365 days (sliding window); tier can drop as old orders leave the window. Loyalty screen shows the full ladder with remaining-to-next + a "based on last 12 months" note (§B).
- **Tier multipliers:** 1.0 / 1.25 / 1.5 / 2.0
- **Friday bonus:** ×1.5 points (i.e. +50%)
- **The Cup:** fills at **10 drinks** → free drink reward. Starts with **1 head-start** (user begins at 1/10)
- **Pay-with-balance bonus:** paying from wallet balance = **1.5 cup-beans** per qualifying purchase (1.5× toward filling the cup)
- **Spin the Wheel:** fully **admin-configurable** via a separate web Admin Panel (section 13). Defaults below; all editable at runtime without code changes.
- **Spin eligibility (default):** 1 spin every 5 visits, OR 1 spin when topping up Gift Card by 50 JOD
- **Spin prizes (default 10, weighted):** 1 JOD credit (30), cookie (20), americano (18), any drink (12), omelette croissant (8), pasta (5), pizza (4), 5 JOD credit (2), cake (0.8), 10 JOD credit (0.2)
- **Spin non-cash prizes expire:** 7 days (editable)
- **Prize stock:** unlimited (no per-prize caps)
- **Points expiry:** 180 days inactivity; warn 7 days before
- **Pending points hold:** 60 min (protects against invoice cancellation)
- **Discount stacking:** OFF (one discount per invoice)

### 2.4.1 Growth Rewards (NEW)
- **Branch rating reward:** 50 points, granted **once per account, lifetime** (not per branch, not per order). After the user rates any branch for the first time, they get 50 points; never again.
- **Referral reward:** 50 points to the **referrer**, granted **once per account, lifetime**. UI message: "ادعُ أصحابك واحصل على 50 نقطة". Granted as soon as the **first** referred friend completes download + registration (OTP-verified). After the first successful referral, the referrer earns nothing further.
- **Referred friend:** receives no separate welcome bonus (referrer-only).
- **Anti-abuse (server-side, invisible to user):**
  - Referral credited only when the new friend's phone is OTP-verified and the number is unique (never seen before).
  - A user cannot refer themselves (referrer phone ≠ referred phone; basic device fingerprint check).
  - Both rewards are hard-capped at one grant each per account, so maximum exposure per user is 100 points (1 JOD) total — risk is bounded by design.

### 2.5 Menu / Pricing Source
- **Odoo 19 is the single source of truth** for menu, prices, discounts, stock
- Excel price-list/discount uploads happen **in Odoo**, NOT in the app
- App pulls menu from Odoo API (mock first — section 6)
- **Price2 column is authoritative** for pricing

### 2.6 Branches & Nearest Branch
- GPS detects user location → sort branches by distance → show distance + open/closed status
- Manual branch selection always available

### 2.7 "My Usual" (one-tap reorder)
- Show user's most-frequent order on Home as a one-tap card
- Also: reorder button on any past order

---

# 3. BRAND & DESIGN SYSTEM

### 3.1 Colors (central theme file `constants/theme.ts`)
```typescript
export const colors = {
  dark:      '#1C1208',  // deep espresso — primary
  brown:     '#6B3F1F',
  gold:      '#C8962A',  // accent — CTAs, prices
  lightGold: '#E8C86A',
  cream:     '#F5EFE0',  // background
  cardBg:    '#FDFAF4',
  warmGray:  '#8C7B6B',
  green:     '#2D6A4F',  // success
  red:       '#C0392B',  // error
  // tier colors
  tierBean:   '#8C6239',
  tierSilver: '#9AA0A6',
  tierGold:   '#C9A06A',
  tierBlack:  '#2B2B2B',
};
```

### 3.2 Typography
- **Arabic:** Tajawal (300/400/500/700) — load via `expo-font`
- **English headings:** Playfair Display
- **English body:** Inter
- Headings use serif (Playfair); body uses Tajawal/Inter

### 3.3 Design Principles
- Warm premium coffee-house aesthetic
- Cards: 16px radius, subtle shadow, cream/card backgrounds
- Gold accents only on CTAs, prices, active states
- Animations: 300ms ease; spring for the wheel & cup fill
- RTL-first; mirror everything for English

---

# 4. SCREEN-BY-SCREEN SPEC

### 4.1 Splash
- Dark bg, gold coffee-cup logo, animated gold progress bar
- 2.5s → Home (or onboarding on first launch)

### 4.2 Onboarding (first launch only)
3 slides → "ابدأ الآن" → Auth

### 4.3 Auth
- Phone (+962) + OTP screens (section 2.1)
- Guest mode entry

### 4.4 Home
Components top→bottom:
1. Top bar: logo | nearest-branch chip | cart badge | notifications
2. Time-based greeting: "صباح الكيف / مساء الكيف، [name]"
3. **"طلبك المعتاد"** one-tap reorder card (if user has history)
4. Loyalty card: points + cup progress + tier badge
5. Quick actions 2×2: اطلب الآن (Pickup) | تتبع طلبي | المكافآت | عجلة الحظ
6. Promotions carousel
7. **Nearest branches** list (GPS-sorted) with distance + open/closed

### 4.5 Menu
- Search bar (live filter)
- Category chips (section 5)
- Items grid (2 col)
- **Item modal (bottom sheet):** emoji/photo, name AR+EN, desc, size selector, customizations (milk, sugar, ice, extras), qty, running total, brunch-offer indicator
- **Brunch logic:** BR item + drink = 1.000 JOD combo discount, auto-applied, one BR food per drink

### 4.6 Cart — PICKUP SMART FLOW
- Order-type tabs: Pickup (default) | Dine-in | Delivery(→external)
- **Pickup flow:**
  1. Auto-select nearest open branch (user can change)
  2. Show **prep time estimate** + **"جاهز عند وصولك"** if travel time ≥ prep time
  3. If travel < prep: show "جاهز خلال X دقيقة"
  4. Branch KDS receives order with target-ready time
- Cart items with qty controls
- Promo code input
- Summary: subtotal, tax (16%), discount, **total JOD**
- Payment methods (section 2.2)
- CTA: "تأكيد الطلب"

### 4.7 Order Confirmation
- Animated checkmark, order #, ready-at time, "تتبع طلبك"

### 4.8 Order Tracking (status timeline, no live map in MVP)
Steps: تم الاستلام ✅ → جارٍ التحضير → جاهز للاستلام → تم الاستلام
- Show branch name, order #, countdown to ready
- Reorder button on completion

### 4.9 Loyalty & Rewards
- Points balance (large)
- **The Cup** animation: visual cup filling toward 10 (with head-start)
- Tier progress bar + current tier badge
- **Spin the Wheel** (animated, weighted prizes — section 2.4)
- Vouchers (active, with expiry)
- Points history log

### 4.10 Profile
- Header: avatar, name, tier badge
- List: طلباتي السابقة | كوبوناتي | عناوين التوصيل | طرق الدفع | رصيدي/المحفظة | **ادعُ أصحابك (Referral)** | الإشعارات | اللغة (AR/EN) | المساعدة | تسجيل الخروج

### 4.10.1 Referral Screen (NEW)
- Headline: "ادعُ أصحابك واحصل على 50 نقطة"
- Show referral code + share button (expo-sharing) → "حمّل تطبيق ألموند: {link}?ref={code}"
- State indicator: "لم تُستخدم بعد" → after first success: "✅ حصلت على 50 نقطة!"
- Once rewarded, screen shows a thank-you state (reward is one-time)

### 4.10.2 Branch Rating (NEW)
- Prompt after order completion (tracking screen): "كيف كانت تجربتك في فرع {branch}؟" → 1–5 stars + optional comment
- First-ever rating → toast "🎉 حصلت على 50 نقطة!"
- Subsequent ratings still accepted (feedback matters) but no points

### 4.11 Notifications
- Order updates, promos, points earned, new items
- Expo Notifications (FCM + APNs) — wire the client, mock the triggers
- **Two notification engines** (see section 14): (a) promotional/campaign push, (b) location-based (geofence) push
- In-app notification inbox: list of received notifications, read/unread, tap to open relevant screen
- Settings: user toggles per category (promos, order updates, location offers) — location offers require explicit opt-in

---

# 5. MENU & PRICING (JOD — seed the mock with these)

### Categories
الكل | القهوة الساخنة | المشروبات الباردة | ماتشا | الشوكولاتة | المعجنات | الكيك والحلويات | البرانش (BR) | إضافات

### Hot Coffee
| Item (AR) | Item (EN) | S | M | L |
|---|---|---|---|---|
| إسبرسو | Espresso | 1.500 | — | — |
| أمريكانو | Americano | 1.800 | 2.000 | 2.200 |
| كابتشينو | Cappuccino | 2.000 | 2.500 | 2.800 |
| لاتيه | Latte | 2.200 | 2.500 | 2.800 |
| فلات وايت | Flat White | 2.500 | 2.800 | — |
| كورتادو | Cortado | 2.000 | — | — |
| ماكياتو | Macchiato | 2.200 | 2.500 | — |

### Cold Drinks
| Item (AR) | Item (EN) | Price |
|---|---|---|
| كولد برو | Cold Brew | 3.000 |
| أيسد لاتيه | Iced Latte | 2.800 |
| أيسد أمريكانو | Iced Americano | 2.200 |
| فرابتشينو | Frappuccino | 3.500 |

### Matcha
| Item (AR) | Item (EN) | Price |
|---|---|---|
| ماتشا لاتيه (حار) | Matcha Latte (Hot) | 3.200 |
| ماتشا لاتيه (بارد) | Matcha Latte (Iced) | 3.200 |
| ماتشا إسبرسو | Matcha Espresso Fusion | 3.500 |

### Pastries
| Item (AR) | Item (EN) | Price |
|---|---|---|
| كرواسان بالزبدة | Butter Croissant | 1.800 |
| كرواسان بالجبن | Cheese Croissant | 2.200 |
| بان أو شوكولا | Pain au Chocolat | 2.500 |
| كرواسان باللوز | Almond Croissant | 2.800 |

### Brunch (BR — weekdays 8AM–12PM, weekends 8AM–2PM)
| Item (AR) | Item (EN) | Price |
|---|---|---|
| بيض بندكت | Eggs Benedict | 5.500 |
| أفوكادو توست | Avocado Toast | 5.000 |
| شكشوكة | Shakshuka | 4.500 |
| فرنش توست | French Toast | 4.800 |
| فطور إنجليزي كامل | Full English | 7.500 |

**Brunch combo:** any BR item + any drink → −1.000 JOD (auto)

---

# 6. MOCK DATA LAYER & SERVICE ABSTRACTION (CRITICAL)

> This is the key to building without a live backend AND switching to Odoo with one variable.

### 6.1 Single config switch
```typescript
// constants/config.ts
export const config = {
  // Flip this to 'odoo' when the real API is ready — NOTHING else changes
  DATA_SOURCE: 'mock' as 'mock' | 'odoo',
  ODOO_BASE_URL: 'https://api.almond.jo/v1',
  LOYALTY_BASE_URL: 'https://loyalty.almond.jo',
  DELIVERY_REDIRECT_URL: 'https://almondcoffeehouse.com/order',
};
```

### 6.2 Service interface (every service implements BOTH mock + odoo)
```typescript
// services/menu.service.ts
interface MenuService {
  getCategories(): Promise<Category[]>;
  getItems(categoryId?: string): Promise<MenuItem[]>;
  getItem(id: string): Promise<MenuItem>;
}

// Two implementations:
//   menuService.mock.ts   → returns seed data from section 5
//   menuService.odoo.ts    → calls Odoo REST
// index picks based on config.DATA_SOURCE
export const menuService: MenuService =
  config.DATA_SOURCE === 'odoo' ? odooMenuService : mockMenuService;
```

Apply the same pattern to: `authService`, `orderService`, `loyaltyService`, `branchService`, `paymentService`, `aggregatorService` (stub).

### 6.3 Odoo integration notes (for the odoo.* implementations)
- Odoo 19 likely exposes JSON-RPC at `/web/dataset/call_kw` and/or a custom REST controller
- **The user is NOT sure of exact endpoints yet** → build `odoo.*` files with clearly-named methods and `// TODO: confirm Odoo endpoint` where the path is unknown. DO NOT stop to ask. Keep `mock` as the active source.
- Auth to Odoo: API key or session — leave as configurable env var
- Two-way sync target: app order → Odoo sale order; Odoo status → app tracking. Implement the call signatures; mock the responses.

---

# 7. KEY FLOWS — DETAILED

### 7.1 Nearest Branch
1. Request location permission (expo-location)
2. Compute distance to each branch (haversine)
3. Sort ascending; show distance (km) + open/closed (compare current time to branch hours)
4. Fallback if permission denied: show all branches, manual select

### 7.2 "My Usual"
- Track order frequency per user (loyalty/order history)
- Most-frequent line-item set → "طلبك المعتاد" card → one tap adds to cart

### 7.3 Smart Pickup
1. User taps اطلب الآن → Pickup
2. App picks nearest open branch
3. Estimate **travel time** (distance ÷ avg speed, or simple lookup) and **prep time** (sum of item prep estimates, default 7 min)
4. Display: if travel ≥ prep → "سيكون جاهزاً عند وصولك ✨"; else "جاهز خلال {prep} دقيقة"
5. On confirm: send order to branch with `targetReadyAt` timestamp (so KDS times it to arrival)

### 7.4 Delivery → External Redirect
- The Delivery tab/button does NOT process delivery in-app
- It opens `config.DELIVERY_REDIRECT_URL` (almondcoffeehouse.com/order) in an in-app browser (expo-web-browser)
- That site handles the aggregator (Talabat/Careem/Jahez) link
- Add a short note in UI: "التوصيل عبر موقعنا وشركائنا"

### 7.5 Branches (seed data — Revision Pack §G: full 10-branch list)
Default hours 07:00–24:00 (7AM–midnight); mall branches follow mall hours. Each branch
exposes lat/lng for a "directions on Google Maps" action (§I).
| Name AR | Name EN | Hours |
|---|---|---|
| شارع مكة | Mecca St | 7:00–24:00 |
| الرابية | Al-Rabya | 7:00–24:00 |
| خلدا | Khalda | 7:00–24:00 |
| الدوار الثامن | 8th Circle | 7:00–24:00 |
| سيتي مول | City Mall | 10:00–22:00 (mall) |
| الجامعة | University | 7:00–24:00 |
| شفا بدران | Shafa Badran | 7:00–24:00 |
| شارع المدينة المنورة | Madina St | 7:00–24:00 |
| دير غبار | Deir Ghbar | 7:00–24:00 |
| أم السماق | Umm Al-Summaq | 7:00–24:00 |

---

# 8. LOYALTY SERVER (separate Node.js — already designed)

The app talks to a **separate loyalty server** (not Odoo) at `config.LOYALTY_BASE_URL`.

### 8.1 Loyalty endpoints the app calls
```
GET  /loyalty/balance/:userId      → { points, tier, multiplier, cup: {current, target} }
GET  /loyalty/vouchers/:userId     → active vouchers
POST /loyalty/redeem               → { userId, points } redeem
POST /loyalty/spin                 → { userId } → prize (server-weighted)
GET  /loyalty/spin/eligibility/:userId → { canSpin, spinsAvailable }
POST /loyalty/earn                 → { userId, invoiceAmount, paidFromBalance, isFriday } → points + cupBeans
GET  /loyalty/history/:userId      → points log
POST /loyalty/rate-branch          → { userId, branchId, orderId, rating } → grants 50 pts ONCE per account
POST /loyalty/referral/claim       → { referrerId, referredPhone } → grants 50 pts to referrer ONCE per account
GET  /loyalty/referral/code/:userId → { code, alreadyRewarded: bool }
```

### 8.1.1 Growth-reward logic (server-side, mirror in mock)
```
// Branch rating — once per account lifetime
if (user.hasRatedBranchEver) → reject (already rewarded), but still save the rating
else → save rating, grant 50 pts, set user.hasRatedBranchEver = true

// Referral — once per account lifetime, referrer only
on referral/claim:
  if (referrer.hasReferralRewardEver) → no points (cap reached)
  else if (referredPhone not OTP-verified) → pending, no points yet
  else if (referredPhone already exists in system) → reject (not a new user)
  else if (referredPhone == referrer.phone) → reject (self-referral)
  else → grant 50 pts to referrer, set referrer.hasReferralRewardEver = true
```

### 8.2 Earn calculation (server-side, mirror in mock)
```
basePoints   = invoiceJod * 5
tierBonus    = basePoints * (tier.multiplier - 1)
fridayBonus  = isFriday ? basePoints * 0.5 : 0          // ×1.5 total
points       = round(basePoints + tierBonus + fridayBonus)

cupBeans     = paidFromBalance ? 1.5 : 1                // pay-from-balance = 1.5 beans
cup.current  = min(cup.target, cup.current + cupBeans)
if cup.current >= 10 → issue free-drink voucher, reset cup to head-start (1)
```

### 8.3 Mock the loyalty server too
Build `loyaltyService.mock.ts` implementing all the above in-memory so the app's loyalty screens fully work offline.

---

# 9. FILE STRUCTURE
```
almond-app/
├── app/
│   ├── (auth)/        login.tsx, otp.tsx
│   ├── (tabs)/        index.tsx(Home), menu.tsx, cart.tsx, track.tsx, profile.tsx
│   ├── order/         confirm.tsx, [id].tsx
│   ├── loyalty.tsx, spin.tsx
│   ├── splash.tsx, onboarding.tsx
│   └── _layout.tsx
├── components/        ui/, menu/, cart/, loyalty/(Cup, Wheel), home/
├── stores/            cartStore, authStore, appStore
├── services/          *.mock.ts + *.odoo.ts + index per domain
├── hooks/             useMenu, useCart, useOrder, useLoyalty, useNearestBranch
├── constants/         theme.ts, config.ts, fonts.ts
├── locales/           ar.json, en.json
├── types/             index.ts
├── app.json, package.json
```

---

# 10. LOCALIZATION
- AR default, RTL. EN toggle, LTR.
- All strings in `locales/ar.json` + `locales/en.json`. No hardcoded text.
- JOD: AR `X.XXX د.أ` | EN `JOD X.XXX`
- Use `I18nManager.forceRTL` correctly on language switch.

---

# 11. SUCCESS FACTORS (build these in — competitive checklist)

### Starbucks success factors we MUST match (all in scope):
- ✅ Strong tiered loyalty (points + tiers + cup + spin)
- ✅ Mobile order + fast pickup (Smart Pickup)
- ✅ Stored value / wallet top-up (Gift Card + balance, +bonus)
- ✅ Drink customization (item modal)
- ✅ Unified cross-branch experience (Odoo central)
- ✅ Gamification (Friday bonus, spin wheel, filling cup)
- ✅ One-tap reorder ("My Usual")
- ✅ **Built-in growth loops:** referral reward (50 pts) + rating reward (50 pts), both one-time and abuse-bounded

### Starbucks failure modes we MUST avoid:
- ❌ Mobile-order congestion ruining in-store experience
  → **Smart Pickup gives realistic ready-time; per-branch order throttling; KDS times order to arrival**
- ❌ Over-complex rewards program → keep tiers/cup simple and visual
- ❌ Slow app / heavy screens → React Query caching, lazy loading, optimistic UI

---

# 13. ADMIN PANEL — SPIN WHEEL CONTROL (separate web app)

A **separate web admin panel** (React + Vite, served alongside the loyalty server) lets the owner control the Spin Wheel at runtime. No code deploys needed for any change here. All settings are stored in the loyalty server DB and read live by the app.

### 13.1 Eligibility Controls (when the wheel appears)
- **Master switch:** enable/disable the entire wheel
- **Visits per spin:** number input (default 5)
- **Gift Card top-up for spin:** JOD amount (default 50)
- **Free-spin days:** multi-select weekdays (e.g. enable a free spin every Friday)
- **Scheduled campaigns:** create rules with **start/end dates** that auto-activate and auto-expire, e.g.:
  - "Ramadan: 1 spin per order over 10 JOD" — start 2026-02-18, end 2026-03-19
  - Campaign fields: name, condition (per-order min / per-visit / per-topup), value, startDate, endDate, active

### 13.2 Prize Controls
- **Add / edit / delete** any prize
- Per prize: name (AR+EN), type (credit / free-item / voucher), credit value (if cash), **weight** (probability), enabled toggle, expiry days
- **Live odds preview:** show each prize's real % based on current weights (sum normalized to 100%)
- No stock caps (unlimited prizes — per decision)
- Reorder prizes (visual order on the wheel)

### 13.3 Admin Panel Endpoints (loyalty server)
```
GET  /admin/spin/config            → full current config (eligibility + prizes + campaigns)
PUT  /admin/spin/eligibility       → update master switch, visitsPerSpin, topupAmount, freeSpinDays
GET  /admin/spin/prizes            → list prizes
POST /admin/spin/prizes            → add prize
PUT  /admin/spin/prizes/:id        → edit prize (name, weight, type, value, enabled, expiryDays)
DELETE /admin/spin/prizes/:id      → remove prize
GET  /admin/spin/campaigns         → list scheduled campaigns
POST /admin/spin/campaigns         → add campaign { name, condition, value, startDate, endDate }
PUT  /admin/spin/campaigns/:id     → edit campaign
DELETE /admin/spin/campaigns/:id   → remove campaign
```
All `/admin/*` endpoints require admin auth (JWT with admin role).

### 13.4 How the app reads it
- The wheel screen calls `GET /loyalty/spin/eligibility/:userId` and `GET /loyalty/spin/config`
- The server computes eligibility live, applying: base rule + free-spin days + any active scheduled campaign (where today is within start/end)
- Prize selection is **always server-side** (weighted random) — the client never decides the prize (anti-cheat)
- Config changes in the admin panel take effect immediately; the app refetches config on wheel open

### 13.5 Admin Panel build notes for Claude Code
- Build as `admin-panel/` (React + Vite + TypeScript), separate from the mobile app
- Mock the admin auth + config store first (same mock pattern as section 6), so it runs standalone
- Simple, clean dashboard UI; Arabic RTL interface
- Forms with validation; live odds preview computed client-side from weights

---

# 14. NOTIFICATIONS & GEOFENCE ENGINE

Two engines, both controllable from the Admin Panel (section 13). Built on Expo Notifications (FCM Android + APNs iOS). Mock the send/trigger layer first so screens work standalone.

### 14.1 Engine A — Promotional / Campaign Push
- Owner composes a campaign from the Admin Panel: title (AR+EN), body, image (optional), deep link (open Menu / Spin / a specific item), audience (all / by tier / by inactivity), and **schedule** (send now or at a date/time).
- Server sends via FCM/APNs to opted-in users; logged in the in-app inbox.

### 14.2 Engine B — Location-Based (Geofence) Push
**Trigger:** when the user comes within **1000 m of ANY branch**, send a push showing their **current points balance** as a nudge to visit.

**Rules (final):**
- Max **once per day per user** (hard cap), regardless of how many branches passed.
- Requires **background location permission** + explicit opt-in for "location offers".
- Radius (1000 m) is **editable from Admin Panel**.
- Quiet hours respected (default 8AM–10PM, configurable).

**Message example:**
`☕ رصيدك 1,240 نقطة! فرع ألموند {branch} قريب منك — مرّ علينا 🎁`

**Technical (for Claude Code):**
- Use `expo-location` background geofencing (`Location.startGeofencingAsync`) with one region per branch (radius from config).
- On region ENTER → check server-side daily cap → if allowed, fetch points balance → send notification.
- iOS allows max 20 simultaneous geofence regions (we have 6 branches — fine). Background location is the hardest permission to obtain → show a clear pre-permission explainer screen first ("نرسل لك عرضاً عندما تكون قريباً من فروعنا").
- Daily cap enforced server-side (`/notifications/geofence/eligibility/:userId`) so reinstalling can't bypass it.

### 14.3 Visit-Triggered Reward (linked to geofence/visit)
When the user visits after a geofence nudge (or any visit), the owner can attach a reward — **type chosen in Admin Panel**:
- **(a) Time-boxed discount** — e.g. "خصم 15% صالح خلال 3 ساعات" with a visible countdown
- **(b) Spin the Wheel spin** — grant 1 spin, usable within a time window

**Rules:**
- Reward type, value, and **redemption window (hours)** all set from Admin Panel.
- Reward appears in-app with a **countdown timer**; expires automatically if unused.
- One active visit-reward per user at a time.
- Issuance and expiry tracked on the loyalty server.

### 14.4 Notification & Geofence Endpoints
```
# Push registration
POST /notifications/register-token   → { userId, expoPushToken, platform }
GET  /notifications/inbox/:userId     → received notifications
PUT  /notifications/read/:id          → mark read
PUT  /notifications/settings/:userId  → category opt-ins

# Geofence
GET  /notifications/geofence/eligibility/:userId → { canNotifyToday: bool }
POST /notifications/geofence/triggered → { userId, branchId } → sends balance push if eligible

# Visit reward
POST /rewards/visit/issue             → { userId, type, value, windowHours }
GET  /rewards/visit/active/:userId    → active reward + expiry
POST /rewards/visit/redeem            → { userId, rewardId }

# Admin (require admin auth)
GET/POST/PUT/DELETE /admin/notifications/campaigns[/:id]  → manage promo campaigns
GET/PUT  /admin/geofence/config        → { enabled, radiusMeters, dailyCap, quietHours }
GET/PUT  /admin/rewards/visit/config   → { type: discount|spin, value, windowHours, enabled }
```

### 14.5 Admin Panel additions (extends section 13)
Three more tabs:
- **Campaigns:** compose/schedule promotional push; show audience size estimate
- **Geofence:** toggle on/off, set radius (default 1000m), daily cap (default 1), quiet hours
- **Visit Reward:** choose discount vs spin, set value and redemption window

---

# 15. FIRST PROMPT (paste into Claude Code with this file attached)

```
Build the Almond Coffee House mobile app per the attached spec
(ALMOND-APP-SPEC-v2.md). Follow section 0 operating rules strictly:
do NOT ask me to confirm decisions — they are all final in the spec.
Work through the section 0.2 build order in sequence, committing after
each step. Use the mock data layer (section 6) as the active data source.
Start now with step 1: scaffold the Expo + TypeScript + Expo Router
project, set up the theme, Tajawal font, i18n with Arabic RTL default,
and the tab navigation skeleton. Then continue through all 14 steps
without pausing.
```

---

*Almond Coffee House — Evora for Food & Beverages — Amman, Jordan*
*Spec v2.0 — FINAL — May 2026*
