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
 * NOT per-IP rate-limited, on purpose: mobile carriers put many phones behind
 * one address (CGNAT), so a per-IP cap would lock real customers out of the
 * menu. The body is a precomputed constant served mostly from the CDN.
 */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function GET(req: Request) {
  return new NextResponse(appMenuFor(photoBase(req)), {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });
}
