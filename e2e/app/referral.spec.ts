import { test, expect } from '@playwright/test';
import { appUrl, seedApp } from './helpers';
import ar from '../../almond-app/locales/ar.json';
import en from '../../almond-app/locales/en.json';

type InviteHarness = {
  copied: string[];
  opened: string[];
  failCopy: boolean;
  failOpen: boolean;
};

for (const lang of ['ar', 'en'] as const) {
  test(`App: ${lang} invitations use WhatsApp or Copy link with honest recovery`, async ({ page }) => {
    const strings = lang === 'ar' ? ar : en;
    await seedApp(page, { signedIn: true, lang });
    await page.addInitScript(() => {
      // Isolate the browser's clipboard and external launch boundary. These
      // tests never open WhatsApp, send anything or touch the OS clipboard.
      const harness: InviteHarness = { copied: [], opened: [], failCopy: false, failOpen: false };
      (window as unknown as { inviteHarness: InviteHarness }).inviteHarness = harness;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => {
          if (harness.failCopy) throw new Error('clipboard denied');
          harness.copied.push(text);
        } },
      });
      window.open = (url) => {
        if (harness.failOpen) throw new Error('WhatsApp unavailable');
        harness.opened.push(String(url));
        return null;
      };
    });
    await page.goto(appUrl('/referral'));
    const whatsapp = page.getByRole('button', { name: strings.referral.whatsapp, exact: true });
    const copy = page.getByRole('button', { name: strings.referral.copyLink, exact: true });
    await expect(whatsapp).toBeVisible({ timeout: 20_000 });
    await expect(copy).toBeVisible();
    await expect(page.getByRole('button', { name: strings.referral.share, exact: true })).toHaveCount(0);
    // The shipped mock has no SMS proof; a valid-looking number must not make
    // the page promise rewards or expose a code-attachment field.
    await expect(page.getByText(strings.referral.ineligibleBody, { exact: true })).toBeVisible();
    await expect(page.getByText(strings.referral.demoVerification, { exact: true })).toBeVisible();
    await expect(page.getByText(strings.referral.eligibilityPolicy, { exact: true })).toBeVisible();
    await expect(page.getByText(strings.referral.lifetimeCap.replace('{{points}}', '500'), { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: strings.referral.haveCode, exact: true })).toHaveCount(0);
    const link = await page.getByTestId('referral-link').innerText();
    const code = await page.getByTestId('referral-code').innerText();
    expect(link).toContain(`ref=${code}`);

    await copy.click();
    await expect(page.getByRole('status')).toHaveText(strings.referral.linkCopied);
    expect(await page.evaluate(() => (window as unknown as { inviteHarness: InviteHarness }).inviteHarness.copied)).toEqual([link]);

    await whatsapp.click();
    const opened = await page.evaluate(() => (window as unknown as { inviteHarness: InviteHarness }).inviteHarness.opened);
    expect(opened).toHaveLength(1);
    const destination = new URL(opened[0]);
    expect(destination.origin).toBe('https://wa.me');
    expect([...destination.searchParams.keys()]).toEqual(['text']);
    expect(destination.searchParams.get('text')).toBe(strings.referral.shareMessage.replace('{{code}}', code).replace('{{link}}', link));

    await page.evaluate(() => { (window as unknown as { inviteHarness: InviteHarness }).inviteHarness.failCopy = true; });
    await copy.click();
    await expect(page.getByRole('alert')).toHaveText(strings.referral.copyFailed);
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByTestId('referral-link')).toHaveText(link);
    await page.evaluate(() => { (window as unknown as { inviteHarness: InviteHarness }).inviteHarness.failCopy = false; });
    await copy.click();
    await expect(page.getByRole('status')).toHaveText(strings.referral.linkCopied);

    await page.evaluate(() => { (window as unknown as { inviteHarness: InviteHarness }).inviteHarness.failOpen = true; });
    await whatsapp.click();
    await expect(page.getByRole('alert')).toHaveText(strings.referral.whatsappFailed);
    await expect(copy).toBeEnabled();
    await expect(page).toHaveURL(/\/referral$/);
    await page.getByRole('link', { name: strings.policies.title, exact: true }).click();
    await expect(page).toHaveURL(/\/profile\/policies$/);
    await expect(page.getByRole('region', { name: strings.policies.title, exact: true })).toBeVisible();
  });
}

test('App: the completed-profile invite banner opens both invitation choices', async ({ page }) => {
  await seedApp(page, { signedIn: true, lang: 'ar' });
  await page.goto(appUrl('/'));
  await expect(page.getByRole('tab', { name: 'الرئيسية', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('almond.user') ?? '{}');
    localStorage.setItem('almond.user', JSON.stringify({ ...user, birthday: '1990-06-15', gender: 'female' }));
  });
  await page.reload();
  await page.getByRole('button', { name: ar.referral.title, exact: true }).click({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/referral$/);
  await expect(page.getByRole('button', { name: ar.referral.whatsapp, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: ar.referral.copyLink, exact: true })).toBeVisible();
});
