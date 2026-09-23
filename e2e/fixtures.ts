import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** The Talabat / Delivery Hero CDN the menu photos used to be hotlinked from.
 *  Menu photos must now be served from our own /menu/*.webp. */
export const FORBIDDEN_IMAGE_HOST = 'images.deliveryhero.io';

/** localStorage key of the dismissible "get the app" banner (AppDownloadBanner). */
const APP_BANNER_KEY = 'almond-app-banner-dismissed';

/** A menu item with a modifier group ("Bagel Type") and a single size. */
export const ITEM_WITH_MODIFIERS = 'p-10170';

type PageHealth = {
  consoleErrors: string[];
  failedRequests: string[];
  forbiddenHostRequests: string[];
};

type Fixtures = {
  /** Console errors, failed requests and hits on the old image CDN, collected
   *  for the whole test. Assert on it at the end of a journey. */
  health: PageHealth;
  /** Hide the fixed bottom app banner so it cannot cover sticky controls.
   *  Accessibility specs opt out so the banner is still scanned. */
  dismissAppBanner: boolean;
};

export const test = base.extend<Fixtures>({
  dismissAppBanner: [true, { option: true }],

  page: async ({ page, dismissAppBanner }, use) => {
    if (dismissAppBanner) {
      await page.addInitScript((key) => {
        try { window.localStorage.setItem(key, '1'); } catch { /* storage blocked */ }
      }, APP_BANNER_KEY);
    }
    await use(page);
  },

  health: async ({ page }, use) => {
    const health: PageHealth = { consoleErrors: [], failedRequests: [], forbiddenHostRequests: [] };
    page.on('console', (msg) => {
      if (msg.type() === 'error') health.consoleErrors.push(`${msg.text()} @ ${page.url()}`);
    });
    page.on('pageerror', (err) => health.consoleErrors.push(`pageerror: ${err.message} @ ${page.url()}`));
    page.on('request', (req) => {
      if (new URL(req.url()).hostname === FORBIDDEN_IMAGE_HOST) health.forbiddenHostRequests.push(req.url());
    });
    page.on('requestfailed', (req) => {
      const reason = req.failure()?.errorText ?? '';
      // Next.js aborts in-flight RSC prefetches when the user navigates away;
      // that is cancellation, not failure.
      if (reason.includes('ERR_ABORTED')) return;
      health.failedRequests.push(`${req.method()} ${req.url()} — ${reason}`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) health.failedRequests.push(`${res.request().method()} ${res.url()} — HTTP ${res.status()}`);
    });
    await use(health);
  },
});

export { expect };

/** Assert a page stayed clean: no console errors, no failed requests, and not a
 *  single request to the old third-party image host. */
export function expectHealthy(health: PageHealth): void {
  expect(health.forbiddenHostRequests, 'requests to the old image CDN').toEqual([]);
  expect(health.consoleErrors, 'console errors').toEqual([]);
  expect(health.failedRequests, 'failed network requests').toEqual([]);
}

/** Parse a JOD amount as the site renders it (Arabic-Indic or Latin digits,
 *  Arabic decimal separator «٫» or «.»). Returns the first number found. */
export function parseJod(text: string): number {
  const latin = text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
    .replace(/[٬٬]/g, '');
  const m = latin.match(/\d+(?:\.\d+)?/);
  if (!m) throw new Error(`no amount in «${text}»`);
  return Number(m[0]);
}

/** True when the page is wider than the viewport (horizontal scroll). */
export async function horizontalOverflow(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
}

/** Wait until client components have hydrated (the header's cart link becomes
 *  interactive only after mount). */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/** Run axe with WCAG 2.x A/AA + best-practice tags and return only the
 *  violations that should fail the build. */
export async function blockingViolations(page: Page, opts: { include?: string } = {}) {
  // @axe-core/playwright is typed against the hoisted playwright-core (1.63)
  // while @playwright/test 1.56 ships its own; the runtime API it uses is the
  // same, so the cast only bridges the two .d.ts copies.
  type AxePage = ConstructorParameters<typeof AxeBuilder>[0]['page'];
  let builder = new AxeBuilder({ page: page as unknown as AxePage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']);
  if (opts.include) builder = builder.include(opts.include);
  const results = await builder.analyze();
  const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  return {
    blocking,
    all: results.violations,
    summary: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      count: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    })),
  };
}
