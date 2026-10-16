import { expect, test, type Locator } from '@playwright/test';
import { config } from '@almond/shared/config';
import ar from '../../almond-app/locales/ar.json';
import en from '../../almond-app/locales/en.json';
import { blockingViolations } from '../fixtures';
import { appUrl, seedApp } from './helpers';

/** RN Web paints Image on a visible background plane; its inner img has
 * opacity zero. Verify both the downloaded artwork and the plane the member
 * actually sees, rather than treating that transparent img as the artwork. */
async function expectProfileArtwork(celebration: Locator): Promise<void> {
  const image = celebration.locator('img[src*="profile-bonus-50"]');
  await expect(image).toHaveCount(1);
  await expect.poll(() => image.evaluate((node) => {
    const picture = node as HTMLImageElement;
    return picture.complete && picture.naturalWidth > 0 && picture.naturalHeight > 0;
  }), { message: 'The exported 50-point artwork must finish loading' }).toBe(true);
  const source = new URL(await image.getAttribute('src') ?? '', appUrl('/'));
  expect(source.origin).toBe(new URL(appUrl('/')).origin);
  expect(source.pathname).toContain('profile-bonus-50');
  const frame = image.locator('..');
  await expect(frame).toBeVisible();
  await expect.poll(() => frame.evaluate((node) => {
    const plane = Array.from(node.querySelectorAll<HTMLElement>('*'))
      .find((element) => getComputedStyle(element).backgroundImage.includes('profile-bonus-50'));
    if (!plane) return false;
    const style = getComputedStyle(plane);
    const bounds = plane.getBoundingClientRect();
    return style.backgroundSize === 'contain' && style.opacity !== '0'
      && style.display !== 'none' && style.visibility !== 'hidden'
      && bounds.width > 100 && bounds.height > 100;
  }), { message: 'The loaded artwork must be visibly drawn, whole, inside the celebration' }).toBe(true);
  expect(await image.evaluate((node) => node.closest('[aria-hidden="true"]') !== null)).toBe(true);
}

for (const lang of ['ar', 'en'] as const) {
  test(`App profile reward (${lang}): the real first 50-point grant shows artwork once, then an edited save pays zero`, async ({ page }, testInfo) => {
    const copy = lang === 'ar' ? ar : en;
    const memberId = `e2e-profile-reward-${lang}`;
    const firstName = lang === 'ar' ? 'اختبار مكافأة البيانات' : 'Profile Reward Test';
    const updatedName = lang === 'ar' ? 'اختبار البيانات المعدّل' : 'Profile Reward Updated';
    expect(config.PROFILE_COMPLETION_BONUS).toBe(50);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedApp(page, { signedIn: true, lang });
    await page.goto(appUrl('/profile'));
    const detailsEntry = page.getByRole('button').filter({ has: page.getByText(copy.profile.details, { exact: true }) });
    await expect(detailsEntry).toBeVisible({ timeout: 20_000 });

    // Seed only a fresh signed-in identity and an incomplete client profile.
    // ensureUser creates the mock server record with profileBonusAt: null;
    // the real updateProfile call below decides and grants the reward.
    await page.evaluate((id) => {
      const user = JSON.parse(localStorage.getItem('almond.user') ?? '{}');
      localStorage.setItem('almond.user', JSON.stringify({ ...user, id, name: '', birthday: null, gender: null }));
    }, memberId);
    await page.reload();
    await expect(detailsEntry).toBeVisible();
    await detailsEntry.click();
    await expect(page).toHaveURL(/\/profile\/details$/);

    const name = page.getByRole('textbox', { name: copy.details.nameLabel, exact: true });
    const birthday = page.getByRole('textbox', { name: copy.details.birthdayLabel, exact: true });
    const female = page.getByRole('radio', { name: copy.details.genderFemale, exact: true });
    await expect(name).toHaveValue('');
    await expect(birthday).toHaveValue('');
    await name.fill(firstName);
    await birthday.fill('15/11/1990');
    await female.click();
    await expect(female).toHaveAttribute('aria-checked', 'true');

    const alerts: string[] = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });
    const celebration = page.getByRole('dialog', { name: copy.details.bonusCelebrationTitle, exact: true });
    await page.getByRole('button', { name: copy.details.saveAndEarn.replace('{{points}}', '50'), exact: true }).click();
    await expect(celebration).toBeVisible();
    await expect(page).toHaveURL(/\/profile\/details$/);
    // This is native DOM text beside the decorative image, not text baked
    // into an image and not an amount inferred from a balance difference.
    const body = copy.details.bonusCelebrationBody.replace('{{points}}', '50');
    await expect(celebration.getByText(body, { exact: true })).toBeVisible();
    await expectProfileArtwork(celebration);
    expect(alerts).toEqual([]);
    const { blocking } = await blockingViolations(page);
    expect(blocking, 'the actual profile-reward dialog must pass axe').toEqual([]);
    const closeReward = celebration.getByRole('button', { name: copy.details.bonusCelebrationClose, exact: true });
    const closeBounds = await closeReward.boundingBox();
    expect(closeBounds, 'the completion action must be fully inside the viewport').not.toBeNull();
    expect(closeBounds!.y).toBeGreaterThanOrEqual(0);
    expect(closeBounds!.y + closeBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
    const screenshot = testInfo.outputPath(`profile-reward-${lang}.png`);
    await page.screenshot({ path: screenshot, animations: 'disabled' });
    await testInfo.attach(`profile-reward-${lang}`, { path: screenshot, contentType: 'image/png' });

    await closeReward.click();
    await expect(celebration).toHaveCount(0);
    await expect(page).toHaveURL(/\/profile$/);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('almond.user') ?? '{}'))).toMatchObject({
      id: memberId, name: firstName, birthday: '1990-11-15', gender: 'female', isGuest: false,
    });

    // Use real client navigation: a full page reload creates a fresh mock
    // server Map and would not test its persisted once-only profile stamp.
    await detailsEntry.click();
    await expect(name).toHaveValue(firstName);
    await expect(birthday).toHaveValue('15/11/1990');
    await expect(female).toHaveAttribute('aria-checked', 'true');
    await expect(celebration).toHaveCount(0);
    await name.fill(updatedName);
    const [saved] = await Promise.all([
      page.waitForEvent('dialog'),
      page.getByRole('button', { name: copy.common.save, exact: true }).click(),
    ]);
    expect(saved.type()).toBe('alert');
    expect(saved.message()).toBe(`${copy.details.savedTitle}\n\n${copy.details.savedBody}`);
    await expect(page).toHaveURL(/\/profile$/);
    await expect(celebration).toHaveCount(0);
    await expect(page.locator('img[src*="profile-bonus-50"]')).toHaveCount(0);
    expect(alerts).toEqual([`${copy.details.savedTitle}\n\n${copy.details.savedBody}`]);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('almond.user') ?? '{}'))).toMatchObject({
      id: memberId, name: updatedName, birthday: '1990-11-15', gender: 'female', isGuest: false,
    });

    await detailsEntry.click();
    await expect(name).toHaveValue(updatedName);
    await expect(birthday).toHaveValue('15/11/1990');
    await expect(female).toHaveAttribute('aria-checked', 'true');
    await expect(celebration).toHaveCount(0);
    await page.getByRole('button', { name: copy.common.back, exact: true }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });
}
