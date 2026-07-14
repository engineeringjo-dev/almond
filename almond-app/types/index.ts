/**
 * Domain types now live in the shared package (single source of truth for the
 * app + website). Re-exported here so existing `@/types` imports keep working.
 * Source: packages/shared/src/types/index.ts — see docs/WEBSITE-HANDOFF.md §10.
 */
export * from '@almond/shared/types';
