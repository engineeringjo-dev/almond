import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstance } from 'i18next';

import { I18N_OPTIONS } from '@/lib/i18nOptions';

const source = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('P1 programme policies remain public and findable', () => {
  it('has a named readable scroll region without requiring an account', () => {
    const page = source('app/profile/policies.tsx');
    expect(page).toContain("<Screen scrollLabel={t('policies.title')}>");
    expect(page).not.toMatch(/useAuthStore|useUserId|useLoyalty|Redirect|router\.(replace|push)/);
    expect(source('app/profile/_layout.tsx')).toContain("backFallback('profile')");
  });

  it('is linked from both Profile and the referral conditions', () => {
    const rows = source('app/(tabs)/profile.tsx').match(/<ListRow\b[\s\S]*?\/>/g) ?? [];
    const policyRow = rows.find((row) => row.includes("label={t('policies.title')}"));
    expect(policyRow).toBeDefined();
    expect(policyRow).toContain("router.push('/profile/policies')");
    expect(source('app/referral.tsx')).toContain('<Link href="/profile/policies" asChild>');
  });
});

describe('P2 policy amounts follow shared dials and bound the final referral grant', () => {
  it('the route reads shared settings instead of stating its own figures', () => {
    const page = source('app/profile/policies.tsx');
    for (const setting of ['REFERRAL_REWARD_POINTS', 'REFERRAL_LIFETIME_CAP_POINTS', 'POINT_LOT_LIFE_MONTHS']) {
      expect(page).toContain(`formatNumber(config.${setting}, lang)`);
    }
    expect(page).toContain('count: config.POINT_LOT_LIFE_MONTHS');
    expect(page).not.toMatch(/\b(?:50|500|12)\b/);
  });

  for (const lang of ['ar', 'en'] as const) {
    it(`${lang}: an updated amount renders without a hardcoded reward or unresolved placeholder`, async () => {
      const i18n = createInstance();
      await i18n.init({ ...I18N_OPTIONS, lng: lang });
      const reward = i18n.t('policies.referralReward', { points: '41' });
      const cap = i18n.t('policies.referralCap', { points: '613' });
      expect(reward).toMatch(lang === 'ar' ? /لغاية 41/ : /up to 41/);
      expect(cap).toContain('613');
      for (const text of [reward, cap]) expect(text).not.toMatch(/\{\{|\b50\b|\b500\b/);
      for (const months of [1, 2, 3, 12, 100]) {
        const life = i18n.t('policies.pointsLife', { count: months, months: String(months) });
        expect(life).not.toMatch(/policies\.|\{\{/);
        if (months >= 3) expect(life).toContain(String(months));
      }
      if (lang === 'ar') {
        expect(i18n.t('policies.pointsLife', { count: 1, months: '1' })).toContain('شهر واحد');
        expect(i18n.t('policies.pointsLife', { count: 2, months: '2' })).toContain('شهران');
        expect(i18n.t('policies.pointsLife', { count: 3, months: '3' })).toContain('3 أشهر');
        expect(i18n.t('policies.pointsLife', { count: 12, months: '12' })).toContain('12 شهراً');
      }
    });
  }
});
