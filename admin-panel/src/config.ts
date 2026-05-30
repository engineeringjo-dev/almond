/**
 * Same single-switch pattern as the mobile app (section 6.1 / 13.5).
 * Mock store runs standalone; flip to 'live' to hit the loyalty server's
 * /admin/* endpoints (section 13.3, 14.4).
 */
export const config = {
  DATA_SOURCE: 'mock' as 'mock' | 'live',
  LOYALTY_BASE_URL: 'https://loyalty.almond.jo',
};
