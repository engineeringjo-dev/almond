/**
 * THE PUBLIC MENU FEED — the read-only JSON the public website
 * (almondcoffeehouse.com, WordPress) builds its WhatsApp order page from.
 *
 * GM, 2026-09-25: the website menu must use THE SAME data as the loyalty app
 * (items, prices, milk types, images) so there is one source of truth (Odoo).
 * So this is not a second menu: it is a projection of `menu.generated.ts`
 * (pulled from Odoo by scripts/odoo-menu-pull.ts) into a flat, documented,
 * snake_case shape a non-TypeScript client can read.
 *
 * 🔴 WHAT MUST NEVER BE IN HERE. No customer data, no member data, no keys, no
 * cost prices — only what is already printed on the shop's menu board. The
 * feed is built from the menu module ALONE (it imports nothing that could
 * reach a member or a secret), and web test public-menu.test.ts pins the exact
 * set of keys on every object, so a field cannot be added by accident.
 *
 * WHERE THE WEBSITE'S SHAPE AND ODOO'S DISAGREE, and what this does about it:
 *
 *   - OPTION GROUPS are per product in Odoo (each product has its own
 *     attribute line). Here they are folded into a shared catalogue by
 *     attribute name — `milk`, `flavour`, `extra_drink`… — and an item points
 *     at ids. Where two products carry DIFFERENT choices or prices under the
 *     same attribute name, the variant gets its own id (`milk_2`), so no item
 *     is ever shown a choice or a price it does not have.
 *
 *   - SINGLE vs MULTI comes from Odoo itself: `product.attribute.display_type`
 *     (radio → one required choice with a default; checkbox → any number).
 *     Milk Type, Coffee Flavor and Bagel Type are radio in Odoo (read
 *     2026-09-25), so the feed and the POS ask the same question.
 *
 *   - SIZES. The app's cart knows three size ids (S/M/L); nine cakes have five
 *     sizes, which the app collapses. The feed gives every size its own id so
 *     the website is not bound by that limit.
 *
 *   - BRANCH AVAILABILITY is not in the pulled data (the pull reads
 *     `available_in_pos`, not each till's category list). CATEGORY_BRANCH_LIMITS
 *     carries the GM's rule for pizza and pasta until the pull reads
 *     `pos.config` per branch.
 */
import type { Category, MenuItem, CustomizationGroup } from '../types';

export const PUBLIC_MENU_SCHEMA_VERSION = 1 as const;

/** The branches the website lists, with the app's id where the app has one.
 *  Madina Street is not in the app's branch list yet (app_branch_id null). */
export const PUBLIC_BRANCHES = [
  { slug: 'mecca', name_ar: 'شارع مكة', name_en: 'Mecca Street', app_branch_id: 'mecca-st' },
  { slug: 'rabieh', name_ar: 'الرابية', name_en: 'Rabieh', app_branch_id: 'rabyeh' },
  { slug: 'circle8', name_ar: 'الدوار الثامن', name_en: '8th Circle', app_branch_id: '8th-circle' },
  { slug: 'khalda', name_ar: 'خلدا', name_en: 'Khalda', app_branch_id: 'khalda' },
  { slug: 'citymall', name_ar: 'سيتي مول', name_en: 'City Mall', app_branch_id: 'city-mall' },
  { slug: 'ju', name_ar: 'الجامعة الأردنية', name_en: 'University of Jordan', app_branch_id: 'ju' },
  { slug: 'shafa', name_ar: 'شفا بدران', name_en: 'Shafa Badran', app_branch_id: 'shafa-badran' },
  { slug: 'madina', name_ar: 'شارع المدينة المنورة', name_en: 'Madina Street', app_branch_id: null },
] as const;

export type PublicBranchSlug = (typeof PUBLIC_BRANCHES)[number]['slug'];

/**
 * Categories sold only at some branches. GM, 2026-09-25: pizza and pasta only
 * at Rabieh, 8th Circle, JU, Madina and Shafa Badran. Keyed by the Odoo
 * category's English name. Everything not listed is sold at every branch.
 */
export const CATEGORY_BRANCH_LIMITS: Readonly<Record<string, readonly PublicBranchSlug[]>> = {
  Pizza: ['rabieh', 'circle8', 'ju', 'madina', 'shafa'],
  Pasta: ['rabieh', 'circle8', 'ju', 'madina', 'shafa'],
};

/** Stable, readable ids for the attributes the website will style specially. */
const GROUP_SLUGS: Record<string, string> = {
  'Milk Type': 'milk',
  'Coffee Flavor': 'flavour',
  'Extra Drink': 'extra_drink',
  'Extra For Frappe': 'extra_frappe',
  'Extra Food': 'extra_food',
  'Without': 'without',
  'Extra Sweet': 'extra_sweet',
  'Extras:': 'extras',
  'Add Bubbles': 'bubbles',
  'Bagel Type': 'bagel_type',
  'Remove:': 'remove',
  'Customize Cake': 'cake_custom',
  'Choose Grind Size:': 'grind',
  'Dough Type': 'dough',
  'Mocha Flavor': 'mocha_flavour',
  'Frozen Type': 'frozen_type',
  'Tea Types': 'tea_type',
  'Matcha Flavor': 'matcha_flavour',
  'Juice Type': 'juice_type',
  'Bread Type': 'bread_type',
  'Extra Almond Latte': 'almond_latte_topping',
  'Hot Chocolate Flavor': 'hot_chocolate_flavour',
  'Type': 'drink_type',
};

export type PublicTag = 'gluten_free' | 'keto' | 'sugar_free' | 'vegan' | 'seasonal';

export interface PublicChoice { id: string; name_ar: string; name_en: string; price_delta: number }
export interface PublicOptionGroup {
  id: string; name_ar: string; name_en: string;
  required: boolean; multi: boolean; default_choice_id: string | null;
  choices: PublicChoice[];
}
export interface PublicSize { id: string; name_ar: string; name_en: string; price: number }
export interface PublicItem {
  id: string; odoo_template_id: number;
  name_ar: string; name_en: string; desc_ar: string; desc_en: string;
  category_id: string; price: number; sizes: PublicSize[];
  option_group_ids: string[]; tags: PublicTag[]; branches: PublicBranchSlug[];
  image_url: string | null; available: boolean; sort: number;
  upsell: PublicUpsell;
  cross_sell: { item_id: string; attach_rate: number; lift: number }[];
}
/** What to offer ON this item — measured from Odoo POS orders. */
export interface PublicUpsell {
  /** Next size up from the cheapest, with the share of lines sold in it. */
  size_upgrade: { from_size_id: string; to_size_id: string; extra_price: number; share: number } | null;
  /** Paid choices customers add most (share of this item's lines). */
  popular_choices: { group_id: string; choice_id: string; share: number }[];
  /** Add-on products (top-level `modifiers`) rung with this item. */
  modifiers: { modifier_id: string; share: number }[];
}
export interface PublicModifier { id: string; category: string; name_ar: string; name_en: string; price: number }
export interface PublicCategory { id: string; name_ar: string; name_en: string; sort: number }
export interface PublicMenuFeed {
  schema_version: typeof PUBLIC_MENU_SCHEMA_VERSION;
  updated_at: string;
  currency: 'JOD';
  prices_include_tax: boolean;
  tax_rate: number;
  image_max_px: number;
  branches: { slug: PublicBranchSlug; name_ar: string; name_en: string; app_branch_id: string | null }[];
  categories: PublicCategory[];
  option_groups: PublicOptionGroup[];
  items: PublicItem[];
  /** Add-on products Odoo sells as separate lines (Extra Cold Foam, Ice Cream…). */
  modifiers: PublicModifier[];
  /** The POS orders the upsell/cross-sell numbers were measured on. */
  insights_window: { from: string; to: string; days: number; orders: number } | null;
  offers: never[];
}

/** The measured insights (scripts/odoo-menu-insights.ts → menu.insights.generated.ts),
 *  typed structurally so this module still imports nothing but types. */
export interface FeedInsights {
  window: { from: string; to: string; days: number; orders: number };
  modifiers: { id: string; categoryId: string; nameEn: string; nameAr: string; price: number }[];
  items: Record<string, {
    sizes: { name: string; share: number }[];
    choices: { optionId: string; share: number }[];
    modifiers: { modifierId: string; share: number }[];
    crossSell: { itemId: string; attach: number; lift: number }[];
  }>;
}

export interface PublicFeedInput {
  categories: Category[];
  items: MenuItem[];
  /** When the menu was last pulled from Odoo (ISO date). */
  updatedAt: string;
  /** Absolute origin the photos are served from, e.g. https://almond-gules.vercel.app.
   *  Empty string keeps them relative (`/menu/p-1.webp`) — for a self-hosted copy. */
  assetBase: string;
  taxRate: number;
  pricesIncludeTax: boolean;
  /** Optional: without it every item carries an empty upsell/cross_sell. */
  insights?: FeedInsights;
}

/** Odoo's modifier-category names, for the `category` field. */
const MODIFIER_CATEGORY_SLUGS: Record<string, string> = {
  'cat-32': 'extra_food', 'cat-33': 'extra_pizza', 'cat-34': 'extra_drink',
  'cat-35': 'extra_flavour', 'cat-38': 'extra_sweets', 'cat-39': 'extra_milk',
};


/** Photo width the pull writes (scripts/odoo-menu-pull.ts IMG_WIDTH). */
const IMAGE_MAX_PX = 512;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function slugify(s: string): string {
  const out = s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return out || 'x';
}

/** Makes `base` unique within `taken` by suffixing _2, _3… */
function unique(base: string, taken: Set<string>): string {
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  taken.add(id);
  return id;
}

export function tagsFor(item: MenuItem, categoryEn: string): PublicTag[] {
  const en = item.nameEn, ar = item.nameAr;
  const tags: PublicTag[] = [];
  if (/gluten/i.test(categoryEn) || /gluten|\bgf\b/i.test(en) || /جلوتين|غلوتين/.test(ar)) tags.push('gluten_free');
  if (/keto/i.test(en) || /كيتو/.test(ar)) tags.push('keto');
  if (/sugar[\s-]?free/i.test(en) || /خالي[ةه]? من السكر/.test(ar)) tags.push('sugar_free');
  if (/vegan/i.test(en) || /نباتي/.test(ar)) tags.push('vegan');
  if (/season/i.test(categoryEn) || /pumpkin|gingerbread|\bfall\b|autumn/i.test(en) || /بامكن|بمكن|يقطين|القرع|خريف/.test(ar)) tags.push('seasonal');
  return tags;
}

function choicesOf(g: CustomizationGroup): PublicChoice[] {
  const taken = new Set<string>();
  const seen = new Set<string>();
  const out: PublicChoice[] = [];
  for (const o of g.options) {
    // One product carries its Milk Type line twice in Odoo; a customer must
    // not be shown "Fresh Milk" twice.
    const key = `${o.nameEn.trim().toLowerCase()}|${o.priceDelta}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: unique(slugify(o.nameEn), taken),
      name_ar: o.nameAr.trim(), name_en: o.nameEn.trim(),
      price_delta: round3(o.priceDelta),
    });
  }
  return out;
}

const signature = (name: string, choices: PublicChoice[]) =>
  `${name}::${choices.map((c) => `${c.name_en}:${c.price_delta}`).join('|')}`;

const groupSignature = (g: CustomizationGroup, choices: PublicChoice[]) =>
  `${g.multiple ? 'multi' : 'one'}::${signature(g.nameEn.trim(), choices)}`;

export function buildPublicMenuFeed(input: PublicFeedInput): PublicMenuFeed {
  const catById = new Map(input.categories.map((c) => [c.id, c]));
  const allSlugs = PUBLIC_BRANCHES.map((b) => b.slug);

  // ---- option groups: fold per-product lines into a shared catalogue -------
  // Count each distinct (attribute, choice set) so the most common variant
  // gets the plain id and rarer ones get _2, _3… — deterministically.
  const variants = new Map<string, { g: CustomizationGroup; choices: PublicChoice[]; n: number }>();
  for (const item of input.items) {
    for (const g of item.customizations) {
      const choices = choicesOf(g);
      if (!choices.length) continue;
      const sig = groupSignature(g, choices);
      const v = variants.get(sig);
      if (v) v.n++; else variants.set(sig, { g, choices, n: 1 });
    }
  }
  const ordered = [...variants.entries()].sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1));
  const groupIdBySig = new Map<string, string>();
  const takenGroupIds = new Set<string>();
  const optionGroups: PublicOptionGroup[] = [];
  for (const [sig, { g, choices }] of ordered) {
    const name = g.nameEn.trim();
    const id = unique(GROUP_SLUGS[name] ?? slugify(name), takenGroupIds);
    groupIdBySig.set(sig, id);
    const single = !g.multiple;
    const def = single ? (choices.find((c) => c.price_delta === 0) ?? choices[0]) : undefined;
    optionGroups.push({
      id, name_ar: g.nameAr.trim(), name_en: name,
      required: single, multi: !single, default_choice_id: def ? def.id : null,
      choices,
    });
  }
  const groupById = new Map(optionGroups.map((g) => [g.id, g]));
  optionGroups.sort((a, b) => (a.id < b.id ? -1 : 1));

  // ---- categories: only sections that hold something -------------------
  const used = new Set(input.items.map((i) => i.categoryId));
  const categories: PublicCategory[] = input.categories
    .filter((c) => used.has(c.id))
    .map((c, sort) => ({ id: c.id, name_ar: c.nameAr.trim(), name_en: c.nameEn.trim(), sort }));
  const catSort = new Map(categories.map((c) => [c.id, c.sort]));

  // ---- add-on products ----------------------------------------------------
  const modifiers: PublicModifier[] = (input.insights?.modifiers ?? []).map((m) => ({
    id: m.id,
    category: MODIFIER_CATEGORY_SLUGS[m.categoryId] ?? 'extra',
    name_ar: m.nameAr,
    name_en: m.nameEn,
    price: round3(m.price),
  }));
  const modifierIds = new Set(modifiers.map((m) => m.id));

  // ---- items -------------------------------------------------------------
  const items: PublicItem[] = input.items
    .filter((i) => catSort.has(i.categoryId))
    .map((item) => {
      const catEn = (catById.get(item.categoryId)?.nameEn ?? '').trim();
      const sizeIds = new Set<string>();
      const sizes: PublicSize[] = item.sizes.map((z) => ({
        id: unique(slugify(z.nameEn), sizeIds),
        name_ar: z.nameAr.trim(), name_en: z.nameEn.trim(), price: round3(z.price),
      }));
      // app option id (o-<odoo value id>) → the feed's (group, choice)
      const optionRef = new Map<string, { group_id: string; choice_id: string }>();
      const groupIds = [...new Set(item.customizations
        .map((g) => {
          const choices = choicesOf(g);
          const gid = choices.length ? groupIdBySig.get(groupSignature(g, choices)) : undefined;
          if (gid) {
            for (const o of g.options) {
              const c = choices.find((x) => x.name_en === o.nameEn.trim() && x.price_delta === round3(o.priceDelta));
              if (c) optionRef.set(o.id, { group_id: gid, choice_id: c.id });
            }
          }
          return gid;
        })
        .filter((id): id is string => !!id))];
      // The "from" price: cheapest size + the cheapest choice of every
      // required group — the least a customer can actually be charged.
      const floor = Math.min(...sizes.map((z) => z.price)) + groupIds
        .map((id) => groupById.get(id)!)
        .filter((g) => g.required)
        .reduce((s, g) => s + Math.min(...g.choices.map((c) => c.price_delta)), 0);
      const ins = input.insights?.items[item.id];
      const bySize = [...sizes].sort((a, b) => a.price - b.price);
      const next = bySize.find((z) => z.price > bySize[0]!.price);
      const upsell: PublicUpsell = {
        size_upgrade: next ? {
          from_size_id: bySize[0]!.id, to_size_id: next.id,
          extra_price: round3(next.price - bySize[0]!.price),
          share: ins?.sizes.find((z) => z.name === next.name_en)?.share ?? 0,
        } : null,
        popular_choices: (ins?.choices ?? [])
          .map((c) => ({ ref: optionRef.get(c.optionId), share: c.share }))
          .filter((c): c is { ref: { group_id: string; choice_id: string }; share: number } => !!c.ref)
          .map((c) => ({ ...c.ref, share: c.share })),
        modifiers: (ins?.modifiers ?? [])
          .filter((m) => modifierIds.has(m.modifierId))
          .map((m) => ({ modifier_id: m.modifierId, share: m.share })),
      };
      return {
        upsell,
        cross_sell: (ins?.crossSell ?? []).map((c) => ({ item_id: c.itemId, attach_rate: c.attach, lift: c.lift })),
        id: item.id,
        odoo_template_id: Number(item.id.replace(/^p-/, '')),
        name_ar: item.nameAr.replace(/\s+/g, ' ').trim(),
        name_en: item.nameEn.replace(/\s+/g, ' ').trim(),
        desc_ar: (item.descAr ?? '').trim(),
        desc_en: (item.descEn ?? '').trim(),
        category_id: item.categoryId,
        price: round3(floor),
        sizes,
        option_group_ids: groupIds,
        tags: tagsFor(item, catEn),
        branches: [...(CATEGORY_BRANCH_LIMITS[catEn] ?? allSlugs)],
        image_url: item.imageUrl ? `${input.assetBase}${item.imageUrl}` : null,
        available: item.inStock !== false,
        sort: 0,
      };
    })
    .sort((a, b) => catSort.get(a.category_id)! - catSort.get(b.category_id)! || a.name_en.localeCompare(b.name_en));
  items.forEach((it, i) => { it.sort = i; });
  // A cross-sell may only point at something the customer can order here.
  const shipped = new Set(items.map((i) => i.id));
  for (const it of items) it.cross_sell = it.cross_sell.filter((c) => shipped.has(c.item_id));

  return {
    schema_version: PUBLIC_MENU_SCHEMA_VERSION,
    updated_at: input.updatedAt,
    currency: 'JOD',
    prices_include_tax: input.pricesIncludeTax,
    tax_rate: input.taxRate,
    image_max_px: IMAGE_MAX_PX,
    branches: PUBLIC_BRANCHES.map((b) => ({ ...b })),
    categories,
    option_groups: optionGroups,
    items,
    modifiers,
    insights_window: input.insights ? {
      from: input.insights.window.from, to: input.insights.window.to,
      days: input.insights.window.days, orders: input.insights.window.orders,
    } : null,
    offers: [],
  };
}
