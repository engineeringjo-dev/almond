import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPublicMenuFeed, PUBLIC_BRANCHES } from '@almond/shared/menu/publicFeed';
import { generatedCategories, generatedMenuItems, menuPulledAt } from '@almond/shared/menu/menu.generated';
import { GET, OPTIONS } from '@/app/api/public/menu/route';

/**
 * Guards GET /api/public/menu — the read-only feed the public website builds
 * its WhatsApp order page from (GM, 2026-09-25).
 *
 * The first block is the privacy guard: the EXACT key set of every object in
 * the feed is pinned, so nothing — a member field, a cost price, a key — can
 * be added to a public, unauthenticated, CORS-readable response by accident.
 */

const BASE = 'https://menu.example';
const feed = buildPublicMenuFeed({
  categories: generatedCategories,
  items: generatedMenuItems,
  updatedAt: menuPulledAt,
  assetBase: BASE,
  taxRate: 0.08,
  pricesIncludeTax: true,
});
const keys = (o: object) => Object.keys(o).sort();

describe('public menu feed — only public fields', () => {
  it('pins the key set of every object', () => {
    expect(keys(feed)).toEqual(['branches', 'categories', 'currency', 'image_max_px', 'items', 'offers',
      'option_groups', 'prices_include_tax', 'schema_version', 'tax_rate', 'updated_at']);
    for (const b of feed.branches) expect(keys(b)).toEqual(['app_branch_id', 'name_ar', 'name_en', 'slug']);
    for (const c of feed.categories) expect(keys(c)).toEqual(['id', 'name_ar', 'name_en', 'sort']);
    for (const g of feed.option_groups) {
      expect(keys(g)).toEqual(['choices', 'default_choice_id', 'id', 'multi', 'name_ar', 'name_en', 'required']);
      for (const ch of g.choices) expect(keys(ch)).toEqual(['id', 'name_ar', 'name_en', 'price_delta']);
    }
    for (const i of feed.items) {
      expect(keys(i)).toEqual(['available', 'branches', 'category_id', 'desc_ar', 'desc_en', 'id', 'image_url',
        'name_ar', 'name_en', 'odoo_template_id', 'option_group_ids', 'price', 'sizes', 'sort', 'tags']);
      for (const z of i.sizes) expect(keys(z)).toEqual(['id', 'name_ar', 'name_en', 'price']);
    }
    expect(feed.offers).toEqual([]);
  });

  it('is built from the menu module alone — it imports nothing but types', () => {
    const src = readFileSync(join(__dirname, '../../packages/shared/src/menu/publicFeed.ts'), 'utf8');
    const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports).toEqual(['../types']);
    expect(src).toMatch(/^import type /m);
  });
});

describe('public menu feed — data the order page relies on', () => {
  it('carries the whole shop menu with a real price on every item', () => {
    expect(feed.items).toHaveLength(generatedMenuItems.length);
    expect(feed.prices_include_tax).toBe(true);
    expect(feed.currency).toBe('JOD');
    for (const i of feed.items) {
      expect(i.price, i.name_en).toBeGreaterThan(0);
      expect(i.price).toBeLessThanOrEqual(Math.min(...i.sizes.map((z) => z.price)) + 10);
      expect(Number.isInteger(i.odoo_template_id)).toBe(true);
    }
  });

  it('every reference resolves, every id is unique where a client keys on it', () => {
    const groups = new Map(feed.option_groups.map((g) => [g.id, g]));
    expect(groups.size).toBe(feed.option_groups.length);
    const cats = new Set(feed.categories.map((c) => c.id));
    const ids = new Set(feed.items.map((i) => i.id));
    expect(ids.size).toBe(feed.items.length);
    for (const i of feed.items) {
      expect(cats.has(i.category_id)).toBe(true);
      expect(new Set(i.sizes.map((z) => z.id)).size, i.name_en).toBe(i.sizes.length);
      for (const g of i.option_group_ids) expect(groups.has(g), `${i.name_en} → ${g}`).toBe(true);
    }
    for (const g of feed.option_groups) {
      expect(new Set(g.choices.map((c) => c.id)).size, g.id).toBe(g.choices.length);
      expect(new Set(g.choices.map((c) => c.name_en.toLowerCase())).size, g.id).toBe(g.choices.length);
      if (g.required) {
        expect(g.multi).toBe(false);
        expect(g.choices.some((c) => c.id === g.default_choice_id), g.id).toBe(true);
      } else {
        expect(g.default_choice_id).toBeNull();
      }
    }
  });

  it('milk is one required choice, regular milk free and special milks +0.400', () => {
    const milk = feed.option_groups.find((g) => g.id === 'milk')!;
    expect(milk).toMatchObject({ required: true, multi: false, default_choice_id: 'fresh_milk' });
    const delta = Object.fromEntries(milk.choices.map((c) => [c.id, c.price_delta]));
    expect(delta).toMatchObject({ fresh_milk: 0, skimmed_milk: 0, oat_milk: 0.4, almond_milk: 0.4,
      soy_milk: 0.4, coconut_milk: 0.4, lactose_free_milk: 0.4 });
  });

  it('keeps five cake sizes as five sizes (the app collapses them to S/M/L)', () => {
    expect(feed.items.some((i) => i.sizes.length === 5)).toBe(true);
  });

  it('pizza and pasta only at the five kitchen branches; the rest everywhere', () => {
    const kitchen = ['rabieh', 'circle8', 'ju', 'madina', 'shafa'];
    const catName = new Map(feed.categories.map((c) => [c.id, c.name_en]));
    for (const i of feed.items) {
      const cat = catName.get(i.category_id);
      if (cat === 'Pizza' || cat === 'Pasta') expect(i.branches, i.name_en).toEqual(kitchen);
      else expect(i.branches).toHaveLength(PUBLIC_BRANCHES.length);
    }
  });

  it('tags gluten-free and keto items', () => {
    const brownie = feed.items.find((i) => i.name_en === 'Gluten Free Keto Brownie')!;
    expect(brownie.tags).toEqual(expect.arrayContaining(['gluten_free', 'keto']));
    expect(feed.items.find((i) => i.name_en === 'Iced Spanish Latte')!.tags).toEqual([]);
  });

  it('photos are absolute URLs on the asset base; items without one say null', () => {
    for (const i of feed.items) {
      if (i.image_url !== null) expect(i.image_url).toMatch(/^https:\/\/menu\.example\/menu\/p-\d+\.webp$/);
    }
    expect(feed.items.some((i) => i.image_url === null)).toBe(true);
  });
});

describe('GET /api/public/menu', () => {
  const req = (origin?: string, ip = '203.0.113.1') => new Request('https://almond-gules.vercel.app/api/public/menu', {
    headers: { ...(origin ? { origin } : {}), 'x-forwarded-for': ip },
  });

  it('serves the feed, cacheable, to the website origin', async () => {
    const res = await GET(req('https://almondcoffeehouse.com'));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://almondcoffeehouse.com');
    expect(res.headers.get('vary')).toBe('Origin');
    expect(res.headers.get('cache-control')).toMatch(/public.*s-maxage=/);
    const body = await res.json();
    expect(body.items.length).toBe(generatedMenuItems.length);
    expect(body.items.find((i: { image_url: string | null }) => i.image_url)?.image_url)
      .toMatch(/^https:\/\/almond-gules\.vercel\.app\/menu\//);
  });

  it('gives no CORS grant to any other origin', async () => {
    const res = await GET(req('https://evil.example', '203.0.113.2'));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    const pre = await OPTIONS(req('https://evil.example'));
    expect(pre.headers.get('access-control-allow-origin')).toBeNull();
    const ok = await OPTIONS(req('https://www.almondcoffeehouse.com'));
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://www.almondcoffeehouse.com');
  });

  it('rate-limits one caller past 60 a minute', async () => {
    let last = 0;
    for (let n = 0; n < 61; n++) last = (await GET(req(undefined, '198.51.100.7'))).status;
    expect(last).toBe(429);
    expect((await GET(req(undefined, '198.51.100.8'))).status).toBe(200);
  });
});
