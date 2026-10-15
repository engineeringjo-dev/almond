import { beforeAll, describe, expect, it } from 'vitest';
import { createInstance, type i18n as I18n } from 'i18next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { I18N_OPTIONS } from '@/lib/i18nOptions';
import { earnRangeCopy } from '@almond/shared/loyalty';

/**
 * CH — «كاش باك لغاية 9%» IS SHOWN WITH ITS NUMBER, EVERYWHERE IT IS SHOWN.
 *
 * Owner, 2026-10-15: «لا نستخدم نقاطك نقود. ممكن نحكي كاش باك لغاية ٩%». The
 * headline carries {{max}}, read off the dials (bff/test/profile.test.ts T34h).
 * A screen that forgets to pass it prints «كاش باك لغاية {{max}}» to the
 * member, so each place that renders one of the two keys is pinned here.
 */
const code = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
let ar: I18n;
let en: I18n;
beforeAll(async () => {
  ar = createInstance();
  en = createInstance();
  await ar.init({ ...I18N_OPTIONS, lng: 'ar' });
  await en.init({ ...I18N_OPTIONS, lng: 'en' });
});

describe('CH1 the headline reads whole in both languages', () => {
  it('Arabic and English, with the computed ceiling', () => {
    for (const key of ['rewards.headline', 'onboarding.slide3Title']) {
      expect(ar.t(key, { max: earnRangeCopy('ar').max }), key).toBe('كاش باك لغاية 9%');
      expect(en.t(key, { max: earnRangeCopy('en').max }), key).toBe('Up to 9% cashback');
    }
  });
});

describe('CH2 every screen that shows it passes the number', () => {
  it('the rewards tab, onboarding and the Home slide', () => {
    const rewards = code('app/(tabs)/rewards.tsx');
    expect(rewards).toMatch(/const range = earnRangeCopy\(lang\);/);
    expect(rewards).toMatch(/t\('rewards\.headline', range\)/);
    expect(code('app/onboarding.tsx')).toMatch(
      /s\.titleKey === 'onboarding\.slide3Title' \? t\(s\.titleKey, \{ max: earnRangeCopy\(lang\)\.max \}\)/,
    );
    expect(code('lib/homeSlides.ts')).toMatch(/title: \{ key: 'rewards\.headline', params: \{ max: ctx\.range\.max \} \}/);
  });

  it('no other screen renders either key bare', () => {
    const bare = /t\('(rewards\.headline|onboarding\.slide3Title)'\)/;
    for (const rel of ['app/(tabs)/rewards.tsx', 'app/onboarding.tsx', 'app/(tabs)/index.tsx', 'app/loyalty.tsx', 'components/home/PromoCarousel.tsx']) {
      expect(code(rel), rel).not.toMatch(bare);
    }
  });
});

describe('CH3 the line under it says how 9% is reached', () => {
  it('the floor, the top and the ×1.5, in both languages', () => {
    const r = earnRangeCopy('ar');
    expect(ar.t('onboarding.slide3BodyNoGift', { low: r.low, high: r.high, mult: r.mult }))
      .toBe('يرجع لك من 2% إلى 6% من كل طلب، ونقاطك ×1.5 حين تدفع من رصيدك');
    expect(ar.t('onboarding.slide3Body', { low: r.low, high: r.high, mult: r.mult, gift: 200 }))
      .toBe('يرجع لك من 2% إلى 6% من كل طلب، ونقاطك ×1.5 حين تدفع من رصيدك، و200 نقطة هدية مع أول شراء');
    const e = earnRangeCopy('en');
    expect(en.t('home.rewardsSlide', { low: e.low, high: e.high, mult: e.mult }))
      .toBe('2% to 6% back on every order, and your points ×1.5 when you pay from your balance');
  });

  it('onboarding passes ×mult to both bodies', () => {
    const onboarding = code('app/onboarding.tsx');
    expect(onboarding).toMatch(/t\('onboarding\.slide3Body', \{ low: range\.low, high: range\.high, mult: range\.mult, gift \}\)/);
    expect(onboarding).toMatch(/t\('onboarding\.slide3BodyNoGift', \{ low: range\.low, high: range\.high, mult: range\.mult \}\)/);
  });
});
