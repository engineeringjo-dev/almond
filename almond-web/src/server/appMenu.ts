import { buildAppMenuPayload } from '@almond/shared/menu/remote';
import { categories, menuItems } from '@almond/shared/menu/seed';
import { menuPulledAt } from '@almond/shared/menu/menu.generated';

/** Helpers for GET /api/menu/app — kept here because a Next route file may
 *  export only its handlers. The body is built once per photo origin: it only
 *  changes when the site redeploys (every push, including the daily menu sync). */
const cache = new Map<string, { body: string; etag: string }>();

/** The body, and its ETag — the payload's content version, which the app sends
 *  back as If-None-Match so an unchanged menu costs a 304 and no download. */
export function appMenuFor(base: string): { body: string; etag: string } {
  let hit = cache.get(base);
  if (!hit) {
    const payload = buildAppMenuPayload({ categories, items: menuItems, updatedAt: menuPulledAt, assetBase: base });
    hit = { body: JSON.stringify(payload), etag: `"${payload.version}"` };
    cache.set(base, hit);
  }
  return hit;
}

export function photoBase(req: Request): string {
  const pinned = process.env.PUBLIC_MENU_ASSET_BASE?.trim().replace(/\/+$/, '');
  return pinned || new URL(req.url).origin;
}
