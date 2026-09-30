import { describe, expect, it } from 'vitest';
import { APP_MENU_SCHEMA, buildAppMenuPayload, parseAppMenuPayload } from '@almond/shared/menu/remote';
import { categories, menuItems } from '@almond/shared/menu/seed';
import { menuPulledAt } from '@almond/shared/menu/menu.generated';
import type { MenuItem } from '@almond/shared/types';
import { GET, OPTIONS } from '@/app/api/menu/app/route';

/**
 * The app's menu arrives from the server like Careem/Talabat — with every push,
 * no store release — unless its SHAPE changes (GM, 2026-09-30). These pin the
 * two halves: what the server sends, and what an app build will accept.
 */

const build = () => buildAppMenuPayload({ categories, items: menuItems, updatedAt: menuPulledAt, assetBase: 'https://menu.example' });
const withItem = (patch: (i: MenuItem) => MenuItem) => {
  const p = build();
  return { ...p, items: [patch(structuredClone(p.items[0]!)), ...p.items.slice(1)] };
};

describe('app menu payload', () => {
  it('round-trips the whole menu, photos made absolute', () => {
    const p = build();
    expect(p.schema).toBe(APP_MENU_SCHEMA);
    expect(p.items).toHaveLength(menuItems.length);
    for (const i of p.items) if (i.imageUrl) expect(i.imageUrl).toMatch(/^https:\/\/menu\.example\/menu\//);
    const parsed = parseAppMenuPayload(JSON.parse(JSON.stringify(p)));
    expect(parsed.ok).toBe(true);
  });

  it('the version changes when the menu does, and only then', () => {
    expect(build().version).toBe(build().version);
    const changed = buildAppMenuPayload({ categories, items: menuItems.slice(1), updatedAt: menuPulledAt, assetBase: 'https://menu.example' });
    expect(changed.version).not.toBe(build().version);
  });

  it('a menu SHAPE this build cannot read is refused as needs_app_update', () => {
    const r = parseAppMenuPayload({ ...build(), schema: APP_MENU_SCHEMA + 1 });
    expect(r).toMatchObject({ ok: false, reason: 'needs_app_update' });
  });

  it.each([
    ['a size priced 0', (i: MenuItem) => ({ ...i, sizes: [{ ...i.sizes[0]!, price: 0 }] })],
    ['a negative add-on', (i: MenuItem) => ({ ...i, customizations: [{ id: 'g', nameAr: '', nameEn: 'G', multiple: true, options: [{ id: 'o', nameAr: '', nameEn: 'O', priceDelta: -1 }] }] })],
    ['no sizes', (i: MenuItem) => ({ ...i, sizes: [] })],
    ['an unknown category', (i: MenuItem) => ({ ...i, categoryId: 'cat-nope' })],
    ['a size id the app cannot key', (i: MenuItem) => ({ ...i, sizes: [{ ...i.sizes[0]!, id: 'XL' as 'S' }] })],
    ['a missing name', (i: MenuItem) => ({ ...i, nameAr: '' })],
  ])('refuses the WHOLE payload for %s', (_why, patch) => {
    expect(parseAppMenuPayload(withItem(patch))).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('refuses duplicates, an empty menu and garbage', () => {
    const p = build();
    expect(parseAppMenuPayload({ ...p, items: [p.items[0], p.items[0]] }).ok).toBe(false);
    expect(parseAppMenuPayload({ ...p, items: [] }).ok).toBe(false);
    expect(parseAppMenuPayload('<html>').ok).toBe(false);
    expect(parseAppMenuPayload(null).ok).toBe(false);
  });
});

describe('GET /api/menu/app', () => {
  it('serves a payload every app build of this schema accepts, open to any origin, CDN-cached', async () => {
    const res = await GET(new Request('https://almond-gules.vercel.app/api/menu/app'));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toMatch(/public.*s-maxage=/);
    const parsed = parseAppMenuPayload(await res.json());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.payload.items).toHaveLength(menuItems.length);
      expect(parsed.payload.items.find((i) => i.imageUrl)!.imageUrl).toMatch(/^https:\/\/almond-gules\.vercel\.app\/menu\//);
    }
    expect((await OPTIONS()).status).toBe(204);
  });
});
