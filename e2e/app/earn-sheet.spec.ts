import { test, expect } from '@playwright/test';
import { blockingViolations } from '../fixtures';
import { appUrl, seedApp } from './helpers';

/**
 * «اجمع نقاطك» — the till code opens by itself on launch and from Home's header
 * (owner, 2026-10-15, after Al Ameed). The decision is unit-tested in
 * almond-app/test/earnSheet.test.ts; this proves the real screen does it.
 */
const SHEET = 'اجمع نقاطك';

test.describe('App: the earn sheet', () => {
  test('a signed-in member gets the code on launch, can close it and reopen it from the header', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedApp(page, { signedIn: true, lang: 'ar', earnSheet: true });
    await page.goto(appUrl('/'));

    const sheet = page.getByRole('dialog', { name: SHEET });
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByText('اعرض الباركود على الكاشير', { exact: false })).toBeVisible();

    const { blocking } = await blockingViolations(page);
    expect(blocking, 'the open sheet must pass axe').toEqual([]);

    await sheet.getByRole('button', { name: 'إغلاق' }).click();
    await expect(sheet).toBeHidden();

    // Once per launch: leaving Home and coming back does not reopen it.
    await page.getByRole('button', { name: SHEET, exact: true }).click();
    await expect(sheet).toBeVisible();
    // A tap is not an automatic open, so there is nothing to opt out of.
    await expect(sheet.getByText('لا تفتح هذا تلقائياً', { exact: false })).toHaveCount(0);
  });

  test('a guest is not shown a code', async ({ page }) => {
    await seedApp(page, { lang: 'ar', earnSheet: true });
    await page.goto(appUrl('/'));
    await expect(page.getByRole('button', { name: SHEET, exact: true })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_000);
    await expect(page.getByRole('dialog', { name: SHEET })).toHaveCount(0);
  });

  test('a member who switched it off is not shown it on launch', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('almond.autoEarnQr', '0'); } catch { /* storage blocked */ }
    });
    await seedApp(page, { signedIn: true, lang: 'ar', earnSheet: true });
    await page.goto(appUrl('/'));
    await expect(page.getByRole('button', { name: SHEET, exact: true })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_000);
    await expect(page.getByRole('dialog', { name: SHEET })).toHaveCount(0);
  });

  test('«لا تفتح هذا تلقائياً» switches it off for the next launch', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar', earnSheet: true });
    await page.goto(appUrl('/'));
    const sheet = page.getByRole('dialog', { name: SHEET });
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await sheet.getByText('لا تفتح هذا تلقائياً', { exact: false }).click();
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('almond.autoEarnQr'))).toBe('0');
  });
});
