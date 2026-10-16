import { test, expect } from '@playwright/test';
import { appUrl, seedApp } from './helpers';

/**
 * «استبدال» ON THE WEB BUILD.
 *
 * react-native-web's Alert is an empty function, so this button once asked
 * nothing and redeemed nothing on the web (layout panel, 2026-10-15). The
 * question is now a sheet on the Rewards tab (components/loyalty/RedeemSheet.tsx),
 * the same on every platform: the amount, then «استبدال», then «أصدرنا قسيمتك»
 * with the way to the coupon. The mock seeds 1,240 points (12.400 د.أ); 1.000 د.أ costs
 * 100.
 */
const ONE_JOD = 'استبدل 100 من نقاطك بقسيمة بقيمة 1.000 د.أ';
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
    await expect(sheet).toContainText('استبدال 100 من نقاطك بقسيمة بقيمة 1.000 د.أ؟');
    await expect(sheet).toContainText('قسيمة تجريبية للمعاينة فقط؛ لا يمكن استخدامها للدفع');

    await sheet.getByRole('button', { name: 'استبدال', exact: true }).click();
    const done = page.getByRole('dialog', { name: 'أصدرنا قسيمتك' });
    await expect(done).toContainText('حوّلنا نقاطك إلى قسيمة رصيد');
    await expect(done).toContainText('قسيمة بقيمة 1.000 د.أ');
    await expect(page.getByText(WORTH_AFTER)).toBeVisible();

    await done.getByRole('button', { name: 'عرض القسيمة', exact: true }).click();
    await expect(page).toHaveURL(/\/vouchers\?voucherId=vch[^&]+$/);
    // Focus must survive the outgoing Modal's trap and focus restoration.
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    const issued = page.getByTestId('issued-voucher');
    await expect(issued).toBeFocused();
    await expect(issued.getByText('قسيمة بقيمة 1.000 د.أ', { exact: true })).toBeVisible();
    await expect(issued).toContainText('تنتهي في');
    await expect(issued).toContainText('قسيمة تجريبية للمعاينة فقط؛ لا يمكن استخدامها للدفع');
    await expect(issued.locator('svg')).toHaveCount(1); // The type icon, never a fabricated QR.
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
    const all = page.getByRole('button', { name: 'كل نقاطك: استبدل 1,240 من نقاطك بقسيمة بقيمة 12.400 د.أ' });
    await expect(all).toBeVisible({ timeout: 20_000 });
    await expect(all).toHaveText('كل نقاطك');
    await all.click();
    await expect(page.getByRole('dialog', { name: 'تأكيد الاستبدال' }))
      .toContainText('استبدال 1,240 من نقاطك بقسيمة بقيمة 12.400 د.أ؟');
  });

  test('an English handoff retains focus after dismissal and handles a stale link', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-16T12:00:00+03:00') });
    await page.clock.resume();
    await seedApp(page, { signedIn: true, lang: 'en' });
    await page.goto(appUrl('/rewards'));
    // Reproduce a prior sheet dismissal and a fresh route load with the clock
    // installed, as in the mobile cart → rewards inspection journey.
    await page.getByRole('button', { name: 'Exchange 100 points for a credit voucher worth JOD 1.000' })
      .click({ timeout: 20_000 });
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.goto(appUrl('/rewards'));
    await page.getByRole('button', { name: 'Exchange 200 points for a credit voucher worth JOD 2.000' })
      .click({ timeout: 20_000 });
    const sheet = page.getByRole('dialog', { name: 'Confirm redemption' });
    await expect(sheet).toContainText('Demo voucher for preview only; it cannot be used for payment');
    await sheet.getByRole('button', { name: 'Redeem', exact: true }).click();
    const done = page.getByRole('dialog', { name: 'Voucher issued', exact: true });
    await done.getByRole('button', { name: 'View voucher', exact: true }).click();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    const issued = page.getByTestId('issued-voucher');
    await expect(issued).toBeFocused();
    await expect(issued).toContainText('JOD 2.000 credit voucher');
    await expect(issued).toContainText('Expires');
    await expect(issued).toContainText('Demo voucher for preview only; it cannot be used for payment');

    await page.goto(appUrl('/vouchers?voucherId=missing'));
    await expect(page.getByTestId('issued-voucher')).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText("This voucher isn't in your active vouchers");
  });
});
