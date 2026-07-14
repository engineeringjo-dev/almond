/**
 * Rule-based cross-sell / upsell engine now lives in the shared package so the
 * app and website suggest the same pairings (handoff §9).
 * Re-exported so existing `@/lib/recommendations` imports keep working.
 * Source: packages/shared/src/lib/recommendations.ts.
 */
export * from '@almond/shared/lib/recommendations';
