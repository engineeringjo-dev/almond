import { test, expect } from '@playwright/test';
import { blockingViolations } from '../fixtures';
import { appUrl, seedApp } from './helpers';

/**
 * «سجل النقاط» — counters on top, then each line with its branch and the day
 * its points run out (owner, 2026-10-15, after Al Ameed). The counting rule is
 * unit-tested (bff/test/history.test.ts H1); this proves the screen shows it.
 */
test.describe('App: the points history', () => {
  test('shows redeemed / visits / expired, and a purchase with its branch and expiry year', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/loyalty'));

    await expect(page.getByText('سجل النقاط')).toBeVisible({ timeout: 20_000 });
    for (const label of ['نقاط استبدلتها', 'زيارات', 'نقاط انتهت صلاحيتها']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    // The mock's seeded order: a purchase at a branch, with its lot's expiry.
    await expect(page.getByText(/فرع /).first()).toBeVisible();
    await expect(page.getByText(/تنتهي في .*20\d\d/).first()).toBeVisible();

    const { blocking } = await blockingViolations(page);
    expect(blocking, 'the history must pass axe').toEqual([]);
    await page.screenshot({ path: 'test-results/points-history-ar.png', fullPage: true });
  });
});
