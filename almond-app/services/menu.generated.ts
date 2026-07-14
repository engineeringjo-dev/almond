/**
 * The real Talabat menu export now lives in the shared package (single menu
 * source for app + website). Re-exported so existing
 * `@/services/menu.generated` imports keep working.
 * Source: packages/shared/src/menu/menu.generated.ts — see WEBSITE-HANDOFF §5/§10.
 */
export * from '@almond/shared/menu/menu.generated';
