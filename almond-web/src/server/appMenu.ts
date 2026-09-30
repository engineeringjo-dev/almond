import { buildAppMenuPayload } from '@almond/shared/menu/remote';
import { categories, menuItems } from '@almond/shared/menu/seed';
import { menuPulledAt } from '@almond/shared/menu/menu.generated';

/** Helpers for GET /api/menu/app — kept here because a Next route file may
 *  export only its handlers. The body is built once per photo origin: it only
 *  changes when the site redeploys (every push, including the daily menu sync). */
const cache = new Map<string, string>();

export function appMenuFor(base: string): string {
  let body = cache.get(base);
  if (!body) {
    body = JSON.stringify(buildAppMenuPayload({ categories, items: menuItems, updatedAt: menuPulledAt, assetBase: base }));
    cache.set(base, body);
  }
  return body;
}

export function photoBase(req: Request): string {
  const pinned = process.env.PUBLIC_MENU_ASSET_BASE?.trim().replace(/\/+$/, '');
  return pinned || new URL(req.url).origin;
}
