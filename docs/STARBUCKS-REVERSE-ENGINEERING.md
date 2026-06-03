# Starbucks App — Reverse-Engineering & Engagement Playbook
### Reference for Almond Coffee House implementation

Screenshots archived in `docs/reference/starbucks/` (01–16). This document
decodes **how the app works** and **why it's so habit-forming**, then maps each
mechanic to Almond (have it ✅ / gap ⬜) with how to build it.

---

## 1. Information architecture (4 tabs + persistent context)

Bottom nav = **Home · Order · Gift · Rewards** (only four — ruthless focus).

- **Persistent "Pickup store + cart" bar** pinned above the tab bar on every
  Order screen → context never lost, cart always one tap away. *(03, 07, 16)*
- **Floating Rewards/Scan star** bottom-right on Home → the money action
  (scan/pay/earn) is always reachable. *(11)*
- Order has 4 sub-tabs: **Menu · Featured · Previous · Favourites** *(03, 05, 07)*.

> Almond today: 5 tabs (Home/Menu/Cart/Track/Profile) + a Pay&Earn FAB. We
> already have the floating action; we're missing the persistent store+cart bar
> and the Previous/Favourites order tabs.

---

## 2. Core flows (the "what")

### 2.1 Order flow
`Browse (Menu/Featured/Previous/Favourites) → Item → Customize → Cart → Pay → Pickup`
- **Item screen**: big photo, **calories ⓘ**, **visual size selector with volume
  (Tall/Grande… 12/16 fl oz + cup icons)**, customization ("What's Included" +
  **Add-ins**), **♥ favourite** + **share**, sticky **Add to order**, persistent
  store bar w/ cart count. *(Play-store set: item screen)*
- **Featured** = merchandised seasonal collections with large photos
  ("Summer Favorites", "Matcha for every mood", "Food Right for Anytime"). *(07,16)*
- **Previous** = reorder history (even **in-store** purchases appear, because the
  card/loyalty links them). *(05)*
- **Favourites** = user-saved drinks (♥) for instant reorder. *(03)*

### 2.2 Loyalty engine ("Stars")
- **Earn**: Stars per $ — **rate rises with tier** (Green 1★/$1 → Reserve 1.7★/$1). *(01,13)*
- **Tiers by yearly earn**: Green (<500★) → … → **Reserve (2,500+★)**, each with a
  **differentiated benefits list**, shown as a swipeable status card. *(01,13)*
- **Redemption MENU (tiered catalog)**: 25★ ($1 off customization) · 60★ (NEW, up
  to $2 off) · 100★ (coffee/bakery) · 200★ (handcrafted drink) · 300★ (sandwich —
  **🔒 "61★ away"**) · 400★ (merch — 🔒) → each with image + value + **locked +
  "X★ away"** states. *(Play-store: Rewards menu)*
- **Birthday treat** every year (30-day redeem window at top tier). *(01,13)*
- **Free Mod Mondays** — one free drink customization per month. *(01,13)*
- **Expiry**: Stars expire on inactivity at low tiers; **"Stars won't expire" is a
  TOP-TIER perk** (loss-aversion flipped into a reward). *(13)*

### 2.3 Stored value (Cards)
- Multiple **digital cards** with artwork, balance, **"Earns 1★ per $1"** on the card. *(Play-store: Scan&pay)*
- **Reload → bonus Stars** ("Bonus Stars for qualifying digital reloads"). *(01,13)*
- **Scan & pay** (one barcode earns + pays) vs **Scan only** (earn without paying). *(Play-store)*
- **Double Stars with personal cup** (bring your own cup). *(01,13)*

### 2.4 Gifting (a whole tab)
- **eGifts by occasion** (Birthday, Thank You, Graduation, Father's Day,
  Appreciation, Encouragement, Workplace, collabs like Miffy). *(02,06,08)*
- **Group gifting** — send up to 10 eGifts per purchase. *(02,08)*
- "Got a gift card? Add it here", eGift history/resend. *(06)*

### 2.5 Offers / campaigns
- **"Just for you"** personalized offers + **activatable challenges** ("Double Star
  Day → Activate now"), **early access & games**. *(Play-store: Earn&Redeem)*
- **New-member welcome offer**: free handcrafted drink on first qualifying
  purchase within first week. *(Play-store: Offer details)*

---

## 3. Why it's addictive — the habit loop (the "why")

Starbucks = a textbook **Hook Model** (Trigger → Action → Variable Reward →
Investment) wrapped in behavioural-economics levers:

| Lever | How Starbucks uses it | Where |
|---|---|---|
| **Variable reward** | Stars, Double-Star Days, games, surprise offers — unpredictable bonuses fire dopamine harder than fixed ones | 01, Play-store |
| **Goal-gradient + endowed progress** | "🔒 61★ away", tier progress, the rising cup — motivation accelerates near the goal; a head-start makes you feel already on the path | Rewards menu |
| **Tiered status / identity** | Green → Gold → Reserve, exclusive black Reserve card, "as your status grows, so do your benefits" — status becomes identity you protect | 01, 13 |
| **Loss aversion** | Stars **expire** (use-it-or-lose-it) → nudges a visit; removing expiry is itself a top-tier reward | 13 |
| **Sunk cost / pre-commitment** | Preloaded **card balance** commits future spend; reload-bonus stars pull money in early | 13 |
| **Reduced friction = habit** | Saved **Favourites** + **Previous** + stored value + mobile-order pickup → reorder in ~2 taps; the easier the action, the stronger the habit | 03, 05 |
| **Personalization** | "Just for you", favourites, previous, "Make your best choices over and over" | 05, Play-store |
| **Reciprocity / surprise & delight** | Birthday treat, Free Mod Mondays, welcome free drink — unearned gifts trigger reciprocation | 01, 13 |
| **Triggers** | Geofence near store, time-based push, "Activate now" offers, badge counts | Play-store |
| **Social / viral** | eGifts + group gifting spread the brand and create obligation loops | 02, 06 |
| **Routine framing** | "Get rewarded for your routine" — explicitly anchors the app to a daily ritual | 01 |

**The compounding loop:** preload money → ordering is frictionless → earn Stars →
see you're "X away" from a reward → redeem → status climbs → unlock better earn
rate + perks → which makes the next reward feel closer → repeat. Each visit makes
the next visit cheaper (in effort) and more rewarding.

---

## 4. Almond mapping — have vs gap

| Mechanic | Almond status | Build note |
|---|---|---|
| Mobile order + smart pickup | ✅ | done |
| Customization (milk/sugar/ice/extras/size) + upsize + pairings | ✅ | done (ahead of SB on upsell) |
| Stored value wallet + pay-from-balance bonus | ✅ | add **reload-bonus** + multiple cards |
| Barcode/QR pay screen + redeem | ✅ | add **Scan-only vs Scan&Pay** toggle + earn-rate label |
| Points + tiers (rolling 12m) + multiplier + cup | ✅ | earn-rate already scales by tier |
| "My Usual" auto reorder | ✅ | add **manual ♥ Favourites** ⬜ |
| Geofence nudge + visit reward + countdown | ✅ | strong trigger already |
| Referral (one-time 50 pts) | ✅ | |
| **Rewards redemption MENU (tiered, locked, "X away")** | ⬜ | **high value** — catalog of 50/150/300… items |
| **Activatable challenges / "Double Points Day" / games** | ⬜ | admin already has a campaign engine; surface "Activate" offers |
| **New-member welcome offer (free drink)** | ⬜ | acquisition hook for launch |
| **Favourites (♥)** | ⬜ | quick win |
| **Status & Benefits view (per-tier perks)** | ⬜ | we show thresholds only |
| **Calories / nutrition on items** | ⬜ | add data field |
| **Visual size selector w/ volume (ml)** | ⬜ | polish |
| **eGifts / gifting tab + group gifting** | ⬜ | social/viral, larger build |
| **Persistent store + cart bar while ordering** | ⬜ | small, high-utility |
| **Previous-orders tab in the order flow** | partial | exists in Profile; surface in menu |
| **Birthday treat + bring-your-own-cup bonus** | ⬜ | reciprocity perks |

---

## 5. Suggested build order for Almond (highest ROI first)
1. **Rewards redemption menu** (tiered catalog + "X points away" + locked) — biggest motivation lever.
2. **Favourites (♥)** + surface **Previous** in the order flow — friction killers.
3. **Status & Benefits** screen (per-tier perk list) — makes tiers feel worth chasing.
4. **Welcome offer** + **activatable bonus-points day** — acquisition + recurring spikes.
5. **Calories + visual sizes** — trust/polish.
6. **eGifts/gifting** — social growth (bigger project).

---

## 6. Screenshot index (`docs/reference/starbucks/`)
- **01** Rewards intro: "How it works" + Green-status benefits list
- **02, 06, 08** Gift cards: occasion eGifts + group gifting + eGift FAQ
- **03** Order ▸ Menu (categories, persistent store/cart bar, Menu/Featured/Previous/Favourites tabs)
- **05** Order ▸ Previous (reorder history incl. in-store)
- **07, 16** Order ▸ Featured (seasonal merchandised collections)
- **11** Home (hero, rewards promo, floating star)
- **13** Rewards ▸ Reserve-status benefits (premium tier perks, higher earn rate, no-expiry)
- (04, 09, 10, 12, 14, 15 — additional rewards/gift/featured frames)

*Starbucks screenshots are third-party, kept only as an internal design reference.*

---

## 7. Lessons mined from the Starbucks Rewards Terms of Use (2026)

We take **mechanics only** — never their copy, marks, or "Stars". Mapped to Almond:

### Adopted now ✅
- **Digital reload bonus** → bonus **beans** on wallet top-up (≥20 JOD → +50, ≥35
  JOD → +120, highest tier applies, admin-set `WALLET_RELOAD_BONUS`). Strong
  pre-commitment / sunk-cost lever; shown on the wallet screen.
- **Redemption tiers = max value, pay the difference** → each reward is a *max*
  value; if the item costs more, the member pays the difference (hint on the
  rewards menu). Keeps fixed-cost tiers fair and flexible.
- **"Beans don't expire" as a top-tier perk** → loss-aversion flipped into a
  reward (Gold/Black benefit line). Positive framing, no punishment of regulars.

### Adopted now ✅ (second pass)
- **Double Beans Day (activatable)**: config-driven `BONUS_BEAN_DAY` (weekdays +
  multiplier); member taps **Activate** (persisted per day) and the bonus
  multiplies the order's base beans, stacking before the tier multiplier. Banner
  on the Rewards screen. Variable-reward lever, not a game.
- **Gentle bean expiry**: `BEAN_EXPIRY_MONTHS` (12) — Bean/Silver beans stay
  active for a year after the last earn/reload; **Gold/Black never expire**.
  Status shown under the beans balance ("active until …" / "never expire ✓").
  Generous window so it nudges without punishing (§5).
- **Guest checkout earns nothing** — already enforced (earning is gated to signed-in).

### Documented for later ⬜ (need POS / voucher-application infra — don't half-ship)
- **Two-balance model**: a *tier* balance separate from the *redeemable* balance.
  We approximate it (tier from rolling spend vs redeemable beans); formalize on Odoo.
- **Free customization once a month** ("Free Mod Mondays") — needs end-to-end
  voucher application at checkout/POS to ship cleanly.
- **Bring-your-own-cup → double beans** — eco perk that fits Almond; needs POS to
  verify the cup at the counter (declaring it in-app alone is abusable).
- **Returns deduct beans** (can go negative) — data-integrity rule for the Odoo
  earn/void sync.

### Resolved — beans follow the Starbucks model (no cash value) ✅
- Decision taken: **beans have no cash value** and are **never** converted to
  wallet money. They redeem only for catalog **Rewards** (vouchers) from the
  tiered ladder. Implemented:
  - `redeem` (beans→wallet) and `spendPoints` (pay-with-beans) **removed** from
    the service, hook, and all screens; replaced by `redeemReward` → issues a
    voucher and deducts beans.
  - **Pay-with-beans** removed as a checkout payment method.
  - Rewards-menu cards are now tappable → confirm → redeem → voucher added
    ("show your barcode at the counter").
  - Cash-worth lines and redeem-to-wallet buttons removed from the Rewards,
    Pay (barcode), and Loyalty screens; beans shown as a ☕ count.
  - Wallet keeps its real-money role (top-up, pay-from-balance +50%, reload bonus).
- **Out of scope (prior decisions):** birthday reward, games/secret menu, full
  gift-card system — kept out per the Order & Wallet specs.
