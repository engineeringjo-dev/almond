import { buildPublicMenuFeed, type PublicMenuFeed } from '@almond/shared/menu/publicFeed';
import { generatedCategories, generatedMenuItems, menuPulledAt } from '@almond/shared/menu/menu.generated';
import { config } from '@almond/shared/config';

/** Helpers for GET /api/public/menu (app/api/public/menu/route.ts) — kept here
 *  because a Next route file may export only its handlers. */

const DEFAULT_ORIGINS = 'https://almondcoffeehouse.com,https://www.almondcoffeehouse.com';

export function allowedOrigins(env: string | undefined = process.env.PUBLIC_MENU_CORS_ORIGINS): Set<string> {
  return new Set((env ?? DEFAULT_ORIGINS).split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean));
}

/** Photos are absolute URLs so a page on another domain can show them.
 *  PUBLIC_MENU_ASSET_BASE pins the origin (e.g. a custom domain); otherwise the
 *  origin this request arrived on. */
export function assetBase(req: Request): string {
  const pinned = process.env.PUBLIC_MENU_ASSET_BASE?.trim().replace(/\/+$/, '');
  return pinned || new URL(req.url).origin;
}

const cache = new Map<string, string>();
export function feedFor(base: string): string {
  let body = cache.get(base);
  if (!body) {
    const feed: PublicMenuFeed = buildPublicMenuFeed({
      categories: generatedCategories,
      items: generatedMenuItems,
      updatedAt: menuPulledAt,
      assetBase: base,
      taxRate: config.TAX_RATE,
      pricesIncludeTax: config.PRICES_TAX_INCLUSIVE,
    });
    body = JSON.stringify(feed);
    cache.set(base, body);
  }
  return body;
}

const RATE_PER_MIN = 60;
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimited(ip: string, now = Date.now()): boolean {
  const h = hits.get(ip);
  if (!h || now >= h.reset) {
    if (hits.size > 10_000) hits.clear();
    hits.set(ip, { n: 1, reset: now + 60_000 });
    return false;
  }
  h.n++;
  return h.n > RATE_PER_MIN;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const h: Record<string, string> = { Vary: 'Origin' };
  if (origin && allowedOrigins().has(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
