import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createInstance } from 'i18next';

import { LoyaltyCard } from '@/components/home/LoyaltyCard';
import { PaymentMethods } from '@/components/cart/PaymentMethods';
import { I18N_OPTIONS } from '@/lib/i18nOptions';

/**
 * MR — TWO DECIMALS, ROUNDED TOWARD WHAT THE MEMBER CAN ACT ON.
 *
 * Owner, 2026-10-19: «خانتان (كما بناه Codex)» (docs/HANDOVER.md §7). The
 * review of PRs #103 and #104 (docs/CODEX-LOYALTY-REVIEW-2026-10-19.ar.md):
 *   item 5 — «إنفاق 1.488 يترك 18.512، فتقول الشاشة "اصرف 18.51 د.أ إضافية"»;
 *   item 7 — «رصيد 7.448 يظهر 7.45، ثم يُرفض تحويل 7.45».
 * An amount the member still NEEDS rounds up (formatJODNeeded); money the
 * member HOLDS rounds down (formatJODHeld). Both live in
 * packages/shared/src/lib/format.ts; F5 in format.test.ts tests the rounding,
 * C8i the progress sentence, and this file the screens that show a balance.
 */

const state = vi.hoisted(() => ({
  lang: 'en' as 'ar' | 'en',
  t: (key: string, _params?: Record<string, unknown>): string => key,
  wallet: 0 as number | undefined,
}));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => state }));
vi.mock('@/hooks/useLoyalty', () => ({
  useLoyaltyBalance: () => ({
    isLoading: false,
    data: { points: 1240, tier: 'base', windowSpend: 0, nextTier: null, welcomeBonusPending: 0 },
  }),
  useWallet: () => ({ data: state.wallet }),
}));
vi.mock('expo-router', () => ({ router: { push: () => undefined } }));
// The amounts, as plain text; the native font and SVG boundaries are isolated.
vi.mock('@/components/ui/Text', () => ({ Text: ({ children }: { children: React.ReactNode }) =>
  React.createElement('span', null, children) }));
vi.mock('@/components/ui/Icon', () => ({ Icon: () => null }));

async function useLanguage(lang: 'ar' | 'en') {
  const i18n = createInstance();
  await i18n.init({ ...I18N_OPTIONS, lng: lang });
  state.lang = lang;
  state.t = (key, params) => i18n.t(key, params);
}
const shown = (lang: 'ar' | 'en', value: string) => (lang === 'ar' ? `${value} د.أ` : `JOD ${value}`);

beforeEach(() => { vi.stubGlobal('React', React); });
afterEach(() => { vi.unstubAllGlobals(); state.wallet = 0; });

describe('MR1 a wallet balance never reads more than it can pay', () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`${lang}: the home card shows a wallet of 1.005 as 1.00`, async () => {
      await useLanguage(lang);
      state.wallet = 1.005;
      const html = renderToStaticMarkup(React.createElement(LoyaltyCard));
      expect(html).toContain(`<span>${shown(lang, '1.00')}</span>`);
      expect(html).not.toContain(shown(lang, '1.01'));
      // 1,240 points are exactly 12.40: rounding down never takes a qirsh off.
      expect(html).toContain(shown(lang, '12.40'));
    });

    it(`${lang}: the cart's wallet line shows 7.448 as 7.44, whether or not it covers the order`, async () => {
      await useLanguage(lang);
      for (const total of [3, 7.45]) {
        const html = renderToStaticMarkup(React.createElement(PaymentMethods, {
          value: 'cash', onChange: () => undefined, walletBalance: 7.448, total,
        }));
        expect(html, `total ${total}`).toContain(shown(lang, '7.44'));
        expect(html, `total ${total}`).not.toContain(shown(lang, '7.45'));
      }
    });
  }
});

const APP = join(__dirname, '..');
const REPO = join(APP, '..');
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : files(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
const SOURCES = [
  ...['app', 'components', 'lib', 'hooks', 'services'].flatMap((d) => files(join(APP, d))),
  ...files(join(REPO, 'almond-web', 'src')),
];
const src = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

describe('MR2 every balance and every amount still needed goes through its rounding', () => {
  /** Listed by hand, so that swapping one back to formatJOD fails here by name. */
  const HELD: Array<[string, string]> = [
    ['almond-app/components/home/LoyaltyCard.tsx', 'formatJODHeld(jodFromPoints(data.points), lang)'],
    ['almond-app/components/home/LoyaltyCard.tsx', 'formatJODHeld(wallet ?? 0, lang)'],
    ['almond-app/components/loyalty/BalanceWorth.tsx', 'formatJODHeld(jodFromPoints(points), lang)'],
    ['almond-app/components/loyalty/VisitRatingSheet.tsx', 'formatJODHeld(jodFromPoints(balance.points), lang)'],
    ['almond-app/components/cart/PaymentMethods.tsx', 'formatJODHeld(walletBalance, lang)'],
    ['almond-app/components/gift/GiftSendSheet.tsx', 'formatJODHeld(wallet ?? 0, lang)'],
    ['almond-app/app/profile/wallet.tsx', 'formatJODHeld(balance ?? 0, lang)'],
    ['almond-app/app/(tabs)/profile.tsx', 'formatJODHeld(wallet, lang)'],
    ['almond-app/app/transfer.tsx', 'formatJODHeld(wallet ?? 0, lang)'],
    ['almond-app/app/transfer.tsx', 'formatJODHeld(who.remainingToday.walletJod, lang)'],
    ['almond-app/app/transfer.tsx', 'formatJODHeld(receipt.walletBalance, lang)'],
    ['almond-web/src/components/rewards/RewardsView.tsx', 'formatJODHeld(jodFromPoints(points), lang)'],
    ['almond-web/src/components/wallet/WalletView.tsx', 'formatJODHeld(balance, lang)'],
  ];
  const NEEDED: Array<[string, string]> = [
    ['almond-app/lib/tierCopy.ts', 'formatJODNeeded(jodRemaining, lang)'],
    ['almond-web/src/components/rewards/RewardsView.tsx', 'formatJODNeeded(tp.remaining, lang)'],
  ];

  it.each([...HELD, ...NEEDED])('%s: %s', (file, call) => {
    expect(src(file)).toContain(call);
  });

  it('no screen in the app or on the website shows a balance or a remainder through plain formatJOD', () => {
    // formatJOD rounds half up both ways; it is right for a price, wrong for
    // money held (1.005 → 1.01) or still needed (18.512 → 18.51).
    const BALANCE = /\b(?:jodFromPoints|spendableJod)\(|\b\w*(?:[wW]allet|[bB]alance|[rR]emaining)\w*\b/;
    const calls: string[] = [];
    const offenders: string[] = [];
    for (const file of SOURCES) {
      for (const m of readFileSync(file, 'utf8').matchAll(/\bformatJOD\(([^;]*?),\s*(?:lang|lng|'ar'|'en')\s*\)/g)) {
        calls.push(file);
        if (BALANCE.test(m[1]!)) offenders.push(`${relative(REPO, file)}: ${m[0]}`);
      }
    }
    expect(calls.length, 'the scan must reach the app and website money calls').toBeGreaterThanOrEqual(40);
    expect(offenders).toEqual([]);
  });
});
