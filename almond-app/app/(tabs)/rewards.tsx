import { useState } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HeroCard } from '@/components/ui/HeroCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { DoubleDayNote } from '@/components/loyalty/DoubleDayNote';
import { WelcomeGiftNote } from '@/components/loyalty/WelcomeGiftNote';
import { BalanceWorth } from '@/components/loyalty/BalanceWorth';
import { RewardsTile } from '@/components/loyalty/RewardsTile';
import { RedeemSheet } from '@/components/loyalty/RedeemSheet';
import { HowItWorksSheet, HowItWorksSteps } from '@/components/loyalty/HowItWorks';
import { TierCards } from '@/components/loyalty/TierCards';
import { colors, spacing, radius, fontSize } from '@/constants/theme';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';
import { useI18n } from '@/hooks/useI18n';
import { formatDate, formatDayKey, formatJOD, formatNumber } from '@/lib/format';
import { activeVoucherCount, lastPointsMove } from '@/lib/rewardsHub';
import { useLoyaltyBalance, usePointsHistory, useVouchers } from '@/hooks/useLoyalty';
import { useUser } from '@/stores/authStore';
// earn-arith-exempt: the tier ramp, for DISPLAY only — no invoice, no grant. §7 T7.
import { tiers } from '@/services/seed';
import { earnRangeCopy, tierName } from '@almond/shared/loyalty';
import { redeemOptions, type RedeemOption } from '@almond/shared/loyalty/redeem';

/**
 * «المكافآت» — ONE SCREEN, AND A DOOR TO EACH JOB.
 *
 * Owner, 2026-10-15: «الصفحة جدا طويلة عندي اريد تقسيمها مثل العميد الى حد
 * ما». The tab was 1,641 pt in seven sections, copied from Starbucks' page for
 * a signed-OUT visitor (docs/reference/starbucks/01.jpg): the redeem buttons
 * started under the fold and «سجل النقاط» at 1,558 pt. Al Ameed gives each
 * loyalty job a short page and a tile on one hub. So a member gets the card,
 * one row of amounts, the headline and four tiles, all above the tab bar; the
 * tiers, the history and the coupons are pages, and «كيف تعمل؟» is a sheet.
 * The plan and the measurements: docs/competitors/AL-AMEED-PAGE-DIVISION-2026-10.ar.md.
 *
 * A guest gets the page Starbucks and Dunkin' give one — what the programme
 * pays, how it works, the tiers — with sign-in at the TOP, where Dunkin' puts
 * it, and again at the end.
 */
export default function RewardsScreen() {
  const user = useUser();
  return !user || user.isGuest ? <GuestRewards /> : <MemberRewards />;
}

function MemberRewards() {
  const { t, lang } = useI18n();
  const { width } = useWindowDimensions();
  const balanceQ = useLoyaltyBalance();
  const vouchersQ = useVouchers();
  const historyQ = usePointsHistory();
  const [redeeming, setRedeeming] = useState<RedeemOption | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  if (balanceQ.isError) {
    return <Screen error onRetry={balanceQ.refetch} />;
  }
  if (balanceQ.isLoading || !balanceQ.data) {
    return (
      <Screen>
        <View style={styles.titleRow}>
          <Text variant="h1" accessibilityRole="header">{t('rewards.title')}</Text>
        </View>
        <Skeleton height={240} style={styles.skelHero} />
        <Skeleton width="40%" height={24} style={styles.skelLine} />
        <Skeleton height={48} style={styles.skelLine} />
        <View style={styles.tiles}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.skelTile}>
              <Skeleton height={72} />
            </View>
          ))}
        </View>
      </Screen>
    );
  }

  const balance = balanceQ.data;
  const points = balance.points;

  // The options are built from the BALANCE, in @almond/shared, so this screen
  // and the website offer one member one set of choices. There is no board to
  // be priced against a menu any more — see loyalty/redeem.ts.
  const options = redeemOptions(points);
  const range = earnRangeCopy(lang);

  // The rung the balance ALREADY CARRIES — not tierFromSpend(windowSpend).
  // Those two disagree for any ratcheted member: there is no demotion, so a
  // member whose 90-day window rolled below a threshold they crossed is still
  // paid the higher rate, and re-deriving it here would show them the lower one
  // right next to a TierBadge showing the higher one.
  const curIdx = Math.max(0, tiers.findIndex((tr) => tr.id === balance.tier));
  const next = tiers[curIdx + 1] ?? null;
  // The rate and the next one — never the ×2, which is said once, on the
  // promotion itself (C9).
  const tierSub = next
    ? t('rewards.tileTier', { tier: tierName(tiers[curIdx], lang), next: tierName(next, lang) })
    : t('rewards.tileTierTop', { tier: tierName(tiers[curIdx], lang) });

  const last = historyQ.data ? lastPointsMove(historyQ.data) : null;
  const historySub = historyQ.data
    ? last
      ? t('rewards.tileHistoryLast', { date: formatDate(last.createdAt, lang) })
      : t('rewards.tileHistoryEmpty')
    : undefined;
  const active = vouchersQ.data ? activeVoucherCount(vouchersQ.data) : undefined;
  const vouchersSub = active === undefined
    ? undefined
    : active > 0
      ? t('rewards.tileVouchers', { active: formatNumber(active, lang) })
      : t('loyalty.noVouchers');

  return (
    <>
      <Screen onRefresh={balanceQ.refetch}>
        <View style={styles.titleRow}>
          <Text variant="h1" accessibilityRole="header">{t('rewards.title')}</Text>
        </View>

        {/* Only on a day the server pays double (config.DOUBLE_POINTS_DAYS). */}
        <DoubleDayNote />

        {/* The balance, on the black card */}
        <HeroCard style={styles.pointsCard}>
          <Text variant="caption" color={colors.onHeroMuted}>
            {t('pay.yourPoints')}
          </Text>
          <Text variant="display" color={colors.onHero} style={styles.points}>
            {formatNumber(points, lang)}
          </Text>
          <BalanceWorth points={points} />
          <Text variant="caption" color={colors.onHeroMuted} style={styles.expiry}>
            {/* WHICH points, and WHEN — never "your points expire on X" for a
                balance made of grants months apart, and never "your points never
                expire" beside a rule that says every point does. Nothing is
                rendered at all when the member holds no live points. */}
            {balance.nextExpiry
              ? t('rewards.pointsExpireNext', {
                  points: formatNumber(balance.nextExpiry.amount, lang),
                  date: formatDayKey(balance.nextExpiry.on, lang),
                })
              : ''}
          </Text>
          <View style={styles.tierRow}>
            <TierBadge tier={balance.tier} onHero />
          </View>
          <WelcomeGiftNote points={balance.welcomeBonusPending} color={colors.onHero} />
        </HeroCard>

        {/* Points are money off the bill, in any amount: one row of amounts,
            and the confirmation in a sheet. Each button says the money; what
            it costs in points is in its spoken name and in the sheet. The old
            «رصيد نقاطك يساوي» card said the card's own sentence a second time
            at display size. */}
        <Text variant="title" style={styles.redeemTitle}>
          {t('rewards.redeemTitle')}
        </Text>
        {options.length === 0 ? (
          <Text variant="caption" color={colors.warmGray}>
            {t('rewards.noPointsYet')}
          </Text>
        ) : (
          <View style={styles.redeemRow}>
            {options.map((o) => {
              const jod = formatJOD(o.jod, lang);
              const cost = formatNumber(o.points, lang);
              return (
                <Pressable
                  key={o.id}
                  style={({ pressed }) => [
                    styles.redeemChip,
                    width < 360 && styles.redeemChipNarrow,
                    o.full && styles.redeemChipReward,
                    redeeming?.id === o.id && styles.redeemChipSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setRedeeming(o)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    o.full
                      ? t('rewards.redeemAllA11y', { jod, points: cost })
                      : t('rewards.redeemA11y', { jod, points: cost })
                  }
                >
                  <Text
                    variant="bodyBold"
                    color={redeeming?.id === o.id ? colors.onReward : o.full ? colors.reward : colors.primary}
                    center
                    style={styles.redeemAmount}
                  >
                    {o.full ? t('rewards.wholeBalance') : jod}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* The most an ordinary day pays, then the whole ladder in one line —
            both read off the dials. Owner, 2026-10-15: «لا نستخدم نقاطك نقود.
            ممكن نحكي كاش باك لغاية ٩%». The line under it names the floor
            (2%), so the ceiling is never read as everyone's rate. */}
        <Text variant="h2" color={colors.reward} center style={styles.headline}>
          {t('rewards.headline', range)}
        </Text>
        <Text variant="body" color={colors.warmGray} center style={styles.headlineSub}>
          {t('rewards.headlineSub', range)}
        </Text>

        {/* Four doors, in reading order: the history, the coupons, the tier,
            and how it all works. */}
        <View style={styles.tiles}>
          <RewardsTile
            icon="history"
            title={t('loyalty.history')}
            subline={historySub}
            onPress={() => router.push('/loyalty')}
          />
          <RewardsTile
            icon="ticket"
            title={t('profile.vouchers')}
            subline={vouchersSub}
            onPress={() => router.push('/vouchers')}
          />
          <RewardsTile
            icon="arrow-up"
            title={t('loyalty.tier')}
            subline={tierSub}
            onPress={() => router.push('/tiers')}
          />
          <RewardsTile
            icon="help"
            title={t('rewards.tileHow')}
            subline={t('pay.redeemHint')}
            onPress={() => setHowOpen(true)}
          />
        </View>
      </Screen>

      <RedeemSheet option={redeeming} onClose={() => setRedeeming(null)} />
      <HowItWorksSheet visible={howOpen} onClose={() => setHowOpen(false)} />
    </>
  );
}

function GuestRewards() {
  const { t, lang } = useI18n();
  const range = earnRangeCopy(lang);
  // Back here after the code, not to Home (lib/returnTo.ts).
  const login = () => router.push({ pathname: '/(auth)/login', params: { returnTo: '/rewards' } });

  return (
    <Screen>
      <View style={styles.titleRow}>
        <Text variant="h1" accessibilityRole="header">{t('rewards.title')}</Text>
      </View>

      <DoubleDayNote />

      <Text variant="h2" color={colors.reward} center style={styles.guestHeadline}>
        {t('rewards.headline', range)}
      </Text>
      <Text variant="body" color={colors.warmGray} center style={styles.headlineSub}>
        {t('rewards.headlineSub', range)}
      </Text>

      {/* Sign-in first, as Dunkin' UAE opens its Rewards page for a guest; a
          button that floats over the content, Starbucks' way, would cover it. */}
      <Button title={t('auth.loginToContinue')} onPress={login} />

      <Card style={styles.howCard}>
        <Text variant="title" center>
          {t('rewards.howItWorks')}
        </Text>
        <HowItWorksSteps />
      </Card>

      <Text variant="title" style={styles.sectionTitle}>
        {t('rewards.statusTitle')}
      </Text>
      <TierCards />

      <Button title={t('auth.loginToContinue')} onPress={login} style={styles.bottomCta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  skelHero: { marginBottom: spacing.lg },
  skelLine: { marginBottom: spacing.md },
  skelTile: { flexBasis: '47%', flexGrow: 1 },
  pointsCard: {
    alignItems: 'center',
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    overflow: 'hidden',
  },
  points: { fontVariant: ['tabular-nums'] },
  expiry: { fontSize: fontSize.xs, lineHeight: 20, marginTop: spacing.xs },
  tierRow: { marginVertical: spacing.xs },

  redeemTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  redeemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  redeemChip: {
    // Up to four in one row, sharing it equally.
    flexBasis: 0,
    flexGrow: 1,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.cardBg,
  },
  // Four amounts at ordinary phone widths; two per row at 320px so neither
  // Arabic money nor English “JOD” labels are squeezed or truncated.
  redeemChipNarrow: { flexBasis: '45%' },
  redeemChipReward: { borderColor: colors.reward },
  redeemChipSelected: { borderColor: colors.reward, backgroundColor: colors.reward },
  redeemAmount: { fontSize: fontSize.sm, lineHeight: 20, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.85 },

  headline: { marginTop: spacing.lg },
  guestHeadline: { marginTop: spacing.sm },
  headlineSub: { fontSize: fontSize.sm, lineHeight: 24, marginTop: spacing.xs, marginBottom: spacing.lg },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  howCard: { gap: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  bottomCta: { marginTop: spacing.xl },
});
