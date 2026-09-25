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
    "available": true, "sort": 300
  }],
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
