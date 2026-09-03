/**
 * Seed data (menu, branches, payment methods, loyalty tiers) now lives in the
 * shared package so the app and website stay identical by construction.
 * Re-exported here so existing `@/services/seed` imports keep working unchanged.
 * Source: packages/shared/src/menu/seed.ts + loyalty/constants.ts (WEBSITE-HANDOFF §10).
 */
export { categories, menuItems, branches, paymentMethods } from '@almond/shared/menu';
// The earn multiplier is applied only in loyalty/earn.ts, never from here.
// earn-arith-exempt: re-export of the shared tier ramp, for DISPLAY. §7 T7.
export { tiers, tierFromSpend, nextTier } from '@almond/shared/loyalty';
