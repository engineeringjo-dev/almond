import { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Gradient } from '@/components/ui/Gradient';
import { Logo } from '@/components/ui/Logo';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';
import { useLoyaltyBalance, useRedeem } from '@/hooks/useLoyalty';
import { tiers, tierFromSpend, nextTier } from '@/services/seed';
import type { TierId } from '@/types';

/**
 * Beans redemption ladder (§3.2) — modelled on Starbucks' tiered catalog
 * (25/60/100/200/300/400) with rising reward types + locked "X away" states.
 * The 60-beans flat discount is the simple, flexible option (§4.3).
 */
const REWARD_MENU: { points: number; labelKey: string; icon: IconName }[] = [
  { points: 25, labelKey: 'rewardItems.customization', icon: 'plus' },
  { points: 60, labelKey: 'rewardItems.flatDiscount', icon: 'gift' },
  { points: 100, labelKey: 'rewardItems.brewedCoffee', icon: 'coffee' },
  { points: 200, labelKey: 'rewardItems.handcraftedDrink', icon: 'cold' },
  { points: 300, labelKey: 'rewardItems.brunchPlate', icon: 'brunch' },
  { points: 400, labelKey: 'rewardItems.packagedCoffee', icon: 'cake' },
];

const TIER_COLOR: Record<TierId, string> = {
  bean: colors.tierBean,
  silver: colors.tierSilver,
  gold: colors.tierGold,
  black: colors.tierBlack,
};

// Tier perks are fair and cumulative: every higher tier inherits all lower-tier
// benefits (shown via the "inheritsPrevious" note). No service-speed or
// service-quality differentiation between tiers — only earning rate + offers.
const TIER_BENEFITS: Record<TierId, string[]> = {
  bean: ['tierBenefits.bean1', 'tierBenefits.bean2'],
  silver: ['tierBenefits.silver1', 'tierBenefits.silver2'],
  gold: ['tierBenefits.gold1', 'tierBenefits.gold2', 'tierBenefits.gold3'],
  black: ['tierBenefits.black1', 'tierBenefits.black2'],
};

const STEPS: { icon: IconName; titleKey: string; bodyKey: string }[] = [
  { icon: 'qr', titleKey: 'rewards.step1Title', bodyKey: 'rewards.step1Body' },
  { icon: 'bean', titleKey: 'rewards.step2Title', bodyKey: 'rewards.step2Body' },
  { icon: 'gift', titleKey: 'rewards.step3Title', bodyKey: 'rewards.step3Body' },
];

export default function RewardsScreen() {
  const { t, lang } = useI18n();
  const { width } = useWindowDimensions();
  const balanceQ = useLoyaltyBalance();
  const redeem = useRedeem();
  const [statusPage, setStatusPage] = useState(0);

  if (balanceQ.isLoading || balanceQ.isError || !balanceQ.data) {
    return <Screen loading={balanceQ.isLoading} error={balanceQ.isError} onRetry={balanceQ.refetch} />;
  }

  const balance = balanceQ.data;
  const points = balance.points;
  const worth = (points / config.POINTS_PER_JOD_REDEEM).toFixed(3);
  const redeemable = Math.floor(points / 100) * 100;

  const currentTier = tierFromSpend(balance.windowSpend);
  const next = nextTier(balance.windowSpend);
  const remaining = next ? Math.max(0, next.threshold - balance.windowSpend) : 0;
  const segFrom = currentTier.threshold;
  const segTo = next ? next.threshold : currentTier.threshold;
  const segPct = next
    ? Math.min(100, Math.max(0, ((balance.windowSpend - segFrom) / (segTo - segFrom)) * 100))
    : 100;

  // Status carousel sizing (full-bleed cards with a peek of the next).
  const cardW = width - spacing.lg * 2;
  const onStatusScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (cardW + spacing.md));
    if (idx !== statusPage) setStatusPage(idx);
  };

  return (
    <Screen onRefresh={balanceQ.refetch}>
      <View style={styles.titleRow}>
        <Logo variant="badge" tone="dark" size={28} />
        <Text variant="h1">{t('rewards.title')}</Text>
      </View>

      {/* Beans balance — pastel rainbow hero, dark text for contrast */}
      <Gradient preset="rainbow" style={styles.pointsCard}>
        <Text variant="caption" color={colors.brown}>
          {t('pay.yourPoints')}
        </Text>
        <Text variant="display" color={colors.dark}>
          {formatNumber(points, lang)}
        </Text>
        <Text variant="caption" color={colors.brown}>
          {t('pay.worth', { jod: worth })}
        </Text>
        <View style={styles.tierRow}>
          <TierBadge tier={balance.tier} />
        </View>
        {redeemable >= 100 ? (
          <Button
            title={`${t('loyalty.redeem')} · ${t('pay.redeemHint')}`}
            onPress={() => redeem.mutate(redeemable)}
            loading={redeem.isPending}
            style={styles.redeemBtn}
          />
        ) : null}
      </Gradient>

      {/* Headline (Starbucks "Free coffee is just the beginning") */}
      <Text variant="h2" center style={styles.headline}>
        {t('rewards.headline')}
      </Text>
      <Text variant="body" color={colors.warmGray} center style={styles.headlineSub}>
        {t('rewards.headlineSub')}
      </Text>

      {/* §3.1 How it works — one warm card, 3 rows */}
      <Card style={styles.howCard}>
        <Text variant="title" center style={styles.howTitle}>
          {t('rewards.howItWorks')}
        </Text>
        {STEPS.map((s) => (
          <View key={s.titleKey} style={styles.howRow}>
            <View style={styles.howIcon}>
              <Icon name={s.icon} size={22} color={colors.primary} strokeWidth={1.9} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyBold">{t(s.titleKey)}</Text>
              <Text variant="caption" color={colors.warmGray}>
                {t(s.bodyKey)}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      {/* §3.2 Rewards menu — tiered redemption ladder */}
      <Text variant="title" style={styles.sectionTitle}>
        {t('rewards.rewardsMenu')}
      </Text>
      <Text variant="caption" color={colors.warmGray} style={styles.sectionSub}>
        {t('rewards.rewardsMenuHint')}
      </Text>
      <View style={styles.rewardGrid}>
        {/* Each reward is a max value; pay the difference if the item costs more */}
        {REWARD_MENU.map((r) => {
          const unlocked = points >= r.points;
          const jod = (r.points / config.POINTS_PER_JOD_REDEEM).toFixed(3);
          return (
            <Card key={r.points} style={[styles.rewardCard, !unlocked && styles.rewardLocked]}>
              <View style={[styles.rewardThumb, unlocked && styles.rewardThumbOn]}>
                <Icon
                  name={r.icon}
                  size={30}
                  color={unlocked ? colors.primary : colors.warmGray}
                  strokeWidth={1.7}
                />
              </View>
              <Text variant="bodyBold" center numberOfLines={2} style={styles.rewardName}>
                {t(r.labelKey)}
              </Text>
              <Text variant="price">{t('rewards.redeemAt', { points: r.points })}</Text>
              <Text variant="caption" color={colors.warmGray}>
                {t('pay.worth', { jod })}
              </Text>
              <View style={[styles.rewardStatus, unlocked ? styles.rewardStatusOn : styles.rewardStatusOff]}>
                <Text variant="caption" color={unlocked ? colors.green : colors.warmGray}>
                  {unlocked ? t('rewards.unlocked') : t('rewards.away', { points: r.points - points })}
                </Text>
              </View>
            </Card>
          );
        })}
      </View>
      <Text variant="caption" color={colors.warmGray} style={styles.maxHint}>
        {t('rewards.maxValueHint')}
      </Text>

      {/* §3.3 Status — large, full-colour swipeable cards (Starbucks pattern) */}
      <Text variant="title" style={styles.sectionTitle}>
        {t('rewards.routineTitle')}
      </Text>
      <Text variant="caption" color={colors.warmGray} style={styles.sectionSub}>
        {t('rewards.routineSub')}
      </Text>

      <ScrollView
        horizontal
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={cardW + spacing.md}
        showsHorizontalScrollIndicator={false}
        onScroll={onStatusScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.statusScroll}
      >
        {tiers.map((tr) => {
          const isCurrent = tr.id === currentTier.id;
          const isBlack = tr.id === 'black';
          const fg = isBlack ? colors.gold : colors.white;
          const sub = tr.id === 'bean'
            ? t('rewards.statusSubBelow', { spend: tiers[1].threshold })
            : t('rewards.statusSubAbove', { spend: tr.threshold });
          return (
            <View key={tr.id} style={[styles.statusCard, { width: cardW, backgroundColor: TIER_COLOR[tr.id] }]}>
              {isCurrent ? (
                <View style={styles.currentPill}>
                  <Text variant="caption" color={TIER_COLOR[tr.id]} style={styles.currentPillText}>
                    {t('rewards.currentTier')}
                  </Text>
                </View>
              ) : null}

              <Text variant="h2" center color={fg}>
                {t(`tiers.${tr.id}`)}
              </Text>
              <Text variant="caption" center color={fg} style={styles.statusSub}>
                {sub}
              </Text>

              {isCurrent && next ? (
                <View style={styles.progressBlock}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${segPct}%` }]} />
                  </View>
                  <Text variant="caption" center color={fg}>
                    {t('rewards.progressToNext', { remaining: remaining.toFixed(3), tier: t(`tiers.${next.id}`) })}
                  </Text>
                </View>
              ) : null}

              <View style={styles.benefits}>
                {TIER_BENEFITS[tr.id].map((b) => (
                  <View key={b} style={styles.benefitRow}>
                    <Icon name="bean" size={15} color={fg} strokeWidth={2} />
                    <Text variant="caption" color={fg} style={styles.flex}>
                      {t(b)}
                    </Text>
                  </View>
                ))}
                {tr.id !== 'bean' ? (
                  <Text variant="caption" color={fg} style={styles.inherits}>
                    {t('rewards.inheritsPrevious')}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Page dots */}
      <View style={styles.dots}>
        {tiers.map((tr, i) => (
          <View key={tr.id} style={[styles.dot, i === statusPage && styles.dotActive]} />
        ))}
      </View>

      {/* History */}
      <Pressable style={styles.historyLink} onPress={() => router.push('/loyalty')} hitSlop={8}>
        <Icon name="history" size={18} color={colors.brown} />
        <Text variant="bodyBold" color={colors.brown}>
          {t('rewards.viewHistory')}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  flex: { flex: 1 },
  pointsCard: {
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  tierRow: { marginTop: spacing.sm },
  redeemBtn: { marginTop: spacing.md, alignSelf: 'stretch' },

  headline: { marginTop: spacing.xl },
  headlineSub: { marginTop: spacing.xs, marginBottom: spacing.lg },

  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionSub: { marginBottom: spacing.md },

  // How it works — one warm card with 3 rows
  howCard: { gap: spacing.lg },
  howTitle: { marginBottom: spacing.xs },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  howIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rewardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  rewardCard: { width: '47.5%', flexGrow: 1, alignItems: 'center', gap: spacing.xs },
  rewardLocked: { opacity: 0.7 },
  rewardThumb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  rewardThumbOn: { backgroundColor: colors.neutralWarm },
  rewardName: { minHeight: 38 },
  rewardStatus: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  rewardStatusOn: { backgroundColor: 'rgba(45,106,79,0.12)' },
  rewardStatusOff: { backgroundColor: colors.cream },
  maxHint: { marginTop: spacing.sm },

  // Status carousel
  statusScroll: { gap: spacing.md },
  statusCard: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    minHeight: 280,
    ...shadow.card,
  },
  currentPill: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    marginBottom: spacing.xs,
  },
  currentPillText: { fontWeight: '700' },
  statusSub: { marginBottom: spacing.md, opacity: 0.9 },
  progressBlock: { gap: spacing.xs, marginBottom: spacing.md },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#FFFFFF' },
  benefits: { gap: spacing.sm, marginTop: spacing.xs },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inherits: { marginTop: spacing.xs, fontStyle: 'italic', opacity: 0.9 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.neutralWarm },
  dotActive: { backgroundColor: colors.primary, width: 18 },

  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
});
