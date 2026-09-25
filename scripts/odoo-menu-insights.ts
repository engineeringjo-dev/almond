/**
 * WHAT SELLS WITH WHAT — upsell, cross-sell and modifiers, measured from the
 * shop's own POS orders in Odoo.
 *
 * GM, 2026-09-25: «تفاصيل الابسيلنج والكروس سيلنج ارفقها · Modifier». The
 * public menu feed (packages/shared/src/menu/publicFeed.ts) attaches these to
 * every item, so the website and the app suggest what customers ACTUALLY add,
 * not what someone guessed.
 *
 * READ-ONLY. search_read/read only; credentials from the environment, never
 * written. Output is AGGREGATES ONLY — counts and shares per product. No order
 * reference, customer, cashier, branch or timestamp leaves this script.
 *
 *   ODOO_URL= ODOO_DB= ODOO_LOGIN= ODOO_API_KEY= npx tsx scripts/odoo-menu-insights.ts [--days 45]
 *
 * THREE MEASUREMENTS, each over paid POS orders in the window (refund lines,
 * qty ≤ 0 and the catering till 70 excluded):
 *
 *   1. CHOICES — pos.order.line.attribute_value_ids are the SAME ids the menu
 *      uses for its options (`o-<id>`), so "how often is Oat Milk chosen on an
 *      Iced Latte" is a direct count. Only PAID choices are kept: those are the
 *      upsell. Size shares are kept too (the "go Medium" nudge).
 *
 *   2. MODIFIERS — Odoo also sells add-ons as separate products (POS
 *      categories 32–35, 38, 39: Extra Cold Foam, Extra Shot, 1 Pump Of
 *      Caramel…). Odoo links them to NOTHING (no optional products, no combos —
 *      read 2026-09-25), so the link is measured from the order itself: the
 *      add-on belongs to the NEAREST PRECEDING item OF ITS OWN KIND in the same
 *      order. A drink add-on (Extra Drink/Flavor/Special Milk) attaches to the
 *      last drink rung before it, a food add-on (Extra Food/Pizza/Sweets) to
 *      the last food — so "Latte, Croissant, Extra Shot" puts the shot on the
 *      latte, where plain "previous line" put it on the croissant.
 *
 *   3. CROSS-SELL — items in the same order (market-basket): attach rate
 *      P(B | A) and lift P(B | A) / P(B). Only pairs across DIFFERENT categories
 *      (a latte suggests a croissant, not another latte), with a minimum count
 *      so one busy afternoon cannot make a rule.
 */
import { writeFileSync } from 'node:fs';

const URL_ = need('ODOO_URL'), DB = need('ODOO_DB');
const LOGIN = need('ODOO_LOGIN'), KEY = need('ODOO_API_KEY');
const COMPANIES = [1, 2, 3, 4];

/** Same sets as scripts/odoo-menu-pull.ts. */
const MODIFIER_CATEGORIES = new Set([32, 33, 34, 35, 38, 39]);
/** Which kind of item each add-on category belongs to. */
const DRINK_MODIFIER_CATEGORIES = new Set([34, 35, 39]);   // Extra Drink, Extra Flavor, Extra Special Milk
/** The two roots of Odoo's POS category tree. */
const DRINK_ROOT = 28, FOOD_ROOT = 1;
/** Till 70 is the catering point — event orders are not shop baskets. */
const EXCLUDED_CONFIGS = [70];
/** Modifier-category products that are not add-ons a customer picks:
 *  Service (a 25.000 fee), Custom Cake (the open-price cake line) and Soft Drink
 *  (a drink misfiled under Extra Pizza). */
const NOT_ADD_ONS = new Set(['Service', 'Custom Cake', 'Soft Drink']);
/** Categories never suggested as a cross-sell: 44 Sides (candles, a flowers
 *  cup, gift box) and 36 Specialty Coffee Tools — gifts and gear, not a pairing. */
const NOT_CROSS_SELL = new Set([44, 36]);
/** As in scripts/odoo-menu-pull.ts: these attributes are SIZES, which the menu
 *  folds into `sizes`, so they are reported as size shares by name. */
const SIZE_ATTRIBUTES = ['Drink Size', 'Cake Size', 'Pizza Size & type'];

const DAYS = Number(arg('days', '45'));
const MIN_PAIR = 25;          // orders containing both items
const MIN_LIFT = 1.1;
const MIN_ATTACH = 0.02;      // ≥ 2% of the item's orders
const MIN_SHARE = 0.02;       // choices / modifiers: ≥ 2% of the item's lines
const MIN_EVENTS = 15;        // … and at least this many times
const TOP = 3;

function need(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is required — export it, never commit it`);
  return v;
}
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

let uid = 0;
async function rpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const res = await fetch(`${URL_}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args } }),
  });
  const json = await res.json() as { result?: T; error?: { data?: { message?: string } } };
  if (json.error) throw new Error(json.error.data?.message ?? JSON.stringify(json.error));
  return json.result as T;
}
const call = <T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) =>
  rpc<T>('object', 'execute_kw', [DB, uid, KEY, model, method, args, {
    ...kwargs, context: { allowed_company_ids: COMPANIES, ...(kwargs.context as object ?? {}) },
  }]);

interface LineRow { id: number; order_id: [number, string]; product_id: [number, string]; attribute_value_ids: number[]; qty: number }
interface TmplRow { id: number; name: string; list_price: number; pos_categ_ids: number[]; available_in_pos: boolean; active: boolean }

/**
 * ARABIC NAMES FOR ADD-ON PRODUCTS. Odoo has none for these (read
 * 2026-09-25). A STOPGAP like CATEGORY_AR in scripts/odoo-menu-pull.ts: an Arabic
 * name set in Odoo wins, so entries retire themselves as Odoo is translated.
 */
const MODIFIER_AR: Record<string, string> = {
  'Extra Avocado': 'أفوكادو إضافي', 'Extra Cold Foam': 'كولد فوم إضافي',
  'Extra Decaf Coffee': 'قهوة ديكاف (منزوعة الكافيين)', 'Extra Mushroom': 'فطر إضافي',
  'Extra Nutella': 'نوتيلا إضافية', 'Extra Nuts': 'مكسرات إضافية',
  'Extra Shot': 'شوت إسبريسو إضافي', 'Extra Strawberry': 'فراولة إضافية',
  'Ice Cream': 'آيس كريم', 'Extra Cream': 'كريمة إضافية', 'Extra Bubbles': 'ببلز إضافية',
  'Extra Marshmallow': 'مارشميلو إضافي', 'Extra Honey': 'عسل إضافي', 'Extra Foam': 'رغوة إضافية',
  'Extra Pistachio': 'فستق إضافي', 'Extra Almond Milk': 'حليب لوز', 'Extra Egg': 'بيض إضافي',
  'Extra Cream Cheese': 'كريم تشيز إضافي', 'Extra Chedder Cheese': 'جبنة شيدر إضافية',
  'Extra Halloumi': 'حلوم إضافي', 'Extra Chicken': 'دجاج إضافي', 'Extra Salmon': 'سلمون إضافي',
  'Extra Guacamole': 'جواكامولي إضافي', 'Extra Turkey Roast': 'تيركي إضافي',
  'Extra Roast Beef': 'روست بيف إضافي', 'Extra Tomato': 'بندورة إضافية',
  'Extra Lettuce': 'خس إضافي', 'Extra Olives': 'زيتون إضافي', 'Extra 3 Cheese': 'ثلاث أجبان إضافية',
  'Extra Sundried Tomato': 'بندورة مجففة إضافية', 'Extra ice cream': 'آيس كريم إضافي',
};
const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

async function main() {
  uid = await rpc<number>('common', 'login', [DB, LOGIN, KEY]);
  if (!uid) throw new Error('Odoo authentication failed');
  const to = new Date();
  const from = new Date(to.getTime() - DAYS * 86_400_000);
  const since = from.toISOString().slice(0, 19).replace('T', ' ');

  // ---- lines, paged by id (offset paging is quadratic on 250k rows) -------
  const domain = [
    ['order_id.date_order', '>=', since],
    ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
    ['order_id.config_id', 'not in', EXCLUDED_CONFIGS],
    ['qty', '>', 0],
    ['refunded_orderline_id', '=', false],
  ];
  const lines: LineRow[] = [];
  let lastId = 0;
  for (;;) {
    const batch = await call<LineRow[]>('pos.order.line', 'search_read', [[...domain, ['id', '>', lastId]]],
      { fields: ['order_id', 'product_id', 'attribute_value_ids', 'qty'], order: 'id asc', limit: 5000 });
    if (!batch.length) break;
    lines.push(...batch);
    lastId = batch[batch.length - 1]!.id;
    process.stdout.write(`\r  lines ${lines.length}`);
  }
  console.log();

  // ---- product.product → template ----------------------------------------
  const pids = [...new Set(lines.map((l) => l.product_id[0]))];
  const tmplOf = new Map<number, number>();
  for (let i = 0; i < pids.length; i += 1000) {
    const rows = await call<{ id: number; product_tmpl_id: [number, string] }[]>('product.product', 'read',
      [pids.slice(i, i + 1000)], { fields: ['product_tmpl_id'], context: { active_test: false } });
    for (const r of rows) tmplOf.set(r.id, r.product_tmpl_id[0]);
  }
  const tids = [...new Set(tmplOf.values())];
  const tmpls = new Map<number, TmplRow>();
  for (let i = 0; i < tids.length; i += 1000) {
    const rows = await call<TmplRow[]>('product.template', 'read', [tids.slice(i, i + 1000)],
      { fields: ['name', 'list_price', 'pos_categ_ids', 'available_in_pos', 'active'], context: { active_test: false } });
    for (const r of rows) tmpls.set(r.id, r);
  }
  const isModifier = (t: TmplRow) => t.pos_categ_ids.some((c) => MODIFIER_CATEGORIES.has(c)) && !NOT_ADD_ONS.has(t.name.trim());
  const isItem = (t: TmplRow) => t.available_in_pos && t.active && t.pos_categ_ids.length > 0
    && !t.pos_categ_ids.some((c) => MODIFIER_CATEGORIES.has(c));
  const catOf = (t: TmplRow) => t.pos_categ_ids[0]!;

  // Item kind from the POS category tree (Drink / Food roots).
  const catRows = await call<{ id: number; parent_id: [number, string] | false }[]>('pos.category', 'search_read',
    [[]], { fields: ['parent_id'] });
  const parent = new Map(catRows.map((c) => [c.id, c.parent_id ? c.parent_id[0] : 0]));
  const rootOf = (c: number) => { let x = c, n = 0; while (parent.get(x) && n++ < 10) x = parent.get(x)!; return x; };
  const kindOf = (t: TmplRow): 'drink' | 'food' | 'other' => {
    const r = rootOf(catOf(t));
    return r === DRINK_ROOT ? 'drink' : r === FOOD_ROOT ? 'food' : 'other';
  };
  const modKind = (t: TmplRow) => (t.pos_categ_ids.some((c) => DRINK_MODIFIER_CATEGORIES.has(c)) ? 'drink' : 'food');

  // ---- walk each order in line order ---------------------------------------
  const byOrder = new Map<number, LineRow[]>();
  for (const l of lines) (byOrder.get(l.order_id[0]) ?? byOrder.set(l.order_id[0], []).get(l.order_id[0])!).push(l);

  const itemLines = new Map<number, number>();                 // tmpl → lines sold
  const itemOrders = new Map<number, number>();                // tmpl → orders containing it
  const choiceCount = new Map<number, Map<number, number>>();  // tmpl → attr value → lines
  const modCount = new Map<number, Map<number, number>>();     // tmpl → modifier tmpl → times
  const pairCount = new Map<string, number>();
  let basketOrders = 0;
  let unattached = 0;
  const bump = <K>(m: Map<K, number>, k: K, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

  for (const ls of byOrder.values()) {
    ls.sort((a, b) => a.id - b.id);
    const inOrder = new Set<number>();
    const lastOfKind: Record<'drink' | 'food', number | null> = { drink: null, food: null };
    for (const l of ls) {
      const t = tmpls.get(tmplOf.get(l.product_id[0])!);
      if (!t) continue;
      if (isModifier(t)) {
        const target = lastOfKind[modKind(t)];
        if (target !== null) {
          const m = modCount.get(target) ?? modCount.set(target, new Map()).get(target)!;
          bump(m, t.id);
        } else unattached++;
        continue;
      }
      if (!isItem(t)) continue;
      const k = kindOf(t);
      if (k !== 'other') lastOfKind[k] = t.id;
      bump(itemLines, t.id);
      inOrder.add(t.id);
      const cm = choiceCount.get(t.id) ?? choiceCount.set(t.id, new Map()).get(t.id)!;
      for (const v of l.attribute_value_ids) bump(cm, v);
    }
    if (!inOrder.size) continue;
    basketOrders++;
    const ids = [...inOrder].sort((a, b) => a - b);
    for (const a of ids) bump(itemOrders, a);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) bump(pairCount, `${ids[i]}:${ids[j]}`);
  }

  // ---- attribute value prices (only paid choices are upsell) ---------------
  const valueIds = [...new Set([...choiceCount.values()].flatMap((m) => [...m.keys()]))];
  const valuePrice = new Map<number, number>();
  const sizeName = new Map<number, string>();
  for (let i = 0; i < valueIds.length; i += 2000) {
    const rows = await call<{ id: number; name: string; price_extra: number; attribute_id: [number, string] }[]>(
      'product.template.attribute.value', 'read',
      [valueIds.slice(i, i + 2000)], { fields: ['name', 'price_extra', 'attribute_id'], context: { lang: 'en_US' } });
    for (const r of rows) {
      valuePrice.set(r.id, r.price_extra);
      if (SIZE_ATTRIBUTES.includes(r.attribute_id[1])) sizeName.set(r.id, r.name.trim());
    }
  }

  // ---- assemble -------------------------------------------------------------
  const out: Record<string, {
    lines: number; orders: number;
    sizes: { name: string; share: number }[];
    choices: { optionId: string; share: number }[];
    modifiers: { modifierId: string; share: number }[];
    crossSell: { itemId: string; attach: number; lift: number }[];
  }> = {};
  const usedModifiers = new Set<number>();
  for (const [tid, n] of itemLines) {
    const orders = itemOrders.get(tid) ?? 0;
    const choices = [...(choiceCount.get(tid) ?? new Map<number, number>())]
      .filter(([v, c]) => !sizeName.has(v) && c >= MIN_EVENTS && c / n >= MIN_SHARE)
      .map(([v, c]) => ({ optionId: `o-${v}`, share: round(c / n), price: valuePrice.get(v) ?? 0 }))
      .sort((a, b) => b.share - a.share)
      .map(({ optionId, share, price }) => ({ optionId, share, paid: price > 0 }));
    const modifiers = [...(modCount.get(tid) ?? new Map<number, number>())]
      .filter(([, c]) => c >= MIN_EVENTS && c / n >= MIN_SHARE)
      .sort((a, b) => b[1] - a[1])
      .map(([m, c]) => { usedModifiers.add(m); return { modifierId: `m-${m}`, share: round(c / n) }; });
    const sizeCounts = new Map<string, number>();
    for (const [v, c] of choiceCount.get(tid) ?? new Map<number, number>()) {
      const nm = sizeName.get(v);
      if (nm) bump(sizeCounts, nm, c);
    }
    const sizes = [...sizeCounts].map(([name, c]) => ({ name, share: round(c / n) })).sort((a, b) => b.share - a.share);
    const t = tmpls.get(tid)!;
    const crossSell: { itemId: string; attach: number; lift: number }[] = [];
    for (const [oid, on] of itemOrders) {
      const o = tmpls.get(oid)!;
      if (oid === tid || catOf(o) === catOf(t) || o.pos_categ_ids.some((c) => NOT_CROSS_SELL.has(c))) continue;
      const both = pairCount.get(tid < oid ? `${tid}:${oid}` : `${oid}:${tid}`) ?? 0;
      if (both < MIN_PAIR || !orders) continue;
      const attach = both / orders;
      const lift = attach / (on / basketOrders);
      if (lift >= MIN_LIFT && attach >= MIN_ATTACH) crossSell.push({ itemId: `p-${oid}`, attach: round(attach), lift: round(lift, 2) });
    }
    crossSell.sort((a, b) => b.attach * Math.log(b.lift) - a.attach * Math.log(a.lift));
    out[`p-${tid}`] = {
      lines: n, orders, sizes,
      // A free choice (Fresh Milk, No Flavor) is a default, not an upsell.
      choices: choices.filter((c) => c.paid).slice(0, TOP).map(({ optionId, share }) => ({ optionId, share })),
      modifiers: modifiers.slice(0, TOP),
      crossSell: crossSell.slice(0, TOP),
    };
  }

  // Modifier catalogue — only add-ons the measurement actually linked to an
  // item, so the website never offers an add-on nobody attaches to anything.
  const [en, ar] = await Promise.all(['en_US', 'ar_001'].map((lang) =>
    call<{ id: number; name: string; list_price: number; pos_categ_ids: number[] }[]>('product.template', 'read',
      [[...usedModifiers]], { fields: ['name', 'list_price', 'pos_categ_ids'], context: { lang, active_test: false } })));
  const arById = new Map(ar!.map((r) => [r.id, r.name]));
  const modifiers = en!.map((r) => ({
    id: `m-${r.id}`,
    categoryId: `cat-${r.pos_categ_ids.find((c) => MODIFIER_CATEGORIES.has(c))}`,
    nameEn: r.name.trim(),
    nameAr: ((n) => (hasArabic(n) ? n : (MODIFIER_AR[r.name.trim()] ?? n)))((arById.get(r.id) ?? r.name).trim()),
    // 0.001 is how the shop rings up a FREE pump (so it still prints on the
    // barista ticket); to a customer it is free.
    price: r.list_price <= 0.001 ? 0 : round(r.list_price),
  })).sort((a, b) => a.nameEn.localeCompare(b.nameEn));

  const window = { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), days: DAYS, orders: basketOrders, lines: lines.length };
  const header = `// AUTO-GENERATED — do not edit by hand. Regenerate with:
//   ODOO_URL=… ODOO_DB=… ODOO_LOGIN=… ODOO_API_KEY=… npx tsx scripts/odoo-menu-insights.ts
//
// Aggregates only (counts and shares per product) from paid Odoo POS orders.
// No order, customer, cashier or branch data. See the script header.
`;
  writeFileSync('packages/shared/src/menu/menu.insights.generated.ts', `${header}
export interface ItemInsight {
  lines: number;
  orders: number;
  /** Share of this item's lines sold in each size (by Odoo size name). */
  sizes: { name: string; share: number }[];
  /** Paid choices customers add most, share of this item's lines. */
  choices: { optionId: string; share: number }[];
  /** Separate add-on products rung straight after this item. */
  modifiers: { modifierId: string; share: number }[];
  /** Items from another category in the same order: P(B|A) and lift. */
  crossSell: { itemId: string; attach: number; lift: number }[];
}
export interface ModifierProduct { id: string; categoryId: string; nameEn: string; nameAr: string; price: number }

export const insightsWindow = ${JSON.stringify(window)} as const;

export const modifierProducts: ModifierProduct[] = ${JSON.stringify(modifiers, null, 2)};

export const itemInsights: Record<string, ItemInsight> = ${JSON.stringify(out, null, 1)};
`);
  const withX = Object.values(out).filter((o) => o.crossSell.length).length;
  const withC = Object.values(out).filter((o) => o.choices.length).length;
  const withM = Object.values(out).filter((o) => o.modifiers.length).length;
  console.log(`window ${window.from}..${window.to}: ${basketOrders} orders, ${lines.length} lines`);
  console.log(`add-on lines with no item of their kind before them (not attached): ${unattached}`);
  console.log(`items ${Object.keys(out).length}: cross-sell ${withX}, paid choices ${withC}, modifiers ${withM}; modifier catalogue ${modifiers.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
