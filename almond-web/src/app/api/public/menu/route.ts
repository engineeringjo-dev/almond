import { NextResponse } from 'next/server';
import { assetBase, corsHeaders, feedFor, rateLimited } from '@/server/publicMenu';

export const runtime = 'nodejs';

/**
 * GET /api/public/menu — the shop's menu as read-only JSON for the public
 * website (almondcoffeehouse.com), so the website's WhatsApp order page and the
 * app read the SAME items, prices, options and photos (GM, 2026-09-25).
 *
 * Deliberately NOT behind the BFF: this needs no member, no database and no
 * key, so it keeps working before the loyalty backend is hosted, and a busy
 * website can never put load on the money path.
 *
 * - No auth, no cookies read, no customer data (see publicFeed.ts header).
 * - CORS: only the origins in PUBLIC_MENU_CORS_ORIGINS (default: the website,
 *   with and without www). Any site can still fetch it server-side — it is
 *   public data; CORS only decides which BROWSER pages may read it.
 * - Cached at Vercel's CDN (s-maxage) and in the browser; the body only
 *   changes when the menu is re-pulled from Odoo and the site redeploys.
 * - Rate limit: best-effort per-IP, per instance (the CDN absorbs repeat
 *   traffic before it reaches this function).
 */

export async function GET(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, {
      status: 429, headers: { ...corsHeaders(req), 'Retry-After': '60' },
    });
  }
  return new NextResponse(feedFor(assetBase(req)), {
    status: 200,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}
