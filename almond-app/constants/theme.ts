/**
 * Brand theme tokens now live in the shared package (single source of truth for
 * the app + website). Re-exported so existing `@/constants/theme` imports keep
 * working. Source: packages/shared/src/theme/index.ts — see WEBSITE-HANDOFF §10.
 */
export * from '@almond/shared/theme';
