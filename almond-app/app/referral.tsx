import { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { Link, Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing, radius, fontFamily } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { useAttachReferral, useReferral } from '@/hooks/useLoyalty';
import { apiErrorCode } from '@/lib/apiClient';
import { formatNumber } from '@/lib/format';
import { copyReferralLink, openReferralWhatsApp, referralRewardState } from '@/lib/referralInvite';

/**
 * INVITE A FRIEND — and, for a new member, "I was invited".
 *
 * Owner, 2026-09-24: the REFERRER is paid config.REFERRAL_REWARD_POINTS once
 * per friend, when that friend's FIRST PAID order is confirmed — never at
 * signup, never for sharing. So this screen shows three server facts and does
 * no arithmetic of its own: the member's code and link, how many friends used
 * it, and how many of them have paid (= how often the member was paid).
 *
 * The "I have a friend's code" card appears only while the SERVER says it can
 * still succeed (`canAttach`: nothing attached and no paid order yet), so the
 * field is never offered to someone who would only be refused.
 */
const ATTACH_ERRORS = new Set([
  'referral_code_invalid', 'referral_code_not_found', 'referral_self', 'referral_same_phone',
  'referral_already_attached', 'referral_too_late',
  'referral_phone_unverified',
]);
const INVITE_FEEDBACK = {
  copied: 'referral.linkCopied',
  'copy-failed': 'referral.copyFailed',
  'whatsapp-failed': 'referral.whatsappFailed',
} as const;
const REWARD_COPY = {
  eligible: { title: 'referral.headline', body: 'referral.howItWorks' },
  'limit-reached': { title: 'referral.title', body: 'referral.capReachedBody' },
  ineligible: { title: 'referral.title', body: 'referral.ineligibleBody' },
} as const;

export default function ReferralScreen() {
  const { t, lang } = useI18n();
  const { data, isLoading, isError, refetch } = useReferral();
  const attach = useAttachReferral();
  const [code, setCode] = useState('');
  const [invitePending, setInvitePending] = useState<'whatsapp' | 'copy' | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<keyof typeof INVITE_FEEDBACK | null>(null);

  const onInvite = async (action: 'whatsapp' | 'copy') => {
    if (!data || invitePending) return;
    setInvitePending(action);
    setInviteFeedback(null);
    try {
      if (action === 'whatsapp') {
        await openReferralWhatsApp(t('referral.shareMessage', { link: data.link, code: data.code }));
      } else {
        await copyReferralLink(data.link);
        setInviteFeedback('copied');
      }
    } catch {
      setInviteFeedback(action === 'copy' ? 'copy-failed' : 'whatsapp-failed');
    } finally {
      setInvitePending(null);
    }
  };

  const attachError = attach.isError
    ? (() => {
        const c = apiErrorCode(attach.error);
        return t(c && ATTACH_ERRORS.has(c) ? `referral.error.${c}` : 'referral.error.generic');
      })()
    : null;

  const points = formatNumber(data?.rewardPoints ?? 0, lang);
  const rewardCopy = REWARD_COPY[data ? referralRewardState(data) : 'ineligible'];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('referral.title') }} />
      <Screen loading={isLoading} error={isError} onRetry={refetch}>
        <View style={styles.hero}>
          <Icon name="users" size={48} color={colors.dark} strokeWidth={1.5} />
          <Text variant="h1" center>
            {t(rewardCopy.title, { points })}
          </Text>
          <Text variant="body" center color={colors.warmGray}>
            {t(rewardCopy.body, { points })}
          </Text>
        </View>

        <Card style={styles.codeCard}>
          <Text variant="caption" color={colors.warmGray}>
            {t('referral.yourCode')}
          </Text>
          <Text variant="display" color={colors.gold} style={styles.code} selectable testID="referral-code">
            {data?.code}
          </Text>
          <View style={styles.statusPill}>
            <Text variant="caption" color={colors.brown}>
              {data && data.referredCount > 0
                ? t('referral.stats', {
                    referred: formatNumber(data.referredCount, lang),
                    rewarded: formatNumber(data.rewardedCount, lang),
                  })
                : t('referral.notUsed')}
            </Text>
          </View>
          {data && data.pointsEarned > 0 ? (
            <Text variant="bodyBold" color={colors.green}>
              {t('referral.earned', { points: formatNumber(data.pointsEarned, lang) })}
            </Text>
          ) : null}
        </Card>
        <View style={styles.inviteActions}>
          <Button
            title={t('referral.whatsapp')}
            onPress={() => { void onInvite('whatsapp'); }}
            leadingIcon="whatsapp"
            disabled={!data || invitePending !== null}
            loading={invitePending === 'whatsapp'}
          />
          <Button
            title={t('referral.copyLink')}
            onPress={() => { void onInvite('copy'); }}
            variant="outline"
            disabled={!data || invitePending !== null}
            loading={invitePending === 'copy'}
          />
          {inviteFeedback ? (
            <Text
              variant="caption"
              color={inviteFeedback === 'copied' ? colors.green : colors.red}
              role={inviteFeedback === 'copied' ? 'status' : 'alert'}
              accessibilityLiveRegion="polite"
            >
              {t(INVITE_FEEDBACK[inviteFeedback])}
            </Text>
          ) : null}
          <Text variant="caption" color={colors.warmGray}>{t('referral.yourLink')}</Text>
          <Text variant="caption" style={styles.link} selectable testID="referral-link">{data?.link}</Text>
        </View>

        {data ? (
          <View style={styles.policy}>
            <Text variant="bodyBold" role="heading" aria-level={2}>{t('referral.rewardConditions')}</Text>
            <Text variant="caption" color={colors.warmGray}>{t('referral.rewardRule', { points })}</Text>
            <Text variant="caption" color={colors.warmGray}>{t('referral.eligibilityPolicy')}</Text>
            <Text variant="caption" color={colors.warmGray}>
              {t('referral.lifetimeCap', { points: formatNumber(data.capPoints, lang) })}
            </Text>
            <Text variant="caption" color={colors.warmGray}>
              {t('referral.pointsRemaining', { points: formatNumber(data.remainingPoints, lang) })}
            </Text>
            {config.DATA_SOURCE === 'mock' && !data.eligibleForRewards ? (
              <Text variant="caption" color={colors.warmGray}>{t('referral.demoVerification')}</Text>
            ) : null}
            <Link href="/profile/policies" asChild>
              <Pressable
                accessibilityRole="link"
                style={({ pressed }) => [styles.policyLink, pressed && styles.policyLinkPressed]}
              >
                <Text variant="bodyBold" style={styles.policyLinkLabel}>{t('policies.title')}</Text>
              </Pressable>
            </Link>
          </View>
        ) : null}

        {data?.canAttach ? (
          <Card style={styles.attachCard}>
            <Text variant="bodyBold">{t('referral.haveCode')}</Text>
            <Text variant="caption" color={colors.warmGray}>
              {t('referral.haveCodeHint')}
            </Text>
            <TextInput
              value={code}
              onChangeText={(v) => { setCode(v); if (attach.isError) attach.reset(); }}
              placeholder={t('referral.codePlaceholder')}
              placeholderTextColor={colors.warmGray}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={16}
              style={[styles.input, { textAlign: lang === 'ar' ? 'right' : 'left' }]}
              accessibilityLabel={t('referral.haveCode')}
            />
            {attachError ? (
              <Text variant="caption" color={colors.red} accessibilityLiveRegion="polite">
                {attachError}
              </Text>
            ) : null}
            <Button
              title={t('referral.attach')}
              onPress={() => attach.mutate(code.trim())}
              disabled={code.trim() === ''}
              loading={attach.isPending}
              variant="outline"
            />
          </Card>
        ) : null}

        {data?.attachedCode ? (
          <Text variant="caption" center color={colors.warmGray} style={styles.attached}>
            {attach.data?.referrerDisplayName
              ? t('referral.attachedBy', { name: attach.data.referrerDisplayName })
              : t('referral.attached', { code: data.attachedCode })}
          </Text>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  codeCard: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  code: { letterSpacing: 4 },
  inviteActions: { gap: spacing.sm },
  link: { maxWidth: '100%', flexShrink: 1, writingDirection: 'ltr', textAlign: 'left' },
  policy: { gap: spacing.sm, marginTop: spacing.xl },
  policyLink: { minHeight: 44, justifyContent: 'center' },
  policyLinkPressed: { opacity: 0.7 },
  policyLinkLabel: { textDecorationLine: 'underline' },
  statusPill: {
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  attachCard: { gap: spacing.sm, marginTop: spacing.xl },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.dark,
  },
  attached: { marginTop: spacing.lg },
});
