# Almond Web — UX research & recommendations

What the most successful coffee / QSR ordering experiences do, distilled into a
prioritized plan for `almond-web`. Sources are the public ordering flows of
**Starbucks**, **Costa**, **McDonald's**, **Dunkin'** and **Pret**, plus
well-established e-commerce UX research (checkout, mobile, trust). This is a
living doc — items get ticked as they ship.

> Owner asked specifically to weigh **upselling & cross-selling**, the
> **Starbucks-style simple ordering** the app mirrors, and overall UX.

## 1. What the leaders do well

**Starbucks**
- "**Your usual**" / reorder front-and-center — fastest path to a repeat order.
- Loyalty (Stars) is everywhere: balance in the header, progress to the next
  reward, "earn X" on each item — gamified, always visible.
- Deep but quick customization (size, milk, shots) with live price.
- Store locator with "nearest" + pickup-first.

**McDonald's**
- Relentless **upsell/cross-sell**: "make it a meal", "add fries", "anything
  else?" before pay. Combos and add-ons at every step.
- Big, photographic product tiles; minimal text; fast tap targets.

**Costa / Pret / Dunkin'**
- Clean category navigation with a sticky rail; search.
- Strong **trust at checkout** (payment logos, secure note), guest checkout,
  clear totals + fees before commitment.
- Generous imagery on white, consistent rounded cards.

## 2. Principles we follow

1. **Pickup-first, low-friction**: fewest taps from home → order → pay.
2. **Loyalty always visible**: points balance + "earn N" + progress to a reward.
3. **Upsell at the item, cross-sell at the cart & checkout** (highest intent).
4. **Personalization**: surface the last/usual order to returning customers.
5. **Trust before payment**: payment methods, secure note, totals up-front.
6. **Mobile + RTL first**: logical properties, large targets, sticky CTAs.
7. **Speed & clarity**: real photos on white, skeletons, honest empty states.

## 3. Recommendations (prioritized) → status

| # | Recommendation | Pattern from | Status |
|---|---|---|---|
| 1 | Size **upsell** nudge on the item page | McD/SBUX | ✅ shipped (#56) |
| 2 | **Cross-sell** at the cart + at checkout | McD | ✅ shipped (#50, #56) |
| 3 | "**Your usual**" reorder on home | Starbucks | ✅ this PR |
| 4 | **Trust badges** (payment logos + secure) at checkout | Costa/Pret | ✅ this PR |
| 5 | "**N drinks to a free drink**" progress in cart | Starbucks | ✅ this PR |
| 6 | Points balance + "earn N" visible in header/menu | Starbucks | ☐ next |
| 7 | "Popular / Recommended" badges on items | McD | ☐ next |
| 8 | Recently viewed / popular searches | SBUX | ☐ next |
| 9 | Skeleton loaders for menu/branches | general | ☐ next |
| 10 | Guest checkout + saved addresses (needs auth) | general | ☐ backend |

## 4. Upsell / cross-sell map (where each lever fires)

- **Item page** → *size upsell* ("Go Large for +0.300") + *"goes well with"*.
- **Cart** → *complete your order* cross-sell + *free-drink progress* nudge.
- **Checkout** → *add a little extra* cross-sell (impulse, pre-pay).
- **Wallet** → *reload bonus* points (pre-commitment lever).
- **Rewards** → redeemable rewards + tier progress (retention lever).

## 5. Measurement (when analytics land)

Track: home→order start rate, add-to-cart rate, cart→checkout→placed funnel,
attach rate of cross-sell items, upsize take rate, AOV, repeat-order rate via
"Your usual". These map 1:1 to the levers above.
