import type { Page, Response } from '@playwright/test';
import { test, expect, waitForHydration } from './fixtures';
import { E2E_ENV } from './env';

/** Collect the text of every document / script / fetch response the page loads,
 *  so we can prove the BFF admin key never reaches a browser. */
function collectBodies(page: Page): { bodies: Promise<{ url: string; text: string }>[] } {
  const state = { bodies: [] as Promise<{ url: string; text: string }>[] };
  page.on('response', (res: Response) => {
    const type = res.request().resourceType();
    if (!['document', 'script', 'fetch', 'xhr', 'stylesheet'].includes(type)) return;
    state.bodies.push(
      res.text().then((text) => ({ url: res.url(), text })).catch(() => ({ url: res.url(), text: '' })),
    );
  });
  return state;
}

/** Submit the login form; resolves to the HTTP status of the session POST. */
async function login(page: Page, password: string): Promise<number> {
  await page.goto('/admin');
  await waitForHydration(page);
  await page.getByLabel('كلمة المرور').fill(password);
  const posted = page.waitForResponse(
    (r) => r.url().endsWith('/api/admin/session') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'دخول' }).click();
  return (await posted).status();
}

test.describe('Back office (/admin)', () => {
  test('a wrong password is refused', async ({ page }) => {
    expect(await login(page, 'not-the-password')).toBe(401);
    await expect(page.getByText('كلمة مرور غير صحيحة')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'دخول الأدمن' })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(0);

    // The API refuses too — the gate is the server, not the form.
    const direct = await page.request.get('/api/admin/companies');
    expect(direct.status()).toBe(401);
  });

  test('the correct password logs in and the companies tab loads from the BFF', async ({ page }) => {
    expect(await login(page, E2E_ENV.ADMIN_PASSWORD)).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'الباك أوفس' })).toBeVisible();

    const companiesTab = page.getByRole('tab', { name: 'الشركات وخصوماتها' });
    await companiesTab.click();
    await expect(companiesTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'شركة جديدة' })).toBeVisible();
    // No "could not load" banner: the round trip web → /api/admin → BFF worked.
    await expect(page.getByText(/تعذّر|Could not load/)).toHaveCount(0);

    // Write through the BFF and read it back.
    const id = `e2e-${test.info().project.name}-${Date.now()}`;
    await page.getByLabel('المعرّف (إنجليزي، بلا مسافات)').fill(id);
    await page.getByLabel('نسبة الخصم ٪').fill('15');
    await page.getByLabel('الاسم بالعربية').fill(`شركة ${id}`);
    await page.getByLabel('الاسم بالإنجليزية').fill(`Company ${id}`);
    const saved = page.waitForResponse((r) => r.url().endsWith('/api/admin/companies') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'حفظ' }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText(`شركة ${id}`)).toBeVisible();

    const api = await page.request.get('/api/admin/companies');
    expect(api.status()).toBe(200);
    const body = (await api.json()) as { companies: { id: string }[] };
    expect(body.companies.map((c) => c.id)).toContain(id);
  });

  test('the ADMIN_KEY never reaches the browser (HTML, JS, API responses)', async ({ page }) => {
    const seen = collectBodies(page);

    // Logged out…
    await page.goto('/admin');
    await waitForHydration(page);
    // …and logged in, visiting every tab so their chunks and fetches load.
    await page.getByLabel('كلمة المرور').fill(E2E_ENV.ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'دخول' }).click();
    await expect(page.getByRole('tab').first()).toBeVisible();
    for (const tab of await page.getByRole('tab').all()) {
      await tab.click();
    }
    await waitForHydration(page);
    // A few public pages too — the key must not be in any shared chunk.
    await page.goto('/');
    await waitForHydration(page);

    const bodies = await Promise.all(seen.bodies);
    const scripts = bodies.filter((b) => /\.js(\?|$)/.test(b.url));
    expect(scripts.length, 'JS chunks were inspected').toBeGreaterThan(5);
    const leaks = bodies.filter((b) => b.text.includes(E2E_ENV.ADMIN_KEY)).map((b) => b.url);
    expect(leaks, 'responses containing ADMIN_KEY').toEqual([]);

    // And every JS file referenced by the admin HTML, fetched directly.
    const html = await (await page.request.get('/admin')).text();
    expect(html).not.toContain(E2E_ENV.ADMIN_KEY);
    const chunkUrls = [...html.matchAll(/\/_next\/static\/[^"'\s)]+\.js/g)].map((m) => m[0]);
    expect(chunkUrls.length).toBeGreaterThan(0);
    for (const url of new Set(chunkUrls)) {
      const js = await (await page.request.get(url)).text();
      expect(js.includes(E2E_ENV.ADMIN_KEY), url).toBe(false);
    }
    // The password must not be baked into a bundle either.
    for (const b of scripts) expect(b.text.includes(E2E_ENV.ADMIN_PASSWORD), b.url).toBe(false);
  });
});
