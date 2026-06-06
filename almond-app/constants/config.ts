/**
 * The single config switch (DATA_SOURCE + loyalty/pricing constants) now lives
 * in the shared package so the app and website use identical numbers.
 * Re-exported so existing `@/constants/config` imports keep working.
 * Source: packages/shared/src/config/index.ts — see WEBSITE-HANDOFF §6/§7/§10.
 */
export * from '@almond/shared/config';
