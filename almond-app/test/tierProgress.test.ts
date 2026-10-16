import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';

import { TierProgress } from '@/components/loyalty/TierProgress';
import { BalanceWorth } from '@/components/loyalty/BalanceWorth';
import { tierProgressCopy, type TierProgressInput } from '@/lib/tierCopy';
import { I18N_OPTIONS } from '@/lib/i18nOptions';
import { standing, type SpendEntry } from '@almond/shared/loyalty/window';
import { formatJOD } from '@almond/shared/lib/format';
import type { TierId } from '@/types';

const language = vi.hoisted(() => ({
  lang: 'en' as 'ar' | 'en',
  t: (key: string, _params?: Record<string, unknown>): string => key,
}));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => language }));
// Render the real tier/worth decisions with ordinary readable text, isolating
// the native font and SVG boundaries rather than reproducing the decisions.
vi.mock('@/components/ui/Text', () => ({ Text: ({ children, testID }: { children: React.ReactNode; testID?: string }) =>
  React.createElement('span', { 'data-testid': testID }, children) }));
vi.mock('@/components/ui/Icon', () => ({ Icon: ({ name }: { name: string }) =>
  React.createElement('i', { 'data-icon': name }) }));

const AT = new Date('2026-10-20T12:00:00+03:00');
const twoDays: SpendEntry[] = [{ day: '2026-10-15', jod: 7.5 }, { day: '2026-09-20', jod: 4.5 }];

/** Feed the presentation the actual shared standing, not a second formula. */
function balance(entries: SpendEntry[], held: TierId = 'base'): TierProgressInput & { tier: TierId } {
  const st = standing(entries, held, undefined, AT);
  return {
    tier: st.held.id as TierId,
    windowSpend: st.windowSpend,
    nextTier: st.next ? {
      id: st.next.rung.id as TierId,
      jodRemaining: st.next.jodRemaining,
      visitsRemaining: st.next.visitsRemaining,
      visitsGuaranteed: st.next.visitsGuaranteed,
      step: st.next.step,
    } : null,
  };
}

async function useLanguage(lang: 'ar' | 'en') {
  const i18n = createInstance();
  await i18n.init({ ...I18N_OPTIONS, lng: lang });
  language.lang = lang;
  language.t = (key, params) => i18n.t(key, params);
  return i18n;
}
const render = (input: ReturnType<typeof balance>) => renderToStaticMarkup(React.createElement(TierProgress, input));

beforeEach(() => { vi.stubGlobal('React', React); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('TP1 only a real paid-day door is an alternative to remaining spend', () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`${lang}: the 12 JOD/two-day standing shows 8 JOD OR two paid days, with the exact window`, async () => {
      const i18n = await useLanguage(lang);
      const input = balance(twoDays);
      const copy = tierProgressCopy(input, lang)!;
      expect(copy.params.jod).toBe(formatJOD(8, lang));
      expect(copy.visitsAlternative?.params).toEqual({ count: 2, visits: '2', tier: '4%' });
      const html = render(input);
      expect(html).toContain(i18n.t(copy.key, copy.params));
      expect(html).toContain(i18n.t('loyalty.visitDaysAlternative', copy.visitsAlternative!.params));
      expect(html).toContain(i18n.t('loyalty.windowNote', { days: 90 }));
      expect(html).toContain(i18n.t('loyalty.tierKept'));
      expect(html).not.toMatch(/[٠-٩۰-۹]/);
    });
  }

  it('zero activity shows the full 20 JOD or four paid-day target, never zero visits', async () => {
    await useLanguage('en');
    const copy = tierProgressCopy(balance([]), 'en')!;
    expect(copy.params.jod).toBe(formatJOD(20, 'en'));
    expect(copy.visitsAlternative?.params.count).toBe(4);
    expect(render(balance([]))).toContain('4 more paid visit days');
  });

  it('two paid invoices on one Amman day still leave three separate days', () => {
    const input = balance([{ day: '2026-10-15', jod: 7.5 }, { day: '2026-10-15', jod: 4.5 }]);
    expect(tierProgressCopy(input, 'en')!.visitsAlternative?.params.count).toBe(3);
  });

  it('the remaining paid-day count uses the actual Arabic singular, dual and plural forms', async () => {
    await useLanguage('ar');
    const expected = [
      'أو يوم زيارة مدفوعة إضافي واحد للوصول إلى 4%',
      'أو يوما زيارة مدفوعة إضافيان للوصول إلى 4%',
      'أو 3 أيام زيارة مدفوعة إضافية للوصول إلى 4%',
      'أو 4 أيام زيارة مدفوعة إضافية للوصول إلى 4%',
    ];
    for (const [index, message] of expected.entries()) {
      const paidDays = Array.from({ length: 3 - index }, (_, day) => ({ day: `2026-10-0${day + 1}`, jod: 1 }));
      // A comped day does not reduce the target.
      expect(render(balance([...paidDays, { day: '2026-10-10', jod: 0 }]))).toContain(message);
    }
  });

  it('four low-spend days already earn 4%; the next step is 53 JOD, never projected visits', async () => {
    await useLanguage('en');
    const input = balance([1, 2, 3, 4].map((day) => ({ day: `2026-10-0${day}`, jod: 3 })));
    expect(input.tier).toBe('plus');
    const copy = tierProgressCopy(input, 'en')!;
    expect(copy.key).toBe('loyalty.toTop');
    expect(copy.params.jod).toBe(formatJOD(53, 'en'));
    expect(copy.visitsAlternative).toBeUndefined();
    expect(render(input)).not.toContain('data-testid="tier-visits-alternative"');
  });

  it('a false, missing, fractional or zero guarantee cannot become a visits promise', () => {
    const input = balance(twoDays);
    for (const next of [
      { ...input.nextTier!, visitsGuaranteed: false },
      { ...input.nextTier!, visitsGuaranteed: undefined },
      { ...input.nextTier!, visitsRemaining: 1.5 },
      { ...input.nextTier!, visitsRemaining: 0 },
    ]) {
      expect(tierProgressCopy({ ...input, nextTier: next }, 'en')!.visitsAlternative).toBeUndefined();
    }
    // A legacy spend figure has no exact visit-day evidence to render.
    expect(tierProgressCopy({ windowSpend: 12 }, 'en')!.visitsAlternative).toBeUndefined();
  });
});

describe('TP2 held tiers and absent progress are not loss events', () => {
  it('a rolled-off Plus window keeps both reached markers and shows 65 JOD toward Top', async () => {
    const i18n = await useLanguage('en');
    const input = balance([{ day: '2026-02-01', jod: 22 }], 'plus');
    expect(input.windowSpend).toBe(0);
    const html = render(input);
    expect(tierProgressCopy(input, 'en')!.params.jod).toBe(formatJOD(65, 'en'));
    expect(html.match(/data-icon="check"/g)).toHaveLength(2);
    expect(html).toContain(i18n.t('loyalty.tierKept'));
    expect(html).not.toContain('data-testid="tier-visits-alternative"');
  });

  it('a top tier with an empty window has no invented progress or retention deadline', async () => {
    const i18n = await useLanguage('en');
    const input = balance([], 'top');
    const html = render(input);
    expect(tierProgressCopy(input, 'en')).toBeNull();
    expect(html.replaceAll('&#x27;', "'")).toContain(i18n.t('loyalty.tierMax', { tier: '6%' }));
    expect(html.match(/data-icon="check"/g)).toHaveLength(3);
    expect(html).not.toContain('data-testid="tier-window"');
    expect(html).not.toContain('data-testid="tier-visits-alternative"');
  });

  it('missing progress below Top asks to refresh instead of claiming Top or guessing visits', async () => {
    const i18n = await useLanguage('en');
    for (const tier of ['base', 'plus'] as const) {
      for (const nextTier of [undefined, null]) {
        const html = render({ tier, windowSpend: 12, nextTier });
        expect(html).toContain(i18n.t('loyalty.progressUnavailable'));
        expect(html).not.toContain(i18n.t('loyalty.tierMax', { tier: '6%' }));
        expect(html).not.toContain('data-testid="tier-visits-alternative"');
      }
    }
  });
});

describe('TP3 points worth does not depend on the price of a drink', () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`${lang}: zero, small and full balances state only their real cash value`, async () => {
      const i18n = await useLanguage(lang);
      for (const [points, jod] of [[0, 0], [12, 0.12], [1240, 12.4]]) {
        const html = renderToStaticMarkup(React.createElement(BalanceWorth, { points }));
        expect(html).toBe(`<span>${i18n.t('home.pointsWorth', { jod: formatJOD(jod, lang) })}</span>`);
      }
    });
  }
});
