import { StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useReferral } from '@/hooks/useLoyalty';
import { formatNumber } from '@/lib/format';
import { referralRewardState } from '@/lib/referralInvite';
import { useUser } from '@/stores/authStore';
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
 * The referral rung now STAYS once the profile is done: since 2026-09-24 the
 * referrer is paid once per FRIEND, on that friend's first paid order, so the
 * offer is honoured every time it is taken up and there is no spent state to
 * hide it on (config.REFERRAL_REWARD_POINTS, loyalty/challenges.ts).
 *
 * The referral row opens the invitation screen, where the member explicitly
 * chooses WhatsApp or copies the link. It never opens a generic share chooser.
 */
export function ChallengeBanner() {
  const { t, lang } = useI18n();
  const user = useUser();
  // The code and the link are the SERVER'S (GET /v1/me/referral).
  const { data: referral } = useReferral();

  // Guests are not on the ladder at all: they have no account to pay, and
  // "tell us your name" before "sign in" is the wrong order to ask in.
  if (!user || user.isGuest || !referral) return null;

  // The FOUR facts the bonus is paid on (name, birth date, gender, phone) —
  // the same shared predicate the server pays with, so the rung disappears
  // exactly when the profile would be paid, not when a name alone is typed.
  const challenge = nextChallenge({
    profile: { name: user.name ?? '', birthday: user.birthday ?? null, gender: user.gender ?? null, phone: user.phone },
  });
  if (!challenge) return null;

  const points = formatNumber(challenge.points, lang);
  const rewardState = referralRewardState(referral);
  const unavailable = challenge.id === 'referral' && rewardState !== 'eligible';
  const title = unavailable ? t('referral.title') : t(`challenge.${challenge.id}`, { points });
  const subline = unavailable
    ? t(rewardState === 'limit-reached' ? 'referral.capReachedShort' : 'referral.rewardConditions')
    : t(`challenge.${challenge.id}Sub`);

  const ICON: Record<ChallengeId, IconName> = { profile: 'user', referral: 'gift' };

  const onPress = () => {
    if (challenge.id === 'profile') {
      router.push('/profile/details');
      return;
    }
    router.push('/referral');
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={styles.wrap}
    >
      <View style={styles.icon}>
        <Icon name={ICON[challenge.id]} size={20} color={colors.primary} strokeWidth={1.9} />
      </View>
      <View style={styles.body}>
        <Text variant="bodyBold" color={colors.primary}>
          {title}
        </Text>
        <Text variant="caption" color={colors.warmGray}>
          {subline}
        </Text>
      </View>
      <Icon name={lang === 'ar' ? 'chevron-left' : 'chevron-right'} size={20} color={colors.dark} />
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
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // flex + minWidth for the same reason as LoyaltyCard: this row clips on the
  // web build otherwise, and the sub-line is a full sentence.
  body: { flex: 1, minWidth: 0, gap: 2 },
});
