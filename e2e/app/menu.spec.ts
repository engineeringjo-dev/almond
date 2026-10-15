import { test, expect } from '@playwright/test';
import { appUrl, seedApp } from './helpers';

/**
 * THE MENU IS ONE LIST UNDER A PINNED SECTION BAR (Dunkin' panel, 2026-10-15).
 * The bar was a filter that left with the first swipe, over a «الكل» of 375
 * tiles with no heading. Precedent: Dunkin', Talabat, Careem; the website's
 * CategoryRail.
 */
test.describe('App menu: the pinned section bar', () => {
  test('a chip jumps to its section, lands just under the bar, and is marked current', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await page.goto(appUrl('/order'));
    const nav = page.getByRole('navigation', { name: 'التصنيفات' });
    await expect(nav).toBeVisible({ timeout: 20_000 });
    // The section in view on arrival is the first one.
    await expect(nav.getByRole('button').first()).toHaveAttribute('aria-current', 'true');

    // Far down the list: the jump is exact, not a guess that stops short.
    await nav.getByRole('button', { name: 'قطع كيك وحلويات' }).click();
    const heading = page.getByRole('heading', { name: 'قطع كيك وحلويات' });
    await expect(heading).toBeInViewport();
    await expect(nav.getByRole('button', { name: 'قطع كيك وحلويات' })).toHaveAttribute('aria-current', 'true');
    await expect.poll(async () => {
      const bar = await nav.boundingBox();
      const h = await heading.boundingBox();
      return bar && h ? Math.round(h.y - (bar.y + bar.height)) : -1;
    }).toBeGreaterThanOrEqual(0);
    const bar = (await nav.boundingBox())!;
    const h = (await heading.boundingBox())!;
    expect(h.y - (bar.y + bar.height), 'the heading sits right under the bar').toBeLessThan(60);
    await expect(nav.getByRole('button', { name: /مشروبات|قهوة/ }).first()).not.toHaveAttribute('aria-current', 'true');
  });

  test('the bar stays put while the list scrolls, and follows the section in view', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await page.goto(appUrl('/order'));
    const nav = page.getByRole('navigation', { name: 'التصنيفات' });
    await expect(nav).toBeVisible({ timeout: 20_000 });
    const first = await nav.getByRole('button').first().innerText();
    await page.mouse.move(195, 600);
    for (let i = 0; i < 12; i += 1) await page.mouse.wheel(0, 400);
    // Pinned: once stuck, a further scroll does not move it.
    await expect.poll(async () => Math.round((await nav.boundingBox())?.y ?? -1)).toBeGreaterThan(0);
    const stuck = (await nav.boundingBox())!.y;
    await page.mouse.wheel(0, 800);
    await expect.poll(async () => (await nav.locator('[aria-current="true"]').innerText()) !== first).toBe(true);
    expect(Math.abs((await nav.boundingBox())!.y - stuck)).toBeLessThan(2);
    await expect(nav).toBeInViewport();
  });

  test('a search shows the matches alone, without the bar', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await page.goto(appUrl('/order'));
    const search = page.getByRole('textbox', { name: 'ابحث عن مشروب أو طبق' });
    await expect(search).toBeVisible({ timeout: 20_000 });
    // «كيكه» finds «كيكة»: the shared search folds the way people type Arabic.
    await search.fill('كيكه');
    await expect(page.getByRole('navigation', { name: 'التصنيفات' })).toHaveCount(0);
    await expect(page.getByText(/كيكة/).first()).toBeVisible();
    await search.fill('');
    await expect(page.getByRole('navigation', { name: 'التصنيفات' })).toBeVisible();
  });
});
