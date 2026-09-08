import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Pressable, View, Share } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';
import { loyaltyService } from '@/services/loyalty.service';
import { useUser, useUserId } from '@/stores/authStore';
import { nextChallenge, type ChallengeId } from '@almond/shared/loyalty/challenges';

/**
 * THE ONBOARDING BANNER — one challenge at a time, on Home.
 *
 * Owner, 2026-09-08: «اول دخول بطلعله اول challenge: عبي معلومات وخذ ٥٠ نقطة …
 * بعد اول استخدام، خلي صاحبك ينزل التطبيق وخذ ٥٠ نقطة … وهذا بكون عالبانر».
 *
 * WHICH challenge is decided in @almond/shared/loyalty/challenges, not here, so
 * the ordering is testable without mounting a screen and cannot drift from what
 * the grant will actually pay. This component only renders it.
 *
 * 🔴 IT RENDERS NOTHING WHEN THE LADDER IS DONE — and that is the guard that
 * keeps the unadvertised once-per-account referral honest. The pitch does not
 * say "once" (the owner asked for that), but the moment the reward is spent the
 * offer is gone, so nobody is invited a fifth time to earn something they
 * cannot. Read the comment on config.REFERRAL_REWARD_POINTS before changing
 * this behaviour.
 *
 * The referral row SHARES rather than navigating: the whole mechanic is the
 * member handing a link to somebody, so the tap does the thing. The referral
 * screen still exists behind Profile for the code and the terms.
 */
export function ChallengeBanner() {
  const { t, lang } = useI18n();
  const user = useUser();
  const userId = useUserId();

  // The referral state is the SERVER'S — `alreadyRewarded` decides whether the
  // second rung is still offerable, and a client that decided it for itself
  // could re-offer a reward it has already been paid.
  const { data: referral } = useQuery({
    queryKey: ['loyalty', 'referral', userId],
    queryFn: () => loyaltyService.getReferralCode(userId),
  });

  // Guests are not on the ladder at all: they have no account to pay, and
  // "tell us your name" before "sign in" is the wrong order to ask in.
  if (!user || user.isGuest || !referral) return null;

  const challenge = nextChallenge({
    profile: { name: user.name ?? '' },
    referralRewarded: referral.alreadyRewarded,
  });
  if (!challenge) return null;

  const points = formatNumber(challenge.points, lang);
  const link = `${config.DELIVERY_REDIRECT_URL.replace('/order', '')}/app`;

  const ICON: Record<ChallengeId, IconName> = { profile: 'user', referral: 'gift' };

  const onPress = () => {
    if (challenge.id === 'profile') {
      router.push('/profile/details');
      return;
    }
    // Fire-and-forget: a share sheet the member dismisses is not an error, and
    // there is nothing to report either way. The REWARD is not granted here —
    // it is granted when a genuinely new phone joins (claimReferral), which is
    // why sharing ten times cannot pay ten times.
    void Share.share({ message: t('referral.shareMessage', { link, code: referral.code }) });
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(`challenge.${challenge.id}`, { points })}
      style={styles.wrap}
    >
      <View style={styles.icon}>
        <Icon name={ICON[challenge.id]} size={20} color={colors.primary} strokeWidth={1.9} />
      </View>
      <View style={styles.body}>
        <Text variant="bodyBold" color={colors.primary}>
          {t(`challenge.${challenge.id}`, { points })}
        </Text>
        <Text variant="caption" color={colors.warmGray}>
          {t(`challenge.${challenge.id}Sub`)}
        </Text>
      </View>
      <Text style={[styles.chevron, lang === 'ar' && styles.chevronRTL]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.neutralWarm,
    // Own spacing: this component is mounted unwrapped so that a finished
    // ladder leaves no gap on Home.
    marginBottom: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // flex + minWidth for the same reason as LoyaltyCard: this row clips on the
  // web build otherwise, and the sub-line is a full sentence.
  body: { flex: 1, minWidth: 0, gap: 2 },
  chevron: { fontSize: 24, lineHeight: 26, color: colors.primary },
  chevronRTL: { transform: [{ scaleX: -1 }] },
});
