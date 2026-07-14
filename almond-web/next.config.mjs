import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Consume the shared TypeScript package (@almond/shared) directly as source.
  transpilePackages: ['@almond/shared'],
  images: {
    // Real product photos come from the Talabat (Delivery Hero) CDN.
    remotePatterns: [{ protocol: 'https', hostname: 'images.deliveryhero.io' }],
  },
};

export default withNextIntl(nextConfig);
