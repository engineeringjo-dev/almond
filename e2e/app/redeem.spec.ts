import { test, expect } from '@playwright/test';
import { appUrl, seedApp } from './helpers';

/**
 * «استبدال» ON THE WEB BUILD.
 *
 * react-native-web's Alert is an empty function, so this button once asked
 * nothing and redeemed nothing on the web (layout panel, 2026-10-15). The
 * question is now a sheet on the Rewards tab (components/loyalty/RedeemSheet.tsx),
 * the same on every platform: the amount, then «استبدال», then «خصمك جاهز»
 * with the way to the coupon. The mock seeds 1,240 points (12.400 د.أ); 1.000 د.أ costs
 * 100.
 */
const ONE_JOD = 'اخصم 1.000 د.أ من فاتورتك مقابل 100 من نقاطك';
const WORTH_BEFORE = /تساوي 12\.400 د\.أ/;
const WORTH_AFTER = /تساوي 11\.400 د\.أ/;

test.describe('App: redeeming on the web', () => {
  test('asks in a sheet, takes 100 points, and the coupon is in «قسائمي»', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/rewards'));
    await expect(page.getByText(WORTH_BEFORE)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: ONE_JOD }).click();
    const sheet = page.getByRole('dialog', { name: 'تأكيد الاستبدال' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('نخصم 1.000 د.أ من فاتورتك مقابل 100 من نقاطك؟');

    await sheet.getByRole('button', { name: 'استبدال', exact: true }).click();
    const done = page.getByRole('dialog', { name: 'خصمك جاهز' });
    await expect(done).toContainText('حوّلنا 1.000 د.أ من نقاطك إلى خصم يُطبَّق على فاتورتك عند الدفع');
    await expect(page.getByText(WORTH_AFTER)).toBeVisible();

    await done.getByRole('button', { name: 'قسائمي', exact: true }).click();
    await expect(page).toHaveURL(/\/vouchers$/);
    await expect(page.getByText('خصم 1.000 د.أ من فاتورتك', { exact: true })).toBeVisible();
  });

  test('«إلغاء» redeems nothing', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/rewards'));
    await expect(page.getByText(WORTH_BEFORE)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: ONE_JOD }).click();
    const sheet = page.getByRole('dialog', { name: 'تأكيد الاستبدال' });
    await sheet.getByRole('button', { name: 'إلغاء', exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText(WORTH_BEFORE)).toBeVisible();
    await expect(page.getByText(WORTH_AFTER)).toHaveCount(0);
    // And the tile still says there is no coupon.
    await expect(page.getByTestId('rewards-tile').nth(1)).toContainText('لا توجد قسائم نشطة');
  });

  test('the whole balance is one tap away, named in words', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/rewards'));
    const all = page.getByRole('button', { name: 'كل نقاطك: اخصم 12.400 د.أ من فاتورتك مقابل 1,240 من نقاطك' });
    await expect(all).toBeVisible({ timeout: 20_000 });
    await expect(all).toHaveText('كل نقاطك');
    await all.click();
    await expect(page.getByRole('dialog', { name: 'تأكيد الاستبدال' }))
      .toContainText('نخصم 12.400 د.أ من فاتورتك مقابل 1,240 من نقاطك؟');
  });
});
