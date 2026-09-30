import { NextResponse } from 'next/server';
import { appMenuFor, photoBase } from '@/server/appMenu';

export const runtime = 'nodejs';

/**
 * GET /api/menu/app — the menu the app loads on launch, in the app's own
 * MenuItem shape (packages/shared/src/menu/remote.ts). GM, 2026-09-30: the menu
 * updates like Careem/Talabat — with every push, without a store release —
 * unless its SHAPE changes (APP_MENU_SCHEMA), which needs an app update.
 *
 * Public, read-only, no auth, no customer data: exactly the menu the website
 * already shows. CORS is open (`*`, no credentials) because the callers are the
 * native app (sends no Origin) and the app's web build on another domain.
 * CDN-cached briefly so a menu change reaches phones within minutes.
 *
 * CHEAP WHEN NOTHING CHANGED (GM: «بس بدون ابطاء التطبيق»): the ETag is the
 * menu's content version; the app sends it back as If-None-Match and an
 * unchanged menu is answered 304 with no body — no download, no parsing.
 *
 * NOT per-IP rate-limited, on purpose: mobile carriers put many phones behind
 * one address (CGNAT), so a per-IP cap would lock real customers out of the
 * menu. The body is a precomputed constant served mostly from the CDN.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'If-None-Match',
  'Access-Control-Expose-Headers': 'ETag',
};
const CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';

export async function GET(req: Request) {
  const { body, etag } = appMenuFor(photoBase(req));
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ...CORS, ETag: etag, 'Cache-Control': CACHE } });
  }
  return new NextResponse(body, {
    status: 200,
    headers: { ...CORS, ETag: etag, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': CACHE },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });
}
