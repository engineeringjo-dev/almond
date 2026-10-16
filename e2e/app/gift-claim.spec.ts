import { expect, test } from '@playwright/test';
import { formatJOD } from '@almond/shared/lib/format';
import { WALLET_LINE_REASON } from '@almond/shared/loyalty/history';
import ar from '../../almond-app/locales/ar.json';
import en from '../../almond-app/locales/en.json';
import { blockingViolations, horizontalOverflow } from '../fixtures';
import { appUrl, seedApp } from './helpers';

for (const lang of ['ar', 'en'] as const) {
  for (const entry of ['wallet', 'top-up'] as const) {
    test(`App gift claim (${lang}, ${entry}): direct code entry recovers from invalid input and credits a card only once`, async ({ page }) => {
      const copy = lang === 'ar' ? ar : en;
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await seedApp(page, { signedIn: true, lang });
      await page.goto(appUrl(entry === 'wallet' ? '/profile' : '/'));
      const entryLabel = entry === 'wallet' ? copy.profile.wallet : copy.home.topUp;
      const entryButton = page.getByRole('button').filter({ has: page.getByText(entryLabel, { exact: true }) });
      await expect(entryButton).toBeVisible({ timeout: 20_000 });
      await entryButton.click();
      await expect(page).toHaveURL(/\/profile\/wallet$/);
      const form = page.getByTestId('gift-claim-form');
      await expect(form.getByRole('heading', { name: copy.gift.receivedTitle, exact: true })).toBeVisible();
      const field = form.getByRole('textbox', { name: copy.gift.codeLabel, exact: true });
      const add = form.getByRole('button', { name: copy.gift.redeemCta, exact: true });
      await expect(field).toBeVisible();
      await expect(add).toBeDisabled();
      await expect(form.getByText(copy.gift.claimDemo, { exact: true })).toBeVisible();
      expect(await field.evaluate((node) => getComputedStyle(node).direction)).toBe('ltr');
      await expect(page.getByTestId('wallet-balance')).toHaveText(formatJOD(12.5, lang));

      await field.fill('NOT-A-GIFT');
      await add.click();
      await expect(form.getByRole('alert')).toHaveText(copy.gift.invalidCode);
      await expect(field).toHaveValue('NOT-A-GIFT');
      await expect(add).toBeEnabled();
      await expect(page.getByTestId('wallet-balance')).toHaveText(formatJOD(12.5, lang));

      // This is the card the existing mock issues for preview. It is not a
      // payment, SMS delivery or a fabricated response from this test.
      await field.fill('  alm-gift-2026  ');
      await expect(form.getByRole('alert')).toHaveCount(0);
      await add.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await expect(form.getByRole('status')).toHaveText(copy.gift.redeemedBody.replace('{{jod}}', formatJOD(5, lang)));
      await expect(field).toHaveValue('');
      await expect(add).toBeDisabled();
      await expect(page.getByTestId('wallet-balance')).toHaveText(formatJOD(17.5, lang));
      await expect(page.getByText(WALLET_LINE_REASON.gift[lang], { exact: true })).toHaveCount(1);

      await field.fill('ALM-GIFT-2026');
      await add.click();
      await expect(form.getByRole('alert')).toHaveText(copy.gift.alreadyUsed);
      await expect(form.getByRole('status')).toHaveCount(0);
      await expect(field).toHaveValue('ALM-GIFT-2026');
      await expect(page.getByTestId('wallet-balance')).toHaveText(formatJOD(17.5, lang));
      await expect(page.getByText(WALLET_LINE_REASON.gift[lang], { exact: true })).toHaveCount(1);
      const { blocking } = await blockingViolations(page);
      expect(blocking, 'the direct gift claim form must pass axe').toEqual([]);
      const size = await horizontalOverflow(page);
      expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth);
    });
  }
}

test('App gift claim: the existing catalogue sheet uses the same labelled form and claim result', async ({ page }) => {
  await seedApp(page, { signedIn: true, lang: 'ar' });
  await page.goto(appUrl('/profile/gift-cards'));
  await page.getByText(ar.gift.addHave, { exact: true }).click({ timeout: 20_000 });
  const sheet = page.getByRole('dialog', { name: ar.gift.redeemTitle, exact: true });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox', { name: ar.gift.codeLabel, exact: true }).fill('ALM-GIFT-2026');
  await sheet.getByRole('button', { name: ar.gift.redeemCta, exact: true }).click();
  const success = page.getByRole('dialog', { name: ar.gift.redeemedTitle, exact: true });
  await expect(success.getByRole('status')).toHaveText(ar.gift.redeemedBody.replace('{{jod}}', formatJOD(5, 'ar')));
  await success.getByRole('button', { name: ar.gift.done, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
