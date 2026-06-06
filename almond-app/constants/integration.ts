/**
 * The Odoo / loyalty-server / POS integration map now lives in the shared
 * package (same contract for app + website). Re-exported so existing
 * `@/constants/integration` imports keep working.
 * Source: packages/shared/src/integration/index.ts — see WEBSITE-HANDOFF §7/§10.
 */
export * from '@almond/shared/integration';
