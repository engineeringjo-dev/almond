/**
 * Menu-category classification now lives in the shared package (single source
 * for app + website cross-sell / icons / nutrition).
 * Re-exported so existing `@/lib/categoryKind` imports keep working.
 * Source: packages/shared/src/lib/categoryKind.ts — see WEBSITE-HANDOFF §4/§10.
 */
export * from '@almond/shared/lib/categoryKind';
