import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { HeroCard } from '@/components/ui/HeroCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { WelcomeGiftNote } from '@/components/loyalty/WelcomeGiftNote';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD, formatNumber } from '@/lib/format';
import { useLoyaltyBalance, useWallet } from '@/hooks/useLoyalty';
import { tierProgressCopy } from '@/lib/tierCopy';
import { useEarnSheetStore } from '@/stores/earnSheetStore';
// earn-arith-exempt: points→JOD for DISPLAY, via the one shared conversion. §7 T7.
import { jodFromPoints } from '@almond/shared/loyalty/earn';

/**
 * THE MEMBERSHIP CARD — Home's first block, and the one thing a member opens
 * the app at the counter to find.
 *
 * Owner, 2026-10-15: «نفذ ظهور الرمز أولاً» — the code first. The card's own
 * button opens «اجمع نقاطك», the same sheet the header's QR opens and the
 * launch opens by itself, so the code is one tap from the top of Home, never
 * scrolled to. Precedent: Starbucks' app puts "Scan in store" on the stars
 * card at the top of Home; Apple Wallet puts the card's code on the card.
 *
 * Points AND what they are worth: «نقاطك نقود» — 1 point is 1 qirsh
 * (POINTS_PER_JOD_REDEEM), so the balance is also a sum of money and the card
 * says which (jodFromPoints, the one shared conversion).
 *
 * The wallet is on the same card, one line under the points (expert panel,
 * 2026-10-15: «بطاقة واحدة للنقاط والمحفظة»). It was a second black card of its
 * own; the two balances are the member's money in two forms, read together at
 * the counter. The line opens the wallet, where the top-up is.
 *
 * No logo: the header above carries it, and a card is not a title.
 *
 * Black, like the shops' facades (HeroCard). Tapping the points opens the
 * rewards tab.
 */
export function LoyaltyCard() {
  const { t, lang } = useI18n();
  const { data, isLoading } = useLoyaltyBalance();
  const { data: wallet } = useWallet();
  const openEarnSheet = useEarnSheetStore((s) => s.open);

  if (isLoading || !data) {
    return (
      <View style={styles.shadow}>
        <HeroCard style={styles.card}>
          <Skeleton onHero width={120} height={14} />
          <Skeleton onHero width={180} height={40} />
          <Skeleton onHero width="100%" height={52} />
        </HeroCard>
      </View>
    );
  }

  const progress = tierProgressCopy(data, lang);
  const worth = formatJOD(jodFromPoints(data.points), lang);

  return (
    <View style={styles.shadow}>
      <HeroCard style={styles.card}>
        <Pressable
          onPress={() => router.push('/(tabs)/rewards')}
          accessibilityRole="button"
          accessibilityLabel={t('home.cardA11y', { points: formatNumber(data.points, lang), jod: worth })}
          style={styles.body}
        >
          <View style={styles.topRow}>
            <Text variant="caption" color={colors.onHeroMuted}>
              {t('home.loyaltyPoints')}
            </Text>
            <TierBadge tier={data.tier} onHero />
          </View>
          <View style={styles.pointsRow}>
            <Text variant="display" color={colors.onHero} style={styles.points}>
              {formatNumber(data.points, lang)}
            </Text>
            <Text variant="bodyBold" color={colors.onHeroMuted}>
              {t('home.pointsWorth', { jod: worth })}
            </Text>
          </View>
          {/* Progress in one sentence, from one place — lib/tierCopy.ts. */}
          {progress ? (
            <Text variant="caption" color={colors.onHeroMuted}>
              {t(progress.key, progress.params)}
            </Text>
          ) : null}
          <WelcomeGiftNote points={data.welcomeBonusPending} color={colors.onHero} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/profile/wallet')}
          style={({ pressed }) => [styles.walletRow, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Icon name="wallet" size={18} color={colors.onHeroMuted} />
          <Text variant="caption" color={colors.onHeroMuted}>
            {t('home.walletBalance')}
          </Text>
          <Text variant="bodyBold" color={colors.onHero} style={styles.walletAmount}>
            {formatJOD(wallet ?? 0, lang)}
          </Text>
          <Text variant="caption" color={colors.onHero} style={styles.topUp}>
            {t('home.topUp')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => openEarnSheet()}
          style={({ pressed }) => [styles.codeBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Icon name="qr" size={22} color={colors.hero} />
          <Text variant="bodyBold" color={colors.hero}>
            {t('home.showCode')}
          </Text>
        </Pressable>
      </HeroCard>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.xl, ...shadow.raised },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  /**
   * `flex` + `minWidth: 0` on the text column: the progress sentence is a
   * whole sentence and must wrap, not run off a card that clips (the
   * LoyaltyCard defect of 2026-09-08, reported from the live web build).
   */
  body: { gap: spacing.xs, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pointsRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: spacing.sm },
  points: { lineHeight: 42 },
  // The card's one action, as a light button on the black card: 52pt, the
  // height of the primary button (Button.tsx), so it reads as the action.
  codeBtn: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.onHero,
    borderRadius: radius.md,
  },
  /** The wallet line: under a rule, so it reads as the card's second balance
   *  and not as more of the points. 44pt, the smallest target. */
  walletRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.onHeroMuted,
    paddingTop: spacing.sm,
  },
  walletAmount: { flex: 1 },
  topUp: { fontWeight: '700', textDecorationLine: 'underline' },
  pressed: { opacity: 0.88 },
});
