/**
 * THE DOUBLE-POINTS CALENDAR IS EMPTY UNDER TEST.
 *
 * config.DOUBLE_POINTS_DAYS doubles the earn rate on Ramadan, the Eids, Coffee
 * Day and Jordan's official holidays, decided by the Amman day of the sale.
 * Hundreds of tests compute a grant at "now"; without this file every one of
 * them would answer differently when CI happens to run on a holiday, and a red
 * build on 1 October would say nothing about the change under review.
 *
 * Listed in `setupFiles` by the bff, app and website vitest configs, so it runs
 * before each test file's own imports. bff/test/doubleDays.test.ts tests the
 * shipped list explicitly through SHIPPED_DOUBLE_POINTS_DAYS, and
 * `withShippedDoubleDays` puts it back for a test that must see the real dial.
 */
import { config, SHIPPED_DOUBLE_POINTS_DAYS, type DoublePointsDay } from '../src/config/index';

const dial = config as { DOUBLE_POINTS_DAYS: readonly DoublePointsDay[] };
dial.DOUBLE_POINTS_DAYS = [];

export function withShippedDoubleDays<T>(fn: () => T): T {
  dial.DOUBLE_POINTS_DAYS = SHIPPED_DOUBLE_POINTS_DAYS;
  try {
    return fn();
  } finally {
    dial.DOUBLE_POINTS_DAYS = [];
  }
}
