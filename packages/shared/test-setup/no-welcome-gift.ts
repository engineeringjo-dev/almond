/**
 * THE WELCOME GIFT IS OFF UNDER TEST, except where a test turns it on.
 *
 * config.WELCOME_BONUS_POINTS pays 200 points on a member's first paid
 * purchase (loyalty/welcome.ts). Hundreds of tests make exactly that purchase
 * on a fresh member and assert the balance it leaves; with the gift on, every
 * one of them would be asserting the gift instead of the thing it tests. So
 * the dial is 0 for every test file — the same treatment as the double-points
 * calendar (no-double-days.ts) — and the tests OF the gift switch it on with
 * `withWelcomeGift`, or set it in their own beforeAll.
 *
 * Listed in `setupFiles` by the bff, app and website vitest configs.
 * bff/test/welcome.test.ts asserts the shipped value through
 * SHIPPED_WELCOME_BONUS_POINTS, so the 0 here can never hide a change to it.
 */
import { config } from '../src/config/index';

const dial = config as { WELCOME_BONUS_POINTS: number };
export const SHIPPED_WELCOME_BONUS_POINTS = dial.WELCOME_BONUS_POINTS;
dial.WELCOME_BONUS_POINTS = 0;

/** Run `fn` with the gift at `points` (the shipped value by default), then
 *  switch it off again — also when `fn` throws or rejects. */
export async function withWelcomeGift<T>(
  fn: () => Promise<T> | T,
  points: number = SHIPPED_WELCOME_BONUS_POINTS,
): Promise<T> {
  dial.WELCOME_BONUS_POINTS = points;
  try {
    return await fn();
  } finally {
    dial.WELCOME_BONUS_POINTS = 0;
  }
}

/** For a describe block that tests the gift throughout. */
export function setWelcomeGift(points: number): void {
  dial.WELCOME_BONUS_POINTS = points;
}
