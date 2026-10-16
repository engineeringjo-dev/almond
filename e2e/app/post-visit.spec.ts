import { test, expect } from '@playwright/test';
import ar from '../../almond-app/locales/ar.json';
import en from '../../almond-app/locales/en.json';
import { blockingViolations } from '../fixtures';
import { appUrl, seedApp } from './helpers';

/**
 * «شكراً لزيارتك» — after a purchase, the next time Home opens it says how many
 * points that visit added and asks for a rating of its branch, once (owner,
 * 2026-10-15, after Al Ameed). The decision is unit-tested
 * (almond-app/test/launchSheet.test.ts V1); this proves the screens do it.
 */
test.describe('App: the thank-you after a visit', () => {
  test.use({ viewport: { width: 320, height: 740 } });

  for (const lang of ['ar', 'en'] as const) {
    test(`${lang}: after an order, numbered stars keep their values and the visit is not asked about again`, async ({ page }) => {
      const copy = lang === 'ar' ? ar : en;
      await page.emulateMedia({ reducedMotion: 'reduce' });
      // The app asks about an app order once it has been collected (30 minutes
      // on; config.VISIT_RATING_ORDER_DELAY_MINUTES), so the test owns the clock.
      await page.clock.install();
      await seedApp(page, { signedIn: true, lang });
      await page.goto(appUrl('/order'));
      await page.getByRole('textbox', { name: copy.menu.searchPlaceholder }).fill(lang === 'ar' ? 'لاتيه مثلج' : 'Iced Latte');
      await page.getByText(lang === 'ar' ? 'لاتيه مثلج' : 'Iced Latte', { exact: true }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: new RegExp(copy.menu.addToCart) }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
      await page.goto(appUrl('/cart'));
      await page.getByRole('button', { name: new RegExp(copy.cart.reviewCta) }).click();
      await page.getByRole('dialog').getByRole('button', { name: new RegExp(copy.cart.placeOrder) }).click();
      await expect(page).toHaveURL(/\/order\/confirm/, { timeout: 20_000 });

      // Half an hour later, client-side to Home: the mock's member lives in
      // memory, as the real one lives on the server.
      await page.clock.fastForward('31:00');
      await page.getByText(copy.confirm.backHome, { exact: true }).click();
      const sheet = page.getByRole('dialog', { name: copy.visit.thanksTitle });
      await expect(sheet).toBeVisible({ timeout: 20_000 });
      await expect(sheet.getByText(new RegExp(copy.visit.pointsAdded.replace('{{points}}', '\\d+')))).toBeVisible();
      await expect(sheet.getByText(new RegExp(copy.track.rateTitle.replace('{{branch}}', '.+').replace('?', '\\?')))).toBeVisible();

      const stars = sheet.getByRole('radiogroup', { name: copy.visit.starsGroup });
      await expect(stars.getByRole('radio')).toHaveCount(5);
      const send = sheet.getByRole('button', { name: copy.track.rateSubmit });
      await expect(send).toBeDisabled();
      const positions: number[] = [];
      for (const value of [1, 2, 3, 4, 5]) {
        const label = copy.visit.starsLabel.replace('{{n}}', String(value));
        const radio = stars.getByRole('radio', { name: label, exact: true });
        const number = radio.getByText(String(value), { exact: true });
        await expect(radio).toHaveAccessibleName(label);
        await expect(number).toBeVisible();
        await expect(number).toHaveAttribute('aria-hidden', 'true');
        const controlBox = await radio.boundingBox();
        const numberBox = await number.boundingBox();
        const starBox = await radio.locator('svg').boundingBox();
        expect(controlBox).not.toBeNull();
        expect(numberBox).not.toBeNull();
        expect(starBox).not.toBeNull();
        expect(controlBox!.width).toBeGreaterThanOrEqual(44);
        expect(controlBox!.height).toBeGreaterThanOrEqual(44);
        expect(controlBox!.x).toBeGreaterThanOrEqual(0);
        expect(controlBox!.x + controlBox!.width).toBeLessThanOrEqual(320);
        expect(numberBox!.y + numberBox!.height).toBeLessThanOrEqual(starBox!.y);
        expect(Math.abs(numberBox!.x + numberBox!.width / 2 - (starBox!.x + starBox!.width / 2))).toBeLessThanOrEqual(1);
        positions.push(controlBox!.x);
        // Tapping the numeral and tapping the star are the same answer.
        await number.click();
        await expect(radio).toHaveAttribute('aria-checked', 'true');
        await expect(stars.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
      }
      for (let index = 1; index < positions.length; index++) {
        expect(lang === 'ar' ? positions[index] < positions[index - 1] : positions[index] > positions[index - 1]).toBe(true);
      }
      const { blocking } = await blockingViolations(page);
      expect(blocking, 'the thank-you must pass axe').toEqual([]);
      await page.screenshot({ path: `test-results/post-visit-${lang}.png` });

      const four = stars.getByRole('radio', { name: copy.visit.starsLabel.replace('{{n}}', '4'), exact: true });
      await four.focus();
      await expect(four).toBeFocused();
      await four.press('Enter');
      await expect(four).toHaveAttribute('aria-checked', 'true');
      await sheet.getByRole('textbox', { name: copy.track.rateComment }).fill(lang === 'ar' ? 'قهوة ممتازة' : 'Excellent coffee');
      await send.click();
      await expect(page.getByText(copy.track.rateThanks)).toBeVisible();
      await page.getByRole('button', { name: copy.common.ok }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      // Not asked again about the same visit.
      await page.getByRole('tab', { name: copy.tabs.rewards }).first().click();
      await page.getByRole('tab', { name: copy.tabs.home }).first().click();
      await page.waitForTimeout(1_000);
      await expect(page.getByRole('dialog', { name: copy.visit.thanksTitle })).toHaveCount(0);
    });
  }
});
