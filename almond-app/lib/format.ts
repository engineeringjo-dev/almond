/**
 * JOD / number / date formatting now lives in the shared package.
 * Re-exported so existing `@/lib/format` imports keep working.
 * Source: packages/shared/src/lib/format.ts — see WEBSITE-HANDOFF §4/§10.
 */
export * from '@almond/shared/lib/format';
