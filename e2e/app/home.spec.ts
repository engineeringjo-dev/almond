import { test, expect } from '@playwright/test';
import { appUrl, seedApp } from './helpers';

const cases = [
  { lang: 'ar', width: 320 },
  { lang: 'ar', width: 390 },
  { lang: 'en', width: 390 },
  { lang: 'ar', width: 1280 },
] as const;

for (const { lang, width } of cases) {
  test(`Home stays usable while location is pending: ${lang} / ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await seedApp(page, { lang, signedIn: true });
    // An unanswered permission prompt / GPS lookup must not hide the app.
    await page.addInitScript(() => {
      Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
        configurable: true,
        value: () => {},
      });
    });
    await page.goto(appUrl('/'));
    const order = page.getByRole('button', { name: lang === 'ar' ? 'اطلب الآن' : 'Order now', exact: true });
    await expect(order).toBeVisible({ timeout: 20_000 });

    const primary = await page.getByTestId('home-primary').boundingBox();
    expect(primary).not.toBeNull();
    if (!primary) throw new Error('Home did not render');
    expect(primary.width).toBeLessThanOrEqual(680);
    expect(primary.x).toBeGreaterThanOrEqual(0);
    expect(primary.x + primary.width).toBeLessThanOrEqual(width);
    if (width > 680) expect(Math.abs(primary.x + primary.width / 2 - width / 2)).toBeLessThanOrEqual(1);

    for (const name of lang === 'ar' ? ['الإشعارات', 'السلة'] : ['Notifications', 'Cart']) {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toBeVisible();
      const rect = await button.boundingBox();
      expect(rect?.width).toBeGreaterThanOrEqual(44);
      expect(rect?.height).toBeGreaterThanOrEqual(44);
    }

    await testInfo.attach(`home-${lang}-${width}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await order.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}
