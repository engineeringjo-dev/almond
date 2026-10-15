import { test, expect } from '@playwright/test';
import { blockingViolations } from '../fixtures';
import { appUrl, seedApp } from './helpers';

/**
 * «حذف الحساب» (owner, 2026-10-15): asked from Profile, confirmed once more,
 * then a date and a way back. The rule is unit-tested (bff AD1-AD2, T37; app
 * DA1-DA3); this proves the screens do it.
 */
test.describe('App: delete account', () => {
  test('Profile → explained → confirmed → a date; cancel brings it back', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/profile'));
    await page.getByRole('button', { name: 'حذف الحساب' }).click();

    await expect(page.getByText('ما الذي يبقى', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/وتنتهي في مواعيدها فقط/)).toBeVisible();
    await expect(page.getByText(/يُحذف بعد 30 يوماً من طلبك/)).toBeVisible();
    const { blocking } = await blockingViolations(page);
    expect(blocking, 'the deletion screen must pass axe').toEqual([]);

    // One tap is not enough: it asks once more.
    await page.getByRole('button', { name: 'احذف حسابي' }).click();
    await page.getByRole('button', { name: 'نعم، احذف حسابي بعد المهلة' }).click();
    await expect(page.getByText(/سيُحذف حسابك في/)).toBeVisible();

    await page.getByRole('button', { name: 'إلغاء طلب الحذف' }).click();
    await expect(page.getByRole('button', { name: 'احذف حسابي' })).toBeVisible();
  });

  test('a guest is not offered it', async ({ page }) => {
    await seedApp(page, { lang: 'ar' });
    await page.goto(appUrl('/profile'));
    await expect(page.getByRole('button', { name: 'تسجيل الخروج' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'حذف الحساب' })).toHaveCount(0);
  });
});
