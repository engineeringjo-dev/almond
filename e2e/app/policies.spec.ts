import { expect, test } from '@playwright/test';
import { config } from '@almond/shared/config';
import ar from '../../almond-app/locales/ar.json';
import en from '../../almond-app/locales/en.json';
import { appUrl, seedApp } from './helpers';

for (const lang of ['ar', 'en'] as const) {
  test(`App policies (${lang}): readable without signing in and reachable from More`, async ({ page }) => {
    const copy = lang === 'ar' ? ar : en;
    await seedApp(page, { lang, signedIn: false });
    await page.goto(appUrl('/profile/policies'));
    const policy = page.getByRole('region', { name: copy.policies.title, exact: true });
    await expect(policy).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/profile\/policies$/);
    for (const title of [copy.policies.pointsTitle, copy.policies.referralTitle, copy.policies.refundTitle]) {
      await expect(policy.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    await expect(policy.getByText(copy.policies.referralReward.replace('{{points}}', String(config.REFERRAL_REWARD_POINTS)), { exact: true })).toBeVisible();
    await expect(policy.getByText(copy.policies.referralCap.replace('{{points}}', String(config.REFERRAL_LIFETIME_CAP_POINTS)), { exact: true })).toBeVisible();
    await expect(policy.getByText(copy.policies.unusedReturn, { exact: true })).toBeVisible();
    await expect(policy.getByText(copy.policies.refundEarned, { exact: true })).toBeVisible();
    await expect(policy.getByText(copy.policies.refundMoney, { exact: true })).toBeVisible();
    await expect(policy.getByText(copy.policies.refundGifts, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('almond.user'))).toBeNull();

    // The existing profile Stack supplies a real way back even for a cold
    // public link. The policy row stays available to guests in More/Profile.
    await page.getByRole('button', { name: copy.common.back, exact: true }).click();
    await expect(page).toHaveURL(/\/profile$/);
    const entry = page.getByRole('button', { name: copy.policies.title, exact: true });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page).toHaveURL(/\/profile\/policies$/);
    await expect(policy).toBeVisible();
  });
}
