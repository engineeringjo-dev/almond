/**
 * Request a resized image from the Talabat / deliveryhero CDN instead of the
 * full-resolution original. The CDN honours a `width` query param and
 * content-negotiates WebP/AVIF via the browser's Accept header, so this cuts
 * image bytes 70-90% at the thumbnail sizes we actually render. No-op for
 * non-CDN or already-parameterized URLs.
 */
export function cdnImage(url: string | undefined, width: number): string | undefined {
  if (!url) return url;
  if (!url.includes('images.deliveryhero.io')) return url;
  if (url.includes('?')) return url;
  return `${url}?width=${Math.round(width)}`;
}
