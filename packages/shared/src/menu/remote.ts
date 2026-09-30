/**
 * THE MENU AS DATA, NOT CODE — how the app gets a new menu without a store release.
 *
 * GM, 2026-09-30: «ليش ما يعمل update للمنيو مثل كريم وطلبات مع كل push ما لم
 * يكن هناك تحديث جوهري يستوجب تحديث التطبيق». Careem and Talabat load the menu
 * from the server every time; the app binary changes only when the app itself
 * must. Same here:
 *
 *   server  GET /api/menu/app  →  buildAppMenuPayload(…)   (redeploys on every push)
 *   app     on launch / return to foreground  →  parseAppMenuPayload(…)  →  menu store
 *
 * THE "SUBSTANTIAL UPDATE" RULE IS `APP_MENU_SCHEMA`. It is compiled into each
 * app build. A new item, a price, a photo, an add-on — the SAME shape — keep the
 * schema, and every installed app picks them up. Changing the SHAPE of a menu
 * item (a field the screens must understand) bumps the schema; an older app then
 * refuses that payload, keeps the menu it already has, and the new shape waits
 * for the store update. An app never renders a menu it cannot read.
 *
 * 🔴 A PAYLOAD IS ALL OR NOTHING. One malformed item, one size priced 0, one
 * negative add-on, and the whole payload is refused — the app keeps its cached
 * or bundled menu. A half-applied menu is how a customer meets an item with no
 * price. (The server re-prices every order from its own menu anyway; this guard
 * is about what the customer is SHOWN.)
 */
import type { Category, MenuItem } from '../types';
import { sha256Hex } from '../lib/sha256';

/** Bump ONLY when the MenuItem/Category shape changes in a way an older app
 *  cannot render. Prices, items, photos and add-ons never need a bump. */
export const APP_MENU_SCHEMA = 1;

export interface AppMenu { categories: Category[]; items: MenuItem[] }
export interface AppMenuPayload extends AppMenu {
  schema: number;
  /** Content hash — the app skips work when it already holds this version. */
  version: string;
  /** Date of the Odoo pull the menu came from. */
  updatedAt: string;
}

const MAX_ITEMS = 2000;
const SIZE_IDS = new Set(['S', 'M', 'L']);

/** Server side. Photos become absolute so an item added after the app was
 *  built still shows its picture (it is not in the app's bundled assets). */
export function buildAppMenuPayload(input: {
  categories: Category[]; items: MenuItem[]; updatedAt: string; assetBase: string;
}): AppMenuPayload {
  const base = input.assetBase.replace(/\/+$/, '');
  const items = input.items.map((i) => (
    i.imageUrl && !/^https?:\/\//.test(i.imageUrl) ? { ...i, imageUrl: `${base}${i.imageUrl}` } : i
  ));
  const body = { categories: input.categories, items };
  return {
    schema: APP_MENU_SCHEMA,
    version: sha256Hex(JSON.stringify(body)).slice(0, 16),
    updatedAt: input.updatedAt,
    ...body,
  };
}

export type ParsedAppMenu =
  | { ok: true; payload: AppMenuPayload }
  | { ok: false; reason: 'needs_app_update' | 'invalid'; detail: string };

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** App side. Accepts a payload only if every item is complete and priced. */
export function parseAppMenuPayload(raw: unknown, appSchema: number = APP_MENU_SCHEMA): ParsedAppMenu {
  const bad = (detail: string): ParsedAppMenu => ({ ok: false, reason: 'invalid', detail });
  if (!raw || typeof raw !== 'object') return bad('not an object');
  const p = raw as Partial<AppMenuPayload>;
  if (!isNum(p.schema)) return bad('no schema');
  if (p.schema !== appSchema) {
    return { ok: false, reason: 'needs_app_update', detail: `server schema ${p.schema}, app schema ${appSchema}` };
  }
  if (!isStr(p.version) || !isStr(p.updatedAt)) return bad('no version');
  if (!Array.isArray(p.categories) || !Array.isArray(p.items)) return bad('no categories/items');
  if (!p.items.length || p.items.length > MAX_ITEMS) return bad(`item count ${p.items.length}`);

  const catIds = new Set<string>();
  for (const c of p.categories as Category[]) {
    if (!c || !isStr(c.id) || !isStr(c.nameAr) || !isStr(c.nameEn)) return bad('category shape');
    catIds.add(c.id);
  }
  const itemIds = new Set<string>();
  for (const i of p.items as MenuItem[]) {
    if (!i || !isStr(i.id) || !isStr(i.nameAr) || !isStr(i.nameEn)) return bad('item shape');
    if (itemIds.has(i.id)) return bad(`duplicate item ${i.id}`);
    itemIds.add(i.id);
    if (!catIds.has(i.categoryId)) return bad(`${i.id}: unknown category ${i.categoryId}`);
    if (i.imageUrl !== undefined && typeof i.imageUrl !== 'string') return bad(`${i.id}: image`);
    if (!Array.isArray(i.sizes) || !i.sizes.length) return bad(`${i.id}: no sizes`);
    for (const z of i.sizes) {
      if (!z || !SIZE_IDS.has(z.id) || !isStr(z.nameAr) || !isStr(z.nameEn)) return bad(`${i.id}: size shape`);
      if (!isNum(z.price) || z.price <= 0) return bad(`${i.id}: size priced ${z.price}`);
    }
    if (!Array.isArray(i.customizations)) return bad(`${i.id}: customizations`);
    for (const g of i.customizations) {
      if (!g || !isStr(g.id) || !isStr(g.nameEn) || typeof g.nameAr !== 'string'
        || typeof g.multiple !== 'boolean' || !Array.isArray(g.options)) return bad(`${i.id}: group shape`);
      for (const o of g.options) {
        if (!o || !isStr(o.id) || !isStr(o.nameEn) || typeof o.nameAr !== 'string') return bad(`${i.id}: option shape`);
        if (!isNum(o.priceDelta) || o.priceDelta < 0) return bad(`${i.id}: option priced ${o.priceDelta}`);
      }
    }
  }
  return { ok: true, payload: p as AppMenuPayload };
}
