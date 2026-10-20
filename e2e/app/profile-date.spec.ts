import { test, expect, type Page } from '@playwright/test';
import ar from '../../almond-app/locales/ar.json';
import en from '../../almond-app/locales/en.json';
import { appUrl, seedApp } from './helpers';

const words = { ar, en };

async function openDetails(page: Page, lang: 'ar' | 'en') {
  await seedApp(page, { signedIn: true, lang });
  await page.goto(appUrl('/profile'));
  const entry = page.getByRole('button').filter({ has: page.getByText(words[lang].profile.details, { exact: true }) });
  await expect(entry).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('almond.user') ?? '{}');
    localStorage.setItem('almond.user', JSON.stringify({ ...user, birthday: '1990-11-15', gender: 'female' }));
  });
  await page.reload();
  await entry.click();
  await expect(page).toHaveURL(/\/profile\/details$/);
  const field = page.getByRole('textbox', { name: words[lang].details.birthdayLabel, exact: true });
  await expect(field).toHaveValue('15/11/1990');
  return field;
}

async function saveSuccess(page: Page, lang: 'ar' | 'en'): Promise<void> {
  const copy = words[lang];
  const celebration = page.getByRole('dialog', { name: lang === 'ar' ? 'مكافأة إكمال بياناتك' : 'Your profile reward', exact: true });
  const message = new Promise<string>((resolve) => page.once('dialog', async (dialog) => {
    resolve(dialog.message());
    await dialog.dismiss();
  }));
  const reward = celebration.waitFor({ state: 'visible' }).then(() => null);
  await page.getByRole('button', { name: copy.common.save, exact: true }).click();
  const result = await Promise.race([message, reward]);
  if (result === null) {
    // Feedback follows the actual server reply, even when local auth data was
    // already complete but this mock server has not paid the bonus before.
    await celebration.getByRole('button', { name: copy.details.bonusCelebrationClose, exact: true }).click();
  } else {
    expect(result).toContain(copy.details.savedTitle);
  }
  await expect(page).toHaveURL(/\/profile$/);
}

async function saveAlert(page: Page, saveLabel: string): Promise<string> {
  const message = new Promise<string>((resolve) => page.once('dialog', async (dialog) => {
    resolve(dialog.message());
    await dialog.dismiss();
  }));
  await page.getByRole('button', { name: saveLabel, exact: true }).click();
  return message;
}

for (const lang of ['ar', 'en'] as const) {
  test(`App profile (${lang}): birthday reads DD/MM/YYYY, keeps the calendar, and saves the ISO day`, async ({ page }) => {
    const copy = words[lang];
    const field = await openDetails(page, lang);
    // Native birthdate tokens are invalid HTML, and browser autofill may use
    // a month-first order instead of this field's required DD/MM/YYYY draft.
    await expect(field).toHaveAttribute('autocomplete', 'off');
    expect(await field.evaluate((node) => getComputedStyle(node).direction)).toBe('ltr');
    await expect(page.getByText(copy.details.birthdayHint, { exact: true })).toContainText('DD/MM/YYYY');
    const calendar = page.locator('input[type="date"]');
    await expect(calendar).toHaveValue('1990-11-15');
    // Browser chrome is outside the document. Observe the real input's picker
    // entry point, then deliver the same ISO change event a selection emits.
    await calendar.evaluate((node) => {
      (node as HTMLInputElement).showPicker = () => node.setAttribute('data-picker-opened', 'true');
    });
    await page.getByRole('button', { name: copy.details.birthdayCalendar, exact: true }).click();
    await expect(calendar).toHaveAttribute('data-picker-opened', 'true');
    await calendar.fill('2000-02-29');
    await expect(field).toHaveValue('29/02/2000');

    await field.fill('07/04/1991');
    await expect(calendar).toHaveValue('1991-04-07');
    await saveSuccess(page, lang);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('almond.user') ?? '{}').birthday)).toBe('1991-04-07');
  });
}

test('App profile: an impossible or incomplete birthday cannot save the previously valid value', async ({ page }) => {
  const field = await openDetails(page, 'ar');
  for (const invalid of ['29/02/1900', '31/02/1990', '15/11/']) {
    await field.fill(invalid);
    await expect(field).toHaveValue(invalid);
    await expect(page.locator('input[type="date"]')).toHaveValue('');
    expect(await saveAlert(page, ar.common.save)).toContain(ar.details.birthdayInvalidTitle);
    await expect(page).toHaveURL(/\/profile\/details$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('almond.user') ?? '{}').birthday)).toBe('1990-11-15');
  }
});

for (const failure of ['unsupported', 'blocked'] as const) {
  const lang = failure === 'unsupported' ? 'en' : 'ar';
  test(`App profile (${lang}): a ${failure} calendar keeps DD/MM/YYYY keyboard entry usable`, async ({ page }) => {
    const copy = words[lang];
    const field = await openDetails(page, lang);
    const calendar = page.locator('input[type="date"]');
    await calendar.evaluate((node, mode) => Object.defineProperty(node, 'showPicker', {
      configurable: true,
      value: mode === 'unsupported' ? undefined : () => { throw new DOMException('Picker blocked', 'NotAllowedError'); },
    }), failure);
    const calendarButton = page.getByRole('button', { name: copy.details.birthdayCalendar, exact: true });
    await calendarButton.click();
    await expect(page.getByText(copy.details.birthdayCalendarFallback, { exact: true })).toBeVisible();
    await expect(calendarButton).toHaveCount(0);
    await expect(field).toBeFocused();
    // A second browser-locale editor must never expose a month-first date.
    await expect(calendar).toHaveCSS('opacity', '0');
    await expect(calendar).toHaveAttribute('aria-hidden', 'true');
    await expect(calendar).toHaveAttribute('tabindex', '-1');
    await field.press('ControlOrMeta+A');
    await field.pressSequentially('15/11/2999');
    await expect(field).toHaveValue('15/11/2999');
    await expect(calendar).toHaveValue('');
    expect(await saveAlert(page, copy.common.save)).toContain(copy.details.birthdayInvalidTitle);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('almond.user') ?? '{}').birthday)).toBe('1990-11-15');

    await field.focus();
    await field.press('ControlOrMeta+A');
    await field.pressSequentially('29/02/2000');
    await expect(calendar).toHaveValue('2000-02-29');
    await saveSuccess(page, lang);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('almond.user') ?? '{}').birthday)).toBe('2000-02-29');
  });
}
