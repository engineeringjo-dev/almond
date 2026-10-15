import { test, expect, type Dialog } from '@playwright/test';
import { appUrl, seedApp } from './helpers';

/**
 * «استبدال» ON THE WEB BUILD (layout panel, 2026-10-15).
 *
 * react-native-web's Alert is an empty function, so this button asked nothing
 * and redeemed nothing on the web. The unit suite (almond-app/test/dialog.test.ts)
 * pins the helper; this proves a member in a browser can actually redeem, and
 * that saying no leaves the balance alone. The mock seeds 1,240 points
 * (12.400 د.أ); 1.000 د.أ costs 100.
 */
const ONE_JOD = 'اخصم 1.000 د.أ من فاتورتك مقابل 100 نقطة';

test.describe('App: redeeming on the web', () => {
  test('asks first, then takes 100 points and says so', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    const seen: string[] = [];
    page.on('dialog', (d: Dialog) => {
      seen.push(`${d.type()}: ${d.message()}`);
      void d.accept();
    });
    await page.goto(appUrl('/rewards'));
    await expect(page.getByText('12.400 د.أ', { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: ONE_JOD }).click();
    await expect.poll(() => seen.length).toBe(2);
    expect(seen[0]).toBe('confirm: تأكيد الاستبدال\n\nنخصم 1.000 د.أ من فاتورتك مقابل 100 نقطة؟');
    expect(seen[1]).toMatch(/^alert: تمّ\n\nخصمنا 1\.000 د\.أ/);
    await expect(page.getByText('11.400 د.أ', { exact: true }).first()).toBeVisible();
  });

  test('saying no redeems nothing', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    let asked = 0;
    page.on('dialog', (d: Dialog) => {
      asked += 1;
      void d.dismiss();
    });
    await page.goto(appUrl('/rewards'));
    await expect(page.getByText('12.400 د.أ', { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: ONE_JOD }).click();
    await expect.poll(() => asked).toBe(1);
    await expect(page.getByText('12.400 د.أ', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('11.400 د.أ', { exact: true })).toHaveCount(0);
  });
});
