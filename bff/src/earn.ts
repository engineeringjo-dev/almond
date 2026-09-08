/** The server earn is THE shared earn. No arithmetic lives here any more —
 *  it lives in packages/shared/src/loyalty/earn.ts, which the app and the
 *  website import too. Re-exported so import paths do not churn.
 *  See docs/LOYALTY-EARN-PATCH.md §3. */
export {
  computeEarn, earnedPoints, earnRulesFromConfig,
  type EarnContext, type EarnBreakdown, type EarnRules,
} from '@almond/shared/loyalty/earn';
