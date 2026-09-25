# Public menu feed — for the website (almondcoffeehouse.com)

The website's WhatsApp order page reads **the same menu as the loyalty app**:
the same items, prices, milk choices and photos, all pulled from Odoo. It is
**read-only**: no login, no customer data, no keys.

| | |
|---|---|
| **Endpoint** | `GET https://almond-gules.vercel.app/api/public/menu` |
| **Static copy** | `npm run menu:export -- --out <dir> [--base <photo origin>]` writes `menu.json` and the `menu/*.webp` photos |
| **Source** | `packages/shared/src/menu/publicFeed.ts`, built from `menu.generated.ts` (the Odoo pull) |
| **Guards** | `almond-web/test/public-menu.test.ts`. It pins every field name, so no private field can be added by accident. |

## HTTP behaviour

- **CORS.** `Access-Control-Allow-Origin` is sent only to the origins listed in
  `PUBLIC_MENU_CORS_ORIGINS`. The default is `https://almondcoffeehouse.com`
  and `https://www.almondcoffeehouse.com`. A WordPress server can fetch the feed
  server-side (`wp_remote_get` plus a transient cache), where CORS does not
  apply.
- **Caching.** `Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`.
  The body changes only when the menu is pulled again from Odoo and the site
  redeploys.
- **Rate limit.** 60 requests per minute per IP, returning `429` with
  `Retry-After: 60`. The limit is best-effort and per server instance; the CDN
  cache absorbs normal traffic before it reaches the limit.
- **Photo host.** Photo URLs are absolute, on the host the request arrived on.
  To pin them to another host, set `PUBLIC_MENU_ASSET_BASE`.

## Fields

```jsonc
{
  "schema_version": 1,
  "updated_at": "2026-09-25",          // date of the last Odoo pull
  "currency": "JOD",
  "prices_include_tax": true,           // every price already includes the 8% sales tax
  "tax_rate": 0.08,
  "image_max_px": 512,                  // longest side of the photos
  "branches": [{ "slug": "rabieh", "name_ar": "الرابية", "name_en": "Rabieh", "app_branch_id": "rabyeh" }],
  "categories": [{ "id": "cat-23", "name_ar": "…", "name_en": "Iced Specialty Coffee", "sort": 0 }],
  "option_groups": [{
    "id": "milk", "name_ar": "نوع الحليب", "name_en": "Milk Type",
    "required": true, "multi": false, "default_choice_id": "fresh_milk",
    "choices": [{ "id": "oat_milk", "name_ar": "حليب شوفان", "name_en": "Oat Milk", "price_delta": 0.4 }]
  }],
  "items": [{
    "id": "p-10357", "odoo_template_id": 10357,
    "name_ar": "ايس سبانيش لاتيه", "name_en": "Iced Spanish Latte", "desc_ar": "", "desc_en": "",
    "category_id": "cat-23",
    "price": 3.75,                      // "from" price: cheapest size + cheapest choice of each required group
    "sizes": [{ "id": "small", "name_ar": "صغير", "name_en": "Small", "price": 3.75 },
              { "id": "medium", "name_ar": "وسط", "name_en": "Medium", "price": 4.35 }],
    "option_group_ids": ["milk", "extra_drink"],
    "tags": [],                         // gluten_free | keto | sugar_free | vegan | seasonal
    "branches": ["mecca", "rabieh", "…"],
    "image_url": "https://almond-gules.vercel.app/menu/p-10357.webp",   // null when there is no photo
    "available": true, "sort": 300,
    "upsell": {                         // what to offer ON this item (measured, see below)
      "size_upgrade": { "from_size_id": "small", "to_size_id": "medium", "extra_price": 0.6, "share": 0.39 },
      "popular_choices": [{ "group_id": "milk", "choice_id": "lactose_free_milk", "share": 0.05 }],
      "modifiers": [{ "modifier_id": "m-11374", "share": 0.02 }]
    },
    "cross_sell": [{ "item_id": "p-10260", "attach_rate": 0.03, "lift": 1.31 }]   // what to offer WITH it
  }],
  "modifiers": [{ "id": "m-11374", "category": "extra_drink", "name_ar": "كولد فوم إضافي", "name_en": "Extra Cold Foam", "price": 0.6 }],
  "insights_window": { "from": "2026-08-11", "to": "2026-09-25", "days": 45, "orders": 134306 },
  "offers": []                          // no price offers are active
}
```

### Rules the order page must follow

- **Price of a line** = `size.price + Σ choice.price_delta` for the chosen
  choices, × quantity. The order total is the sum of the lines. Tax is already
  included in that total; the tax portion is `total × 0.08 / 1.08`.
- **Required groups** (`required: true`) take exactly one choice; pre-select
  `default_choice_id`. Other groups are optional, and any number of their
  choices can be picked.
- **Option groups** are shared across items. When two products carry different
  choices or prices under the same Odoo attribute, the second version gets its
  own id (`milk_2`, `extras_3`). Always read the choices through the item's
  `option_group_ids`.
- **Sizes.** Every size has its own id. Whole cakes have up to five sizes; the
  app is currently limited to three (S/M/L), and that is a known app bug.
- **Hot and iced** are separate items in Odoo ("Hot Latte" and "Iced Latte"),
  not an option. **Decaf** and **extra shot** are choices inside the
  `extra_drink` / `extra_frappe` groups.

## Upsell, cross-sell and modifiers — measured from Odoo POS orders

`npm run menu:insights` (`scripts/odoo-menu-insights.ts`, read-only) reads every
paid POS order line of the last 45 days. Refund lines, and the catering till
(70), are left out. It writes **only totals and percentages per product**:
no order, customer, cashier or branch data. These three measurements go into
the feed:

| Field | How it is measured | How to show it |
|---|---|---|
| `upsell.size_upgrade` | The next size up, and the share of the item's sales in that size | «كبّرها لوسط +0.600» (upgrade to Medium for +0.600) |
| `upsell.popular_choices` | **Paid** choices only (free ones such as Fresh Milk are defaults). An Odoo POS line records its choices with the same ids the menu uses, so this is a direct count | Show these first in the item's options |
| `upsell.modifiers` | Odoo also sells add-ons as **separate products**: Extra Cold Foam, Ice Cream, Extra Shot… Odoo links them to no item, so the link is measured: an add-on rung **straight after** an item in the same order was added to that item | Show as «أضف …» (add …) with the price from top-level `modifiers` |
| `cross_sell` | Items **from another category** in the same order (market basket). `attach_rate` = P(B given A); `lift` = how much more likely than for any order (> 1). A pair needs at least 25 orders, lift ≥ 1.1 and attach ≥ 2%. Gifts (Sides) and coffee tools are never suggested | «يطلبها معه عادةً» (usually ordered with it), after the item is added |

- **Thresholds:** a choice or add-on needs at least 2% of the item's sales and
  at least 15 occurrences.
- **New items** (like this week's autumn drinks) have little history, so they
  gain suggestions as they sell.
- **Add-on names:** Odoo has no Arabic names for them, so `publicFeed.ts`
  carries a stopgap map. An Arabic name set in Odoo replaces it.

## Keeping it up to date — daily sync from Odoo

`.github/workflows/menu-sync.yml` runs every day at 05:30 Amman time, and can
also be started by hand from Actions → "Menu sync from Odoo" → Run. Each run:

1. Pulls the menu and photos (`menu:pull`) and measures the insights
   (`menu:insights`). Both are read-only.
2. Stops if nothing changed.
3. Runs the full gate (lint, types, tests, build, E2E).
4. Only if everything passes, commits to `main`. That redeploys the website,
   so the feed updates on its own.

**Setup (once):** add the repository secrets `ODOO_URL`, `ODOO_DB`,
`ODOO_LOGIN` and `ODOO_API_KEY`. Use a **dedicated Odoo user with read-only
rights**, not an administrator's key: the scripts only read, and the key should
not be able to do more.

## Where each value comes from

| Value | Odoo source |
|---|---|
| Items | `product.template` with `available_in_pos` and `active`. These categories are left out: modifier categories (32–35, 38, 39), 37 "Closed" (staff drinks at 0), 46 "Services" (delivery fees, gift cards), products with no POS category, and products whose cheapest configuration costs 0 (Custom Cake, open price) |
| Price | `list_price` plus each attribute value's `price_extra`. The project documents treat `list_price` as the reference "Price2" |
| Sizes | The attributes `Drink Size`, `Cake Size` and `Pizza Size & type` |
| Options | Every other attribute, with its price from `price_extra` |
| Single or multi choice | `product.attribute.display_type` in Odoo: radio → `required: true, multi: false` with a default; checkbox → optional, any number |
| Branches | `CATEGORY_BRANCH_LIMITS`: pizza and pasta only at Rabieh, 8th Circle, JU, Madina and Shafa Badran (GM, 2026-09-25). Every other item is sold at all branches. The pull does not yet read `pos.config` per branch |
| Tags | Category name ("Gluten-free …", "Seasonal Drinks") or item name (gluten/GF/جلوتين, keto/كيتو, sugar free, vegan/نباتي, pumpkin/gingerbread/fall/autumn/خريف/قرع) |
| Photos | `image_1920`, resized to 512 px WebP by `npm run menu:pull` |

## Order payload — one structure for WhatsApp now and for app orders later

This is what the website should build before it writes the WhatsApp message.
It uses the ids from this feed:

```jsonc
{
  "schema": "almond.order.v1",
  "channel": "website_whatsapp",
  "branch": "rabieh",                         // branches[].slug
  "fulfilment": "pickup",                     // pickup | delivery
  "payment": "cash",                          // cash | cliq
  "customer": { "name": "…", "phone": "07…", "address": "…" },   // typed by the customer; sent in WhatsApp only, never stored by us
  "lines": [
    { "item_id": "p-10357", "size_id": "medium",
      "choices": { "milk": ["oat_milk"], "extra_drink": ["extra_shot"] },
      "qty": 2, "note": "" }
  ],
  "totals": { "total": 10.30, "currency": "JOD", "prices_include_tax": true }
}
```

The app's checkout (`POST /v1/checkout`, member-only) takes the same order as
`{ branchId, orderType, paymentMethod, lines: [{ itemId, sizeId, optionIds, qty }] }`.
To turn the payload above into it:

| Payload | App checkout |
|---|---|
| `branch` | `branchId` = `app_branch_id` |
| `fulfilment` | `orderType` |
| `payment` | `paymentMethod` |
| `item_id` | `itemId` (unchanged) |
| `size_id` | `sizeId`, the size in the same position as S/M/L (until the app takes the feed's size ids) |
| each chosen choice | `optionIds`: the app's `o-<odoo value id>` for the choice with the same name in the item's group |
| totals | The server re-prices every order; a total sent by a client is never trusted |

WhatsApp link: `https://wa.me/962794343400?text=<encodeURIComponent(message)>`.
