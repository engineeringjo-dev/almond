import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Response headers for EVERY path — pages, the back-office and /api alike.
 *
 * There were none. The back-office (/admin) replaces a company's whole roster
 * in one click, so a page that could frame it could trick a signed-in
 * administrator into that click (clickjacking); `frame-ancestors 'none'` and
 * X-Frame-Options (for older browsers) forbid framing outright — nothing in
 * this site is meant to be embedded.
 *
 * The ENFORCED CSP holds only directives that cannot break rendering. The full
 * policy ships REPORT-ONLY: Next injects inline bootstrap scripts, so enforcing
 * `script-src` needs a nonce pipeline in middleware first. Promote it once the
 * report is clean. Geolocation stays allowed for this origin — the branch
 * finder asks for it (components/branches/BranchesExplorer.tsx).
 */
const CSP_ENFORCED = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.deliveryhero.io",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

export const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP_ENFORCED },
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Consume the shared TypeScript package (@almond/shared) directly as source.
  transpilePackages: ['@almond/shared'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  images: {
    // Real product photos come from the Talabat (Delivery Hero) CDN.
    remotePatterns: [{ protocol: 'https', hostname: 'images.deliveryhero.io' }],
  },
};

export default withNextIntl(nextConfig);
