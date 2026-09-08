/**
 * THE SHOP'S MENU, PULLED FROM ODOO — data and photographs, in one pass.
 *
 * Owner, 2026-09-08: «نفس المنيو المحل على أودو بدي اياها تنتقل للموقع والتطبيق
 * مع صورها».
 *
 * WHAT THIS REPLACES. `packages/shared/src/menu/menu.generated.ts` was
 * generated from a TALABAT export: 267 items against Odoo's 448, only 128 of
 * them matching by name, 265 real shop items missing (Mini Bites, Maamoul,
 * gluten-free desserts, half the sandwiches), and every one of its 267 photos
 * HOTLINKED from `images.deliveryhero.io` — a CDN we do not own, serving our
 * menu at their discretion.
 *
 * WHY THE IMAGES ARE COMMITTED AND NOT PROXIED. Serving them from Odoo would
 * put storefront traffic on the production accounting system of four companies
 * — already documented slow — and would require making products publicly
 * readable there. Static files behave identically on the app's GitHub Pages
 * export and the website's Vercel build: no CORS, no bucket, no runtime
 * dependency. ~8-12 MB of WebP, rewritten whenever this script is re-run.
 *
 * READ-ONLY. Every call is a `search_read`/`read`. Nothing here writes to Odoo,
 * so it needs no APPROVE PROD; credentials come from the environment and are
 * never written to the repo.
 *
 *   ODOO_URL= ODOO_DB= ODOO_LOGIN= ODOO_API_KEY= npx tsx scripts/odoo-menu-pull.ts
 *
 * HOW ODOO MODELS THE MENU, AND HOW IT MAPS:
 *
 *   pos.category (46, a Food/Drink/Roasted Coffee tree)  ->  Category[]
 *   product.template where available_in_pos              ->  MenuItem[]
 *   SIZE attributes  (Drink Size, Cake Size, Pizza Size) ->  ItemSize[]
 *   other attributes (Milk Type, Without, Bagel Type, …) ->  CustomizationGroup[]
 *   product.template.attribute.value.price_extra         ->  price / priceDelta
 *
 * The size attributes are listed explicitly rather than guessed: an attribute
 * that is not a known size becomes a customization group, so a NEW attribute in
 * Odoo degrades to an optional group instead of silently becoming a price.
 */
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Category, MenuItem, ItemSize, CustomizationGroup } from '../packages/shared/src/types';

const URL_ = need('ODOO_URL'), DB = need('ODOO_DB');
const LOGIN = need('ODOO_LOGIN'), KEY = need('ODOO_API_KEY');
const COMPANIES = [1, 2, 3, 4];               // mandatory context, per the access pack

/** Attributes that mean "this is a different size of the same product", not an
 *  add-on. Anything else becomes a customization group. */
const SIZE_ATTRIBUTES = ['Drink Size', 'Cake Size', 'Pizza Size & type'];

/** POS categories that hold MODIFIERS, not menu items: "1 Pump Of Caramel" is
 *  not a thing anyone orders on its own. 55 products live here. */
const MODIFIER_CATEGORIES = new Set([32, 33, 34, 35, 38, 39]);

/** POS categories that are not the MENU at all. Verified by reading their
 *  contents, not by their names:
 *    37 "Closed"   — eleven staff drinks priced 0.000 (اميريكانو ساخن, شاي ساخن…)
 *    46 "Services" — Delivery 0.500, Delivery Careem, Gift Card, Top delivery
 *  Both would otherwise appear as menu sections a customer could order from,
 *  and the "Closed" rows are most of the zero-priced items in the first pull. */
const NON_MENU_CATEGORIES = new Map([
  [37, 'Closed — staff drinks at 0.000'],
  [46, 'Services — delivery fees and gift cards'],
]);

/**
 * ARABIC CATEGORY NAMES. Only 4 of Odoo's 46 pos.category records carry an
 * Arabic translation, so an Arabic reader would meet «Cake Pieces & Sweets» as
 * a section heading on an otherwise Arabic menu.
 *
 * 🔴 THIS MAP IS A STOPGAP AND THE DURABLE FIX IS IN ODOO. Translating
 * pos.category there makes the POS, the receipts, the website and the app agree
 * from one source; this file only papers over the gap for the two surfaces it
 * generates. A category translated in Odoo wins automatically — the map is
 * consulted ONLY when Odoo has no Arabic name, so entries here retire
 * themselves as they are filled in upstream.
 */
const CATEGORY_AR: Record<string, string> = {
  'Bars': 'ألواح',
  'Sourdough': 'ساوردو',
  'Sandwiches': 'ساندويشات',
  'Salads': 'سلطات',
  'Granola Cups': 'كاسات جرانولا',
  'Cake Pieces & Sweets': 'قطع كيك وحلويات',
  'Cookies & Muffins': 'كوكيز ومافن',
  'Gluten-free Desserts': 'حلويات خالية من الجلوتين',
  'Sweet Packs': 'علب حلويات',
  'Full Cakes': 'كيكات كاملة',
  'Manaqeesh': 'مناقيش',
  'Pasta': 'باستا',
  'Pizza': 'بيتزا',
  'Mini Bites': 'ميني بايتس',
  'Coffee Frappe': 'فرابيه قهوة',
  'Creme Frappe': 'فرابيه كريمة',
  'Hot Chocolate': 'شوكولاتة ساخنة',
  'Hot Specialty Coffee': 'قهوة مختصة ساخنة',
  'Seasonal Drinks': 'مشروبات موسمية',
  'Iced Specialty Coffee': 'قهوة مختصة مثلجة',
  'Iced Tea And Fresh Juices': 'شاي مثلج وعصائر طازجة',
  'Mojito': 'موهيتو',
  'Tea': 'شاي',
  'Coffee Bags': 'أكياس قهوة',
  'Specialty Coffee Tools': 'أدوات القهوة المختصة',
  'Gluten-free Full Cake': 'كيك كامل خالٍ من الجلوتين',
  'Bento Cake': 'بينتو كيك',
  'Maamoul': 'معمول',
  'Croissants': 'كرواسون',
  'Bagel': 'بايغل',
  'Keto Bread': 'خبز كيتو',
  'Chicken Meals And Sandwiches': 'وجبات وساندويشات دجاج',
  'Food': 'طعام',
  'Drink': 'مشروبات',
  'Roasted Coffee': 'قهوة محمّصة',
  'Mini Bites ': 'ميني بايتس',
};

const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

/**
 * BOTH surfaces need the files in their own public folder: Next serves
 * `almond-web/public`, and `expo export` copies `almond-app/public` into the
 * web bundle. The duplication is machine-written and reproducible — one place
 * to regenerate, no hand-maintained copy to drift.
 */
const IMG_DIRS = [
  join('almond-web', 'public', 'menu'),
  join('almond-app', 'public', 'menu'),
];
const IMG_WIDTH = 512, IMG_QUALITY = 80;

function need(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is required — export it, never commit it`);
  return v;
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
    ...kwargs,
    context: { allowed_company_ids: COMPANIES, ...(kwargs.context as object ?? {}) },
  }]);

/** The same records in both languages. Odoo translates per-context, so the only
 *  way to get an Arabic name and an English one is to ask twice. */
async function bilingual<T extends { id: number }>(
  model: string, domain: unknown[], fields: string[],
): Promise<Map<number, { en: T; ar: T }>> {
  const [en, ar] = await Promise.all([
    call<T[]>(model, 'search_read', [domain], { fields, context: { lang: 'en_US' } }),
    call<T[]>(model, 'search_read', [domain], { fields, context: { lang: 'ar_001' } }),
  ]);
  const arById = new Map(ar.map((r) => [r.id, r]));
  return new Map(en.map((r) => [r.id, { en: r, ar: arById.get(r.id) ?? r }]));
}

interface TmplRow { id: number; name: string; list_price: number; description_sale: string | false; pos_categ_ids: number[]; }
interface CatRow { id: number; name: string; parent_id: [number, string] | false; sequence: number; }
interface AttrValRow { id: number; name: string; price_extra: number; attribute_id: [number, string]; product_tmpl_id: [number, string]; }
interface AttrLineRow { id: number; product_tmpl_id: [number, string]; attribute_id: [number, string]; value_ids: number[]; }

async function main() {
  uid = await rpc<number>('common', 'login', [DB, LOGIN, KEY]);
  if (!uid) throw new Error('Odoo authentication failed');
  console.log(`odoo uid=${uid}`);

  const domain = [['available_in_pos', '=', true], ['active', '=', true]];
  const cats = await bilingual<CatRow>('pos.category', [], ['id', 'name', 'parent_id', 'sequence']);
  const tmpls = await bilingual<TmplRow>('product.template', domain,
    ['id', 'name', 'list_price', 'description_sale', 'pos_categ_ids']);
  console.log(`categories=${cats.size} products=${tmpls.size}`);

  const ids = [...tmpls.keys()];
  const attrLines = await call<AttrLineRow[]>('product.template.attribute.line', 'search_read',
    [[['product_tmpl_id', 'in', ids]]], { fields: ['id', 'product_tmpl_id', 'attribute_id', 'value_ids'] });
  const attrVals = await bilingual<AttrValRow>('product.template.attribute.value',
    [['product_tmpl_id', 'in', ids]], ['id', 'name', 'price_extra', 'attribute_id', 'product_tmpl_id']);
  const attrLineNames = await bilingual<{ id: number; name: string }>(
    'product.attribute', [], ['id', 'name']);

  const withImage = new Set(await call<number[]>('product.template', 'search',
    [[...domain, ['image_1920', '!=', false]]]));
  console.log(`with photo=${withImage.size}`);

  const untranslated: string[] = [];

  /**
   * 🔴 `MenuItem.isDrink` IS DELIBERATELY NOT EMITTED, AND IT WAS TRIED FIRST.
   *
   * The Talabat export set the flag on 83 items of which only 69 were drinks —
   * retail bean bags, a V60 dripper, V60 PAPER FILTERS, granola cups (see
   * lib/combo.ts) — which is why production stopped trusting it and classifies
   * with `itemKind` instead.
   *
   * Odoo's category tree looked like the fix: Coffee Bags and Specialty Coffee
   * Tools hang off "Roasted Coffee", not "Drink". Measured, it is not. Odoo
   * files the "Sides" category under Drink, and Sides holds Candles 1-4, a
   * Flowers Cup and a Gift Box alongside the bottled water — so the tree flags
   * four candles and a bouquet as drinks. That is the same defect in a new
   * costume.
   *
   * So the field stays absent. `itemKind` classifies by category NAME and gets
   * Sides right, and one classifier is what lib/combo.ts already argues for.
   * The only reader left is `computeTotals`' brunch pairing, whose discount
   * (BRUNCH_COMBO_DISCOUNT) has been 0 since the offer was retired and whose
   * `isBrunch` counterpart was already absent from the previous menu; if brunch
   * ever returns, that function should move to `itemKind` rather than this flag
   * being revived.
   */

  // ---- categories -------------------------------------------------------
  const outCats: Category[] = [];
  for (const [id, { en, ar }] of cats) {
    if (NON_MENU_CATEGORIES.has(id)) continue;
    // Odoo's translation wins whenever it exists; the map is the fallback.
    const nameAr = hasArabic(ar.name) ? ar.name : (CATEGORY_AR[en.name] ?? en.name);
    if (!hasArabic(nameAr)) untranslated.push(en.name);
    outCats.push({ id: `cat-${id}`, nameEn: en.name, nameAr });
  }
  outCats.sort((a, b) => (cats.get(+a.id.slice(4))!.en.sequence) - (cats.get(+b.id.slice(4))!.en.sequence));

  // ---- items ------------------------------------------------------------
  const valsByTmpl = new Map<number, { en: AttrValRow; ar: AttrValRow }[]>();
  for (const v of attrVals.values()) {
    const t = v.en.product_tmpl_id[0];
    (valsByTmpl.get(t) ?? valsByTmpl.set(t, []).get(t)!).push(v);
  }

  const outItems: MenuItem[] = [];
  let skippedModifier = 0, skippedNonMenu = 0;
  const uncategorised: string[] = [];
  const unpriced: string[] = [];
  for (const [id, { en, ar }] of tmpls) {
    const catIds = en.pos_categ_ids ?? [];
    if (catIds.some((c) => MODIFIER_CATEGORIES.has(c))) { skippedModifier++; continue; }
    if (catIds.some((c) => NON_MENU_CATEGORIES.has(c))) { skippedNonMenu++; continue; }
    // No POS category means no section to show it in. Four products are in this
    // state; they are reported rather than filed under a category that does not
    // exist, which is what `cat-0` would have been.
    if (!catIds.length) { uncategorised.push(en.name); continue; }

    const lines = attrLines.filter((l) => l.product_tmpl_id[0] === id);
    const mine = valsByTmpl.get(id) ?? [];
    const sizes: ItemSize[] = [];
    const groups: CustomizationGroup[] = [];

    for (const line of lines) {
      const attrEn = line.attribute_id[1];
      const attrAr = attrLineNames.get(line.attribute_id[0])?.ar.name ?? attrEn;
      const values = mine.filter((v) => v.en.attribute_id[0] === line.attribute_id[0]);
      if (!values.length) continue;

      if (SIZE_ATTRIBUTES.includes(attrEn)) {
        // A size REPLACES the price rather than adding to it in the app's model,
        // so the extra is folded into the absolute price here.
        values.forEach((v, i) => sizes.push({
          id: (['S', 'M', 'L'] as const)[Math.min(i, 2)],
          nameEn: v.en.name, nameAr: v.ar.name,
          price: round3(en.list_price + v.en.price_extra),
        }));
      } else {
        groups.push({
          id: `g-${line.id}`, nameEn: attrEn, nameAr: attrAr,
          // Odoo does not mark an attribute as single- or multi-choice, and the
          // app treats single-choice as MANDATORY (it pre-selects one). Calling
          // everything multi-choice is the safe direction: an optional extra
          // that should have been required under-quotes nobody, while a
          // required group applied wrongly would add money to every card.
          multiple: true,
          options: values.map((v) => ({
            id: `o-${v.en.id}`, nameEn: v.en.name, nameAr: v.ar.name,
            priceDelta: round3(v.en.price_extra),
          })),
        });
      }
    }

    if (!sizes.length) {
      sizes.push({ id: 'M', nameEn: 'Regular', nameAr: 'عادي', price: round3(en.list_price) });
    }

    // 🔴 AN ITEM WITH NO REACHABLE PRICE IS NOT A MENU ITEM. If the cheapest
    // complete configuration is 0.000, the card would advertise «من ٠٫٠٠٠ د.أ»
    // and the cart would accept it for nothing. "Custom Cake (Open Price)" is
    // the honest case — its price is agreed in person — and it still cannot be
    // sold through a storefront that has no way to ask.
    const floor = Math.min(...sizes.map((z) => z.price))
      + groups.filter((g) => !g.multiple && g.options.length)
        .reduce((sum, g) => sum + Math.min(...g.options.map((o) => o.priceDelta)), 0);
    if (floor <= 0) { unpriced.push(en.name); continue; }

    outItems.push({
      id: `p-${id}`,
      categoryId: `cat-${catIds[0] ?? 0}`,
      nameEn: en.name, nameAr: ar.name,
      ...(en.description_sale ? { descEn: en.description_sale } : {}),
      ...(ar.description_sale ? { descAr: ar.description_sale } : {}),
      emoji: '',
      ...(withImage.has(id) ? { imageUrl: `/menu/p-${id}.webp` } : {}),
      sizes, customizations: groups,
    });
  }
  outItems.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  console.log(`items=${outItems.length}`);
  console.log(`  skipped ${skippedModifier} modifier products, ${skippedNonMenu} non-menu`);
  if (unpriced.length) console.log(`  skipped ${unpriced.length} with no reachable price: ${unpriced.join(', ')}`);
  if (uncategorised.length) console.log(`  skipped ${uncategorised.length} with no POS category: ${uncategorised.join(', ')}`);
  if (untranslated.length) console.log(`  ⚠ categories still without an Arabic name: ${untranslated.join(', ')}`);
  const noArabic = outItems.filter((i) => !hasArabic(i.nameAr)).length;
  if (noArabic) console.log(`  ⚠ ${noArabic}/${outItems.length} items have no Arabic name in Odoo (English shown)`);

  // ---- photographs ------------------------------------------------------
  for (const dir of IMG_DIRS) {
    if (existsSync(dir)) rmSync(dir, { recursive: true });
    mkdirSync(dir, { recursive: true });
  }
  let bytes = 0, done = 0;
  // Only the items that SURVIVED the guards above — otherwise the folder keeps
  // photos of staff drinks and delivery fees that nothing references.
  const shipped = new Set(outItems.map((i) => +i.id.slice(2)));
  const photoIds = [...withImage].filter((id) => shipped.has(id));
  for (let i = 0; i < photoIds.length; i += 20) {
    const batch = photoIds.slice(i, i + 20);
    const rows = await call<{ id: number; image_1920: string | false }[]>(
      'product.template', 'read', [batch], { fields: ['image_1920'] });
    for (const r of rows) {
      if (!r.image_1920) continue;
      const webp = await sharp(Buffer.from(r.image_1920, 'base64'))
        .resize(IMG_WIDTH, IMG_WIDTH, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: IMG_QUALITY })
        .toBuffer();
      for (const dir of IMG_DIRS) writeFileSync(join(dir, `p-${r.id}.webp`), webp);
      bytes += webp.length; done++;
    }
    process.stdout.write(`\r  photos ${done}/${photoIds.length}`);
  }
  console.log(`\n  ${done} photos, ${(bytes / 1048576).toFixed(1)} MB`);

  // ---- emit -------------------------------------------------------------
  const header = `import type { Category, MenuItem } from '../types';

// AUTO-GENERATED — do not edit by hand. Regenerate with:
//   ODOO_URL=… ODOO_DB=… ODOO_LOGIN=… ODOO_API_KEY=… npx tsx scripts/odoo-menu-pull.ts
//
// Source: Odoo 19 POS (pos.category + product.template where available_in_pos).
// This is THE SHOP'S menu at shop prices — it replaced a Talabat export whose
// photos were hotlinked from images.deliveryhero.io. Photos now live in
// almond-web/public/menu/ and are ours.
//
// Pulled ${new Date().toISOString().slice(0, 10)}: ${outCats.length} categories, ${outItems.length} items, ${done} photos.
`;
  writeFileSync('packages/shared/src/menu/menu.generated.ts',
    `${header}\nexport const generatedCategories: Category[] = ${JSON.stringify(outCats, null, 2)};\n\n`
    + `export const generatedMenuItems: MenuItem[] = ${JSON.stringify(outItems, null, 2)};\n`);
  console.log('wrote packages/shared/src/menu/menu.generated.ts');
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

main().catch((e) => { console.error(e); process.exit(1); });
