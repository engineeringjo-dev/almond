import { test, expect } from '@playwright/test';
import ar from '../../almond-app/locales/ar.json';
import en from '../../almond-app/locales/en.json';
import { jodFromPoints } from '@almond/shared/loyalty/earn';
import { formatJOD, formatNumber } from '@almond/shared/lib/format';
import { appUrl, seedApp } from './helpers';
import { blockingViolations, horizontalOverflow } from '../fixtures';

/** Actual shared reservation → explicit 120s presentation → cancel/return.
 * Preview credentials identify themselves as demo and never authorize a till. */
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key]));
const amountLabel = (lang: 'ar' | 'en', points: number) => fill((lang === 'ar' ? ar : en).rewards.redeemA11y,
  { points: formatNumber(points, lang), jod: formatJOD(jodFromPoints(points), lang) });
const worthLabel = (lang: 'ar' | 'en', jod: number) => fill((lang === 'ar' ? ar : en).home.pointsWorth,
  { jod: formatJOD(jod, lang) });

test.describe('App: redeeming on the web', () => {
  test('reserves100 points and hands focus to the exact redemption barcode', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/rewards'));
    await expect(page.getByText(worthLabel('ar', 12.4), { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: amountLabel('ar', 100), exact: true }).click();
    const sheet = page.getByRole('dialog', { name: ar.rewards.confirmTitle, exact: true });
    await expect(sheet).toContainText(fill(ar.rewards.confirmBody, { points: 100, jod: formatJOD(1, 'ar') }));
    await expect(sheet).toContainText(ar.loyalty.redemptionDemo);
    await sheet.getByRole('button', { name: ar.rewards.redeemCta, exact: true }).click();
    const done = page.getByRole('dialog', { name: ar.loyalty.redemptionReservedTitle, exact: true });
    await expect(done).toContainText(fill(ar.loyalty.redemptionReserved, { points: 100, jod: formatJOD(1, 'ar') }));
    await expect(page.getByText(worthLabel('ar', 11.4), { exact: true })).toBeVisible();
    await done.getByRole('button', { name: ar.loyalty.redemptionShowBarcode, exact: true }).click();
    await expect(page).toHaveURL(/\/vouchers\?voucherId=[^&]+$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const issued = page.getByTestId('issued-voucher');
    await expect(issued).toBeFocused();
    await expect(issued.getByText(fill(ar.rewards.creditVoucher, { jod: formatJOD(1, 'ar') }), { exact: true })).toBeVisible();
    const barcode = issued.getByTestId('redemption-barcode');
    await expect(barcode.getByLabel(ar.loyalty.redemptionBarcodeLabel).locator('svg')).toHaveCount(1);
    await expect(barcode).toContainText(ar.loyalty.redemptionDemo);
    await expect(issued.getByRole('textbox')).toHaveCount(0);
  });

  test('cancelling the confirmation reserves nothing', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/rewards'));
    await expect(page.getByText(worthLabel('ar', 12.4), { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: amountLabel('ar', 100), exact: true }).click();
    const sheet = page.getByRole('dialog', { name: ar.rewards.confirmTitle, exact: true });
    await sheet.getByRole('button', { name: ar.common.cancel, exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText(worthLabel('ar', 12.4), { exact: true })).toBeVisible();
    await expect(page.getByText(worthLabel('ar', 11.4), { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('rewards-tile').nth(1)).toContainText(ar.loyalty.noVouchers);
  });

  test('the whole balance is one tap away, named in words', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/rewards'));
    const all = page.getByRole('button', { name: fill(ar.rewards.redeemAllA11y, { points: formatNumber(1240, 'ar'), jod: formatJOD(12.4, 'ar') }), exact: true });
    await expect(all).toBeVisible({ timeout: 20_000 });
    await expect(all).toHaveText(ar.rewards.wholeBalance);
    await all.click();
    await expect(page.getByRole('dialog', { name: ar.rewards.confirmTitle, exact: true }))
      .toContainText(fill(ar.rewards.confirmBody, { points: formatNumber(1240, 'ar'), jod: formatJOD(12.4, 'ar') }));
  });

  test('English handoff retains focus after dismissal and handles a stale link', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-16T12:00:00+03:00') });
    await page.clock.resume();
    await seedApp(page, { signedIn: true, lang: 'en' });
    await page.goto(appUrl('/rewards'));
    await page.getByRole('button', { name: amountLabel('en', 100), exact: true }).click({ timeout: 20_000 });
    await page.getByRole('dialog').getByRole('button', { name: en.common.cancel, exact: true }).click();
    await page.goto(appUrl('/rewards'));
    await page.getByRole('button', { name: amountLabel('en', 200), exact: true }).click({ timeout: 20_000 });
    const sheet = page.getByRole('dialog', { name: en.rewards.confirmTitle, exact: true });
    await expect(sheet).toContainText(en.loyalty.redemptionDemo);
    await sheet.getByRole('button', { name: en.rewards.redeemCta, exact: true }).click();
    const done = page.getByRole('dialog', { name: en.loyalty.redemptionReservedTitle, exact: true });
    await done.getByRole('button', { name: en.loyalty.redemptionShowBarcode, exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const issued = page.getByTestId('issued-voucher');
    await expect(issued).toBeFocused();
    await expect(issued).toContainText(fill(en.rewards.creditVoucher, { jod: formatJOD(2, 'en') }));
    await expect(issued.getByTestId('redemption-barcode')).toContainText(en.loyalty.redemptionDemo);
    await page.goto(appUrl('/vouchers?voucherId=missing'));
    await expect(page.getByTestId('issued-voucher')).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText(en.loyalty.voucherUnavailable);
  });

  for (const lang of ['ar', 'en'] as const) {
    test(`App redemption (${lang}): expires after120s, explicit refresh keeps the reserve, cancellation returns points`, async ({ page }) => {
      const copy = lang === 'ar' ? ar : en;
      await page.setViewportSize({ width: 320, height: 844 });
      await page.emulateMedia({ colorScheme: lang === 'ar' ? 'dark' : 'light', reducedMotion: 'reduce' });
      await page.clock.install({ time: new Date('2026-10-20T12:00:00+03:00') });
      await page.clock.resume();
      await seedApp(page, { signedIn: true, lang });
      await page.goto(appUrl('/rewards'));
      await page.getByRole('button', { name: amountLabel(lang, 100), exact: true }).click({ timeout: 20_000 });
      await page.getByRole('dialog').getByRole('button', { name: copy.rewards.redeemCta, exact: true }).click();
      await page.getByRole('dialog', { name: copy.loyalty.redemptionReservedTitle, exact: true })
        .getByRole('button', { name: copy.loyalty.redemptionShowBarcode, exact: true }).click();
      const barcode = page.getByTestId('issued-voucher').getByTestId('redemption-barcode');
      const image = barcode.getByLabel(copy.loyalty.redemptionBarcodeLabel).locator('svg');
      await expect(image).toHaveCount(1);
      await expect(barcode).toContainText(copy.loyalty.redemptionDemo);
      // The SVG's stroke is one QR module. Its clear viewBox margin must
      // remain at least four modules, including on a dark card.
      const quietModules = await image.evaluate((svg) => {
        const viewBox = svg.getAttribute('viewBox')!.split(/[ ,]+/).map(Number);
        const module = Number(svg.querySelector('path[stroke-width]')?.getAttribute('stroke-width'));
        return -viewBox[0] / module;
      });
      expect(quietModules, 'QR must keep the DENSO four-module quiet zone').toBeGreaterThanOrEqual(4);
      const original = page.url();
      await page.clock.fastForward(121_000);
      await expect(image).toHaveCount(0);
      await expect(barcode).toContainText(copy.loyalty.redemptionExpired);
      const refresh = barcode.getByRole('button', { name: copy.loyalty.redemptionRefresh, exact: true });
      await refresh.focus();
      await expect(refresh).toBeFocused();
      await refresh.press('Enter');
      await expect(image).toHaveCount(1);
      expect(page.url()).toBe(original);
      const dimensions = await horizontalOverflow(page);
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      const { blocking } = await blockingViolations(page);
      expect(blocking, 'the points barcode, expiry and actions must pass axe').toEqual([]);
      await barcode.getByRole('button', { name: copy.loyalty.redemptionCancel, exact: true }).click();
      await expect(image).toHaveCount(0);
      await expect(barcode).toContainText(copy.loyalty.redemptionEnded);
      await page.goBack();
      await expect(page.getByText(worthLabel(lang, 12.4), { exact: true })).toBeVisible();
    });
  }
});
