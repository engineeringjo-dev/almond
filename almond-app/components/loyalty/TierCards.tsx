import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { TIER_FILL } from '@/components/loyalty/TierBadge';
import { colors, radius, spacing, shadow } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
// earn-arith-exempt: the tier ramp, for DISPLAY only — no invoice, no grant. §7 T7.
import { tiers } from '@/services/seed';
import { tierName, walletRateName } from '@almond/shared/loyalty';
import type { Lang, Tier, TierId } from '@/types';

// Full per-tier benefit lists (each card is self-contained, Starbucks-style).
// Tiers differ ONLY by reward generosity — never by service/treatment.
//
// 🔴 WHAT CAME OFF THESE CARDS, AND WHY. Four rows were promising mechanics the
// code does not run:
//   - earnBean/earnSilver/earnGold/earnBlack said "Earn 5 / 6.25 / 7.5 / 10
//     points per 1 JOD". The code pays 2 / 4 / 6. Every one of them was wrong on
//     screen, in both languages, on ids (bean/silver/gold/black) that stopped
//     existing when the ladder became base/plus/top.
//   - doubleDays4 promised Double Points Days: config.BONUS_BEAN_DAY.enabled is
//     false and WEEKDAY_EARN_BONUS is empty. Retired 2026-09-06.
//   - cupBonus promised double points for a personal cup. No such mechanic
//     exists anywhere in the repo.
//   - reloadBonus was identical at every rung, so listing it as a TIER benefit
//     implied a differentiation it did not carry. It moved to home.walletHint,
//     and was then deleted outright (owner, 2026-10-15: «لا يوجد بونص شحن،
//     البونص للانفاق فقط»); the wallet's bonus is on spending it.
//
// One row replaces all four earn* rows: `tierBenefits.cashback`, whose {{rate}}
// IS the tier's name. 1 point = 1 qirsh exactly (10,621 live redemptions), so
// the rate and the cashback percentage are the same number — "Earn 2 points per
// 1 JOD" said one fact twice in two units, and a string with no numeral in it
// cannot go stale.
//
// 🔴 AND THEN FIVE MORE, 2026-10-15. Owner: «لا تعد بشيء اشطب الوعد بالعيد
// ميلاد» — promise nothing. A birthday drink, a free customisation a month,
// personal offers, coffee experiences and a named member card were on these
// cards; NOTHING in the BFF grants any of them (a birthday is stored, never
// paid). They are deleted, keys and all, and C18 in almond-app/test/copy.test.ts
// fails if any of the five keys comes back. What is left is what the server
// pays: the rung's rate, and the rate when the bill is paid from the balance.
//
// 🔴 `tierBenefits.noExpire` ("Your points never expire") used to sit on the
// top rung, because the old inactivity rule really did exempt it. Under «لا
// إعفاء — القاعدة للجميع» every point on every rung lives 12 months from the
// day it was granted, so the row is gone and so is the string. A benefit the
// code does not honour is the W4 defect this project has already paid for.
type Benefit = { icon: IconName; key: string; params: (tier: Tier, lang: Lang) => Record<string, string> };

const BENEFITS: Benefit[] = [
  // The rate row, and the only place a rung's rate is stated as a benefit.
  { icon: 'bean', key: 'tierBenefits.cashback', params: (tier, lang) => ({ rate: tierName(tier, lang) }) },
  // The same rung paid from the wallet or gift-card balance (×1.5, read off
  // the dials by walletRateName) — real at every rung, and different at each.
  { icon: 'wallet', key: 'tierBenefits.walletCashback', params: (tier, lang) => ({ rate: walletRateName(tier, lang) }) },
];

/**
 * The three rungs, stacked, and the double days once under them.
 *
 * Stacked, not a carousel and not Dunkin's one-at-a-time tabs (Original | Epic
 * | Legend): their rungs differ by lists of perks, ours by one rate, so the
 * comparison is the whole point and it is made at a glance. The double days
 * are the same on all three rungs, so they are said once (owner, 2026-10-15 —
 * paid by the server on the day of the sale, every rung).
 *
 * `current` is the rung the member is PAID at (balance.tier), never one
 * re-derived from the window: there is no demotion. A guest has none.
 */
export function TierCards({ current }: { current?: TierId }) {
  const { t, lang } = useI18n();
  return (
    <View style={styles.list}>
      {tiers.map((tr) => {
        const isCurrent = tr.id === current;
        const fg = colors.onInk; // the ramp carries onInk at ≥4.5:1 in both schemes
        // The qualifying door, said the way the member can act on it. The
        // second rung has a REAL visits door (config.TIER2_VISITS_ALTERNATIVE
        // = 4, and ceil(20 / 5.85) = 4 too, so the two doors agree); the top
        // rung has none, so it does not pretend to.
        const sub = tr.id === 'base'
          ? t('rewards.statusSubBase')
          : tr.id === 'plus'
            ? t('rewards.statusSubPlus', { count: config.TIER2_VISITS_ALTERNATIVE, visits: config.TIER2_VISITS_ALTERNATIVE })
            : t('rewards.statusSubTop');
        return (
          <View key={tr.id} style={[styles.card, { backgroundColor: TIER_FILL[tr.id] }]}>
            <View style={styles.head}>
              <Text variant="h2" color={fg} style={styles.flex}>
                {tierName(tr, lang)}
              </Text>
              {/* In words, not by colour alone (WCAG 1.4.1). */}
              {isCurrent ? (
                <View style={styles.currentPill}>
                  <Text variant="caption" color={TIER_FILL[tr.id]} style={styles.currentPillText}>
                    {t('rewards.currentTier')}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" color={fg} style={styles.sub}>
              {sub}
            </Text>
            {BENEFITS.map((b) => (
              <View key={b.key} style={styles.benefitRow}>
                <Icon name={b.icon} size={16} color={fg} strokeWidth={1.9} />
                <Text variant="caption" color={fg} style={styles.flex}>
                  {t(b.key, b.params(tr, lang))}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
      <View style={styles.doubleDays}>
        <Icon name="sparkles" size={18} color={colors.dark} strokeWidth={1.9} />
        <Text variant="caption" color={colors.dark} style={styles.flex}>
          {t('tierBenefits.doubleDays')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: spacing.md },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  currentPill: {
    backgroundColor: colors.onInk,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  currentPillText: { fontWeight: '700' },
  sub: { opacity: 0.9, marginBottom: spacing.xs },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  doubleDays: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
});
