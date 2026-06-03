import { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Gradient } from '@/components/ui/Gradient';
import { Logo } from '@/components/ui/Logo';
import { Skeleton } from '@/components/ui/Skeleton';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { BonusDayBanner } from '@/components/loyalty/BonusDayBanner';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber, formatDate } from '@/lib/format';
import { useLoyaltyBalance, useRedeemReward } from '@/hooks/useLoyalty';
import { tiers, tierFromSpend, nextTier } from '@/services/seed';
import i18n from '@/lib/i18n';
import type { TierId } from '@/types';

/**
 * Beans redemption ladder (§3.2) — modelled on Starbucks' tiered catalog
 * (25/60/100/200/300/400) with rising reward types + locked "X away" states.
 * The 60-beans flat discount is the simple, flexible option (§4.3).
 */
const REWARD_MENU: {
  points: number;
  labelKey: string;
  icon: IconName;
  type: 'free-item' | 'discount';
}[] = [
  { points: 25, labelKey: 'rewardItems.customization', icon: 'plus', type: 'discount' },
  { points: 60, labelKey: 'rewardItems.flatDiscount', icon: 'gift', type: 'discount' },
  { points: 100, labelKey: 'rewardItems.brewedCoffee', icon: 'coffee', type: 'free-item' },
  { points: 200, labelKey: 'rewardItems.handcraftedDrink', icon: 'cold', type: 'free-item' },
  { points: 300, labelKey: 'rewardItems.brunchPlate', icon: 'brunch', type: 'free-item' },
  { points: 400, labelKey: 'rewardItems.packagedCoffee', icon: 'cake', type: 'free-item' },
];

const TIER_COLOR: Record<TierId, string> = {
  bean: colors.tierBean,
  silver: colors.tierSilver,
  gold: colors.tierGold,
  black: colors.tierBlack,
};

// Full per-tier benefit lists (each card is self-contained, Starbucks-style).
// Tiers differ ONLY by reward generosity (earn rate, no-expiry, extra bonus
// days, exclusive perks) — never by service/treatment. Shared benefits (free
// monthly customization, birthday drink, personalized offers, reload bonus,
// personal-cup bonus) are identical for everyone — no treatment discrimination.
type Benefit = { icon: IconName; key: string };
const B = {
  birthday: { icon: 'gift', key: 'tierBenefits.birthday' } as Benefit,
  freeMod: { icon: 'sparkles', key: 'tierBenefits.freeMod' } as Benefit,
  offers: { icon: 'ticket', key: 'tierBenefits.offers' } as Benefit,
  reload: { icon: 'coins', key: 'tierBenefits.reloadBonus' } as Benefit,
  cup: { icon: 'coffee', key: 'tierBenefits.cupBonus' } as Benefit,
  noExpire: { icon: 'history', key: 'tierBenefits.noExpire' } as Benefit,
};
const SHARED: Benefit[] = [B.birthday, B.freeMod, B.offers, B.reload, B.cup];
const earn = (key: string): Benefit => ({ icon: 'bean', key });

const TIER_BENEFITS: Record<TierId, Benefit[]> = {
  bean: [earn('tierBenefits.earnBean'), ...SHARED],
  silver: [earn('tierBenefits.earnSilver'), ...SHARED],
  gold: [earn('tierBenefits.earnGold'), B.noExpire, ...SHARED, { icon: 'sparkles', key: 'tierBenefits.doubleDays4' }],
  black: [
    earn('tierBenefits.earnBlack'), B.noExpire, ...SHARED,
    { icon: 'globe', key: 'tierBenefits.experiences' },
    { icon: 'card', key: 'tierBenefits.memberCard' },
    { icon: 'sparkles', key: 'tierBenefits.doubleDays6' },
  ],
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
  const redeemReward = useRedeemReward();
  const [statusPage, setStatusPage] = useState(0);

  if (balanceQ.isError) {
    return <Screen error onRetry={balanceQ.refetch} />;
  }
  if (balanceQ.isLoading || !balanceQ.data) {
    return (
      <Screen>
        <View style={styles.titleRow}>
          <Logo variant="badge" tone="dark" size={28} />
          <Text variant="h1">{t('rewards.title')}</Text>
        </View>
        <Skeleton height={180} style={styles.skelHero} />
        <Skeleton width="55%" height={22} style={styles.skelLine} />
        <View style={styles.rewardGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.rewardCell}>
              <Skeleton height={150} />
            </View>
          ))}
        </View>
      </Screen>
    );
  }

  const balance = balanceQ.data;
  const points = balance.points;

  const onRedeem = (r: (typeof REWARD_MENU)[number]) => {
    if (points < r.points || redeemReward.isPending) return;
    const item = t(r.labelKey);
    Alert.alert(t('rewards.confirmTitle'), t('rewards.confirmBody', { item, beans: r.points }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('rewards.redeemCta'),
        onPress: () =>
          redeemReward.mutate(
            {
              beans: r.points,
              titleAr: i18n.t(r.labelKey, { lng: 'ar' }),
              titleEn: i18n.t(r.labelKey, { lng: 'en' }),
              type: r.type,
              value: r.points / config.POINTS_PER_JOD_REDEEM,
            },
            { onSuccess: () => Alert.alert(t('rewards.redeemedTitle'), t('rewards.redeemedBody', { item })) },
          ),
      },
    ]);
  };

  const currentTier = tierFromSpend(balance.windowSpend);
  const next = nextTier(balance.windowSpend);
  const remaining = next ? Math.max(0, next.threshold - balance.windowSpend) : 0;
  const segFrom = currentTier.threshold;
  const segTo = next ? next.threshold : currentTier.threshold;
  const segPct = next
    ? Math.min(100, Math.max(0, ((balance.windowSpend - segFrom) / (segTo - segFrom)) * 100))
    : 100;

  // Status carousel: cards are narrower than the screen so the NEXT tier card
  // peeks in — a clear signal there's more than one. Arrows + dots reinforce it.
  const statusRef = useRef<ScrollView>(null);
  const cardW = width - spacing.lg * 2 - 40;
  const step = cardW + spacing.md;
  const onStatusScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / step);
    if (idx !== statusPage) setStatusPage(idx);
  };
  const goToTier = (i: number) => {
    const idx = Math.max(0, Math.min(tiers.length - 1, i));
    statusRef.current?.scrollTo({ x: idx * step, animated: true });
    setStatusPage(idx);
  };

  return (
    <Screen onRefresh={balanceQ.refetch}>
      <View style={styles.titleRow}>
        <Logo variant="badge" tone="dark" size={28} />
        <Text variant="h1">{t('rewards.title')}</Text>
      </View>

      {/* Activatable Double Beans Day (only renders when today qualifies) */}
      <View style={styles.bannerWrap}>
        <BonusDayBanner />
      </View>

      {/* Beans balance — pastel rainbow hero, dark text for contrast */}
      <Gradient preset="rainbow" style={styles.pointsCard}>
        <Text variant="caption" color={colors.brown}>
          {t('pay.yourPoints')}
        </Text>
        <Text variant="display" color={colors.dark}>
          {formatNumber(points, lang)} ☕
        </Text>
        <Text variant="caption" color={colors.brown}>
          {balance.beansExpireAt
            ? t('rewards.beansExpire', { date: formatDate(balance.beansExpireAt, lang) })
            : t('rewards.beansNeverExpire')}
        </Text>
        <View style={styles.tierRow}>
          <TierBadge tier={balance.tier} />
        </View>
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
            <Pressable
              key={r.points}
              style={styles.rewardCell}
              onPress={() => onRedeem(r)}
              disabled={!unlocked}
              accessibilityRole="button"
            >
              <Card style={[styles.rewardCard, !unlocked && styles.rewardLocked]}>
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
                    {unlocked ? t('rewards.redeemCta') : t('rewards.away', { points: r.points - points })}
                  </Text>
                </View>
              </Card>
            </Pressable>
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
        {t('rewards.routineSub')} · {t('rewards.swipeTiers')}
      </Text>

      <ScrollView
        ref={statusRef}
        horizontal
        decelerationRate="fast"
        snapToInterval={step}
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        onScroll={onStatusScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.statusScroll}
      >
        {tiers.map((tr) => {
          const isCurrent = tr.id === currentTier.id;
          const fg = colors.white; // tier colours are all dark enough for white text
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
                  <View key={b.key} style={styles.benefitRow}>
                    <Icon name={b.icon} size={16} color={fg} strokeWidth={1.9} />
                    <Text variant="caption" color={fg} style={styles.flex}>
                      {t(b.key)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Carousel controls: ‹ arrows + dots + › so 4 tiers are obvious */}
      <View style={styles.carouselNav}>
        <Pressable
          onPress={() => goToTier(statusPage - 1)}
          disabled={statusPage === 0}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={[styles.chevron, statusPage === 0 && styles.chevronOff]}>‹</Text>
        </Pressable>

        <View style={styles.dots}>
          {tiers.map((tr, i) => (
            <Pressable key={tr.id} onPress={() => goToTier(i)} hitSlop={8}>
              <View style={[styles.dot, i === statusPage && styles.dotActive]} />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => goToTier(statusPage + 1)}
          disabled={statusPage === tiers.length - 1}
          hitSlop={10}
          accessibilityRole="button"
        >
          <Text style={[styles.chevron, statusPage === tiers.length - 1 && styles.chevronOff]}>›</Text>
        </Pressable>
      </View>
      <Text variant="caption" color={colors.warmGray} center style={styles.counter}>
        {t('rewards.tierCounter', { n: statusPage + 1, total: tiers.length })}
      </Text>

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
  bannerWrap: { marginBottom: spacing.lg },
  flex: { flex: 1 },
  skelHero: { marginBottom: spacing.lg },
  skelLine: { marginBottom: spacing.md },
  pointsCard: {
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  tierRow: { marginTop: spacing.sm },

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
  rewardCell: { width: '47.5%', flexGrow: 1 },
  rewardCard: { alignItems: 'center', gap: spacing.xs },
  rewardLocked: { opacity: 0.7 },
  rewardThumb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.neutralWarm,
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
  rewardStatusOn: { backgroundColor: 'rgba(108,92,180,0.12)' },
  rewardStatusOff: { backgroundColor: colors.neutralWarm },
  maxHint: { marginTop: spacing.sm },

  // Status carousel
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
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },

  statusScroll: { gap: spacing.md, paddingEnd: 40 },
  carouselNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  chevron: { fontSize: 30, lineHeight: 34, color: colors.primary, paddingHorizontal: spacing.sm },
  chevronOff: { color: colors.neutralWarm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.neutralWarm },
  dotActive: { backgroundColor: colors.primary, width: 22 },
  counter: { marginTop: spacing.xs },

  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
});
