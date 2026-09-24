import { useState } from 'react';
import { View, StyleSheet, Share, TextInput } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing, radius, fontFamily } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useAttachReferral, useReferral } from '@/hooks/useLoyalty';
import { apiErrorCode } from '@/lib/apiClient';
import { formatNumber } from '@/lib/format';

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
]);

export default function ReferralScreen() {
  const { t, lang } = useI18n();
  const { data, isLoading, isError, refetch } = useReferral();
  const attach = useAttachReferral();
  const [code, setCode] = useState('');

  const onShare = async () => {
    if (!data) return;
    await Share.share({ message: t('referral.shareMessage', { link: data.link, code: data.code }) });
  };

  const attachError = attach.isError
    ? (() => {
        const c = apiErrorCode(attach.error);
        return t(c && ATTACH_ERRORS.has(c) ? `referral.error.${c}` : 'referral.error.generic');
      })()
    : null;

  const points = formatNumber(data?.rewardPoints ?? 0, lang);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('referral.title') }} />
      <Screen loading={isLoading} error={isError} onRetry={refetch}>
        <View style={styles.hero}>
          <Text style={styles.emoji}>👥</Text>
          <Text variant="h1" center>
            {t('referral.headline', { points })}
          </Text>
          <Text variant="body" center color={colors.warmGray}>
            {t('referral.howItWorks', { points })}
          </Text>
        </View>

        <Card style={styles.codeCard}>
          <Text variant="caption" color={colors.warmGray}>
            {t('referral.yourCode')}
          </Text>
          <Text variant="display" color={colors.gold} style={styles.code}>
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
        <Button title={t('referral.share')} onPress={onShare} leadingIcon="share" />

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
  emoji: { fontSize: 64 },
  codeCard: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  code: { letterSpacing: 4 },
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
