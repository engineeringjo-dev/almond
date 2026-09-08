/**
 * Resolve a menu photograph's URL for the platform that is about to render it.
 *
 * WAS `cdnImage`, AND THE RENAME IS THE POINT. Until 2026-09-08 every menu photo
 * was an absolute `images.deliveryhero.io` URL — Talabat's CDN, serving our menu
 * at their discretion — and this function's only job was to append `?width=`.
 * The Odoo pull replaced all 306 with WebP files we own under `public/menu/`,
 * so there is no CDN left to name.
 *
 * 🔴 THE BASE PATH IS NOT DECORATION. The website is served from a domain root,
 * but the app's web build is served from a SUBPATH — `app.json` sets
 * `experiments.baseUrl = "/almond"` for GitHub Pages — so the literal
 * `/menu/p-123.webp` stored in the menu data resolves to
 * `engineeringjo-dev.github.io/menu/...` and 404s. Expo substitutes
 * `process.env.EXPO_BASE_URL` at build time; prefixing with it is what makes the
 * same menu payload render on both surfaces.
 *
 * `width` is now advisory: the files are pre-sized to 512px WebP by the pull, so
 * there is nothing to ask a CDN for. It stays in the signature because the
 * legacy absolute URLs below still honour it, and a caller should not have to
 * know which kind of URL it holds.
 */
export function menuImage(url: string | undefined, width: number): string | undefined {
  if (!url) return url;

  // Legacy absolute URLs. Retired by the Odoo pull, kept so a cached payload
  // from before the cutover still renders instead of showing holes.
  if (/^https?:\/\//.test(url)) {
    if (!url.includes('images.deliveryhero.io') || url.includes('?')) return url;
    return `${url}?width=${Math.round(width)}`;
  }

  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
  return `${base}${url}`;
}
