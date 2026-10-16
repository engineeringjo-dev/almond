import { test, expect } from '@playwright/test';
import ar from '../../almond-app/locales/ar.json';
import en from '../../almond-app/locales/en.json';
import { formatJOD } from '@almond/shared/lib/format';
import { blockingViolations, horizontalOverflow } from '../fixtures';
import { appUrl, seedApp } from './helpers';

const words = { ar, en };
const fill = (template: string, params: Record<string, string | number>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key]));

for (const lang of ['ar', 'en'] as const) {
  test(`App tiers (${lang}): exact money OR separate paid days, kept tier, keyboard next-order action at 320px`, async ({ page }) => {
    const copy = words[lang];
    await page.setViewportSize({ width: 320, height: 844 });
    await page.emulateMedia({ colorScheme: lang === 'ar' ? 'dark' : 'light' });
    await page.clock.install({ time: new Date('2026-10-20T12:00:00+03:00') });
    await page.clock.resume();
    await seedApp(page, { signedIn: true, lang });
    await page.goto(appUrl('/rewards'));
    const tierDoor = page.getByTestId('rewards-tile').nth(2);
    await expect(tierDoor).toBeVisible({ timeout: 20_000 });
    await tierDoor.click();
    await expect(page).toHaveURL(/\/tiers$/);

    // The real mock standing is 12 JOD over two distinct paid days: 8 JOD OR two
    // more days. No browser-only progress override or average-basket estimate.
    await expect(page.getByTestId('tier-remaining')).toHaveText(fill(copy.loyalty.toPlus, { jod: formatJOD(8, lang) }));
    const visits = lang === 'ar' ? ar.loyalty.visitDaysAlternative_2 : en.loyalty.visitDaysAlternative_plural;
    await expect(page.getByTestId('tier-visits-alternative')).toHaveText(fill(visits, { visits: 2, tier: '4%' }));
    await expect(page.getByTestId('tier-window')).toHaveText(fill(copy.loyalty.windowNote, { days: 90 }));
    await expect(page.getByTestId('tier-kept')).toHaveText(copy.loyalty.tierKept);
    await expect(page.getByTestId('tier-remaining')).not.toContainText(/[٠-٩۰-۹]/);

    const nextVisit = page.getByRole('button', { name: copy.loyalty.nextVisitCta, exact: true });
    await nextVisit.focus();
    await expect(nextVisit).toBeFocused();
    await expect(nextVisit).toBeInViewport();
    const dimensions = await horizontalOverflow(page);
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    const { blocking } = await blockingViolations(page);
    expect(blocking, 'the expanded tier details must pass axe').toEqual([]);
    await nextVisit.press('Enter');
    await expect(page).toHaveURL(/\/order$/);
    expect(await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('almond.cart') ?? '{}').state;
      return state?.items ?? [];
    })).toEqual([]);
  });

  test(`App points (${lang}): money-only worth on Rewards and history; real redemption still updates it`, async ({ page }) => {
    const copy = words[lang];
    await page.clock.install({ time: new Date('2026-10-20T12:00:00+03:00') });
    await page.clock.resume();
    await seedApp(page, { signedIn: true, lang });
    await page.goto(appUrl('/rewards'));
    const worth = (jod: number) => page.getByText(fill(copy.home.pointsWorth, { jod: formatJOD(jod, lang) }), { exact: true }).filter({ visible: true });
    await expect(worth(12.4)).toBeVisible({ timeout: 20_000 });
    const amount = page.getByRole('button', { name: fill(copy.rewards.redeemA11y, { points: 100, jod: formatJOD(1, lang) }), exact: true });
    await amount.click();
    const confirm = page.getByRole('dialog', { name: copy.rewards.confirmTitle, exact: true });
    await expect(confirm).toContainText(fill(copy.rewards.confirmBody, { points: 100, jod: formatJOD(1, lang) }));
    await confirm.getByRole('button', { name: copy.rewards.redeemCta, exact: true }).click();
    const issued = page.getByRole('dialog', { name: copy.loyalty.redemptionReservedTitle, exact: true });
    await expect(issued).toBeVisible();
    await issued.getByRole('button', { name: copy.common.ok, exact: true }).click();
    await expect(issued).toBeHidden();
    await expect(worth(11.4)).toBeVisible();
    await page.getByTestId('rewards-tile').first().click();
    await expect(page).toHaveURL(/\/loyalty$/);
    await expect(worth(11.4)).toBeVisible();
  });
}
