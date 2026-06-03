import { View, StyleSheet, Pressable } from 'react-native';
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

/** Points reward catalog (Order Spec §3.2) — tiered by points cost. */
const REWARD_MENU: { points: number; labelKey: string; icon: IconName }[] = [
  { points: 100, labelKey: 'rewardItems.smallDrink', icon: 'coffee' },
  { points: 250, labelKey: 'rewardItems.mediumDrink', icon: 'cold' },
  { points: 400, labelKey: 'rewardItems.anyPastry', icon: 'pastries' },
  { points: 500, labelKey: 'rewardItems.largeCombo', icon: 'cake' },
];

const TIER_COLOR: Record<TierId, string> = {
  bean: colors.tierBean,
  silver: colors.tierSilver,
  gold: colors.tierGold,
  black: colors.tierBlack,
};

const TIER_BENEFITS: Record<TierId, string[]> = {
  bean: ['tierBenefits.bean1', 'tierBenefits.bean2'],
  silver: ['tierBenefits.silver1', 'tierBenefits.silver2'],
  gold: ['tierBenefits.gold1', 'tierBenefits.gold2', 'tierBenefits.gold3'],
  black: ['tierBenefits.black1', 'tierBenefits.black2', 'tierBenefits.black3'],
};

const STEPS: { icon: IconName; titleKey: string; bodyKey: string }[] = [
  { icon: 'qr', titleKey: 'rewards.step1Title', bodyKey: 'rewards.step1Body' },
  { icon: 'star', titleKey: 'rewards.step2Title', bodyKey: 'rewards.step2Body' },
  { icon: 'gift', titleKey: 'rewards.step3Title', bodyKey: 'rewards.step3Body' },
];

export default function RewardsScreen() {
  const { t, lang } = useI18n();
  const balanceQ = useLoyaltyBalance();
  const redeem = useRedeem();

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

  return (
    <Screen onRefresh={balanceQ.refetch}>
      <View style={styles.titleRow}>
        <Logo variant="badge" tone="dark" size={28} />
        <Text variant="h1">{t('rewards.title')}</Text>
      </View>

      {/* Points balance — pastel rainbow hero, dark text for contrast */}
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

      {/* §3.1 How it works — 3 steps */}
      <Text variant="title" style={styles.sectionTitle}>
        {t('rewards.howItWorks')}
      </Text>
      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <View key={s.titleKey} style={styles.step}>
            <View style={styles.stepIcon}>
              <Icon name={s.icon} size={22} color={colors.primary} strokeWidth={1.9} />
              <View style={styles.stepNum}>
                <Text variant="caption" color={colors.white} style={styles.stepNumText}>
                  {i + 1}
                </Text>
              </View>
            </View>
            <View style={styles.flex}>
              <Text variant="bodyBold">{t(s.titleKey)}</Text>
              <Text variant="caption" color={colors.warmGray}>
                {t(s.bodyKey)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* §3.2 Rewards menu — tiered catalog */}
      <Text variant="title" style={styles.sectionTitle}>
        {t('rewards.rewardsMenu')}
      </Text>
      <Text variant="caption" color={colors.warmGray} style={styles.sectionSub}>
        {t('rewards.rewardsMenuHint')}
      </Text>
      <View style={styles.rewardGrid}>
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

      {/* §3.3 Status cards per tier */}
      <Text variant="title" style={styles.sectionTitle}>
        {t('rewards.statusTitle')}
      </Text>
      <View style={styles.statusList}>
        {tiers.map((tr) => {
          const isCurrent = tr.id === currentTier.id;
          const reached = balance.windowSpend >= tr.threshold;
          return (
            <View
              key={tr.id}
              style={[
                styles.statusCard,
                { borderColor: TIER_COLOR[tr.id] },
                isCurrent && styles.statusCardCurrent,
              ]}
            >
              <View style={styles.statusHead}>
                <View style={[styles.tierDot, { backgroundColor: TIER_COLOR[tr.id] }]} />
                <Text variant="bodyBold" style={styles.flex}>
                  {t(`tiers.${tr.id}`)}
                </Text>
                {isCurrent ? (
                  <View style={styles.currentPill}>
                    <Text variant="caption" color={colors.white}>
                      {t('rewards.currentTier')}
                    </Text>
                  </View>
                ) : reached ? (
                  <Icon name="navigation" size={16} color={colors.green} />
                ) : (
                  <Text variant="caption" color={colors.warmGray}>
                    {tr.threshold} {t('common.currency')}
                  </Text>
                )}
              </View>

              {/* Progress bar towards the next tier — shown on the current tier */}
              {isCurrent ? (
                <View style={styles.progressBlock}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${segPct}%`, backgroundColor: TIER_COLOR[tr.id] }]} />
                  </View>
                  <Text variant="caption" color={colors.warmGray}>
                    {next
                      ? t('rewards.progressToNext', { remaining: remaining.toFixed(3), tier: t(`tiers.${next.id}`) })
                      : t('rewards.tierMax')}
                  </Text>
                </View>
              ) : null}

              <View style={styles.benefits}>
                {TIER_BENEFITS[tr.id].map((b) => (
                  <View key={b} style={styles.benefitRow}>
                    <Icon name="star" size={13} color={TIER_COLOR[tr.id]} strokeWidth={2} />
                    <Text variant="caption" color={colors.warmGray} style={styles.flex}>
                      {t(b)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
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

  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionSub: { marginBottom: spacing.md },

  steps: { gap: spacing.md },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    position: 'absolute',
    top: -4,
    end: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontSize: 10 },

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

  statusList: { gap: spacing.md },
  statusCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.neutralWarm,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  statusCardCurrent: { borderWidth: 2.5 },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tierDot: { width: 14, height: 14, borderRadius: 7 },
  currentPill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  progressBlock: { gap: spacing.xs },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutralWarm,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  benefits: { gap: spacing.xs },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
});
