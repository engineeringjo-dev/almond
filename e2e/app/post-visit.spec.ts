import { test, expect } from '@playwright/test';
import { blockingViolations } from '../fixtures';
import { addLatte, appUrl, seedApp } from './helpers';

/**
 * «شكراً لزيارتك» — after a purchase, the next time Home opens it says how many
 * points that visit added and asks for a rating of its branch, once (owner,
 * 2026-10-15, after Al Ameed). The decision is unit-tested
 * (almond-app/test/launchSheet.test.ts V1); this proves the screens do it.
 */
const THANKS = 'شكراً لزيارتك!';

test.describe('App: the thank-you after a visit', () => {
  test('after an order: points added, a 1-5 rating, thanks — and it is not asked again', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // The app asks about an app order once it has been collected (30 minutes
    // on; config.VISIT_RATING_ORDER_DELAY_MINUTES), so the test owns the clock.
    await page.clock.install();
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await addLatte(page);
    await page.goto(appUrl('/cart'));
    await page.getByRole('button', { name: /مراجعة الطلب/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /تأكيد الطلب/ }).click();
    await expect(page).toHaveURL(/\/order\/confirm/, { timeout: 20_000 });

    // Half an hour later, client-side to Home: the mock's member lives in
    // memory, as the real one lives on the server.
    await page.clock.fastForward('31:00');
    await page.getByText('العودة للرئيسية', { exact: true }).click();
    const sheet = page.getByRole('dialog', { name: THANKS });
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(sheet.getByText(/أُضيفت نقاط هذه الزيارة إلى رصيدك: \d+/)).toBeVisible();
    await expect(sheet.getByText(/كيف كانت تجربتك في فرع/)).toBeVisible();

    const stars = sheet.getByRole('radiogroup', { name: 'تقييمك' });
    await expect(stars.getByRole('radio')).toHaveCount(5);
    const { blocking } = await blockingViolations(page);
    expect(blocking, 'the thank-you must pass axe').toEqual([]);
    await page.screenshot({ path: 'test-results/post-visit-ar.png' });

    const send = sheet.getByRole('button', { name: 'إرسال التقييم' });
    await expect(send).toBeDisabled();
    await stars.getByRole('radio', { name: '4 من 5' }).click();
    await expect(stars.getByRole('radio', { name: '4 من 5' })).toHaveAttribute('aria-checked', 'true');
    await sheet.getByRole('textbox', { name: 'أضف تعليقاً (اختياري)' }).fill('قهوة ممتازة');
    await send.click();
    await expect(page.getByText('شكراً لتقييمك!')).toBeVisible();
    await page.getByRole('button', { name: 'حسناً' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Not asked again about the same visit.
    await page.getByRole('tab', { name: 'المكافآت' }).first().click();
    await page.getByRole('tab', { name: 'الرئيسية' }).first().click();
    await page.waitForTimeout(1_000);
    await expect(page.getByRole('dialog', { name: THANKS })).toHaveCount(0);
  });
});
