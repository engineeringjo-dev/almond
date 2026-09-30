import { expect, type Page } from '@playwright/test';
import { E2E_ENV } from '../env';

/**
 * Helpers for the customer app's web export (almond-app, mock services).
 *
 * The app persists through AsyncStorage, which on web is localStorage under
 * the same keys the stores use. Seeding happens ONCE per test (guarded by a
 * sessionStorage flag), so a reload keeps whatever the app itself saved —
 * which is exactly what the cold-start specs need.
 */
export const appUrl = (path: string): string => `${E2E_ENV.APP_URL}${path}`;

export async function seedApp(
  page: Page,
  opts: { lang?: 'ar' | 'en'; signedIn?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ lang, signedIn }) => {
      try {
        if (sessionStorage.getItem('e2e.seeded')) return;
        sessionStorage.setItem('e2e.seeded', '1');
        localStorage.setItem('almond.onboarded', '1');
        if (lang) localStorage.setItem('almond.lang', lang);
        if (signedIn) {
          localStorage.setItem(
            'almond.user',
            JSON.stringify({ id: 'e2e-user', phone: '+962790000000', name: 'E2E', isGuest: false }),
          );
        }
      } catch {
        /* storage blocked */
      }
    },
    { lang: opts.lang ?? null, signedIn: opts.signedIn ?? false },
  );
}

/** The Arabic menu's iced latte: a drink with sizes, milk, add-ons and pairings. */
export const LATTE = 'لاتيه مثلج';

/** Open the item sheet for `name` from the Order › القائمة tab. */
export async function openItem(page: Page, name: string): Promise<void> {
  await page.goto(appUrl('/order'));
  const search = page.getByRole('textbox', { name: 'ابحث عن مشروب أو طبق' });
  await expect(search).toBeVisible({ timeout: 20_000 });
  await search.fill(name);
  await page.getByText(name, { exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/** Put one iced latte in the cart through the item sheet. */
export async function addLatte(page: Page): Promise<void> {
  await openItem(page, LATTE);
  await page.getByRole('dialog').getByText(/أضف للسلة/).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** «أضف للسلة · 3.500 د.أ» → 3.5 */
export function ctaAmount(text: string): number {
  const m = /(\d+\.\d{3})/.exec(text);
  if (!m) throw new Error(`no amount in "${text}"`);
  return Number(m[1]);
}

/** Cart lines as the app persisted them: `name ×qty`. */
export async function cartLines(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('almond.cart');
    const items = raw ? (JSON.parse(raw) as { state?: { items?: { nameAr: string; qty: number }[] } }).state?.items : [];
    return (items ?? []).map((i) => `${i.nameAr} ×${i.qty}`);
  });
}
