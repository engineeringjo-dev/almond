import { useState } from 'react';
import { View, StyleSheet, TextInput, Alert } from 'react-native';
import { Stack, router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { colors, spacing, radius, fontFamily } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';
import { useUpdateProfile } from '@/hooks/useLoyalty';
import { useAuthStore, useUser } from '@/stores/authStore';
import { MAX_NAME_LENGTH, isProfileComplete, normalizeName } from '@almond/shared/loyalty/profile';

/**
 * "Your details" — the member tells us who they are, and is paid once for it.
 *
 * Owner, 2026-09-08: «٥٠ نقطة اذا بحط معلوماته وبصير الاسم مربوط باسم التعريف
 * فبتصير مثلا صباح الخير حمزة».
 *
 * 🔴 THE +50 ON THE BUTTON IS A PREDICTION, NOT A PROMISE. It is computed from
 * the SHARED predicate so it agrees with the server's answer, but the number
 * the member is actually paid comes back in the reply and is what the toast
 * reports. If those two ever disagree, the member is told the truth — the one
 * that matches their balance — rather than the one this screen guessed.
 *
 * The birthday field is optional and deliberately does NOT gate the bonus: the
 * tier cards have promised a birthday benefit since before there was anywhere
 * to store one, so there has to be a field, but making 50 points conditional on
 * handing over a birthdate is not what was asked for.
 */
export default function ProfileDetailsScreen() {
  const { t, lang } = useI18n();
  const user = useUser();
  const setUser = useAuthStore((s) => s.setUser);
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState(user?.name ?? '');
  const [birthday, setBirthday] = useState('');

  // Has the member ALREADY been paid? The phone cannot know — the stamp lives
  // on the server. So the button offers the bonus only when there is nothing
  // stored yet, which is the case where it is certainly owed; after that it
  // simply says "Save". An unpromised +50 is a pleasant surprise, a promised
  // one that does not arrive is a complaint.
  const firstTime = !isProfileComplete({ name: user?.name ?? '', birthday: null });
  const willEarn = firstTime && isProfileComplete({ name, birthday: null });

  const onSave = () => {
    const clean = normalizeName(name);
    if (clean === '') {
      Alert.alert(t('details.nameRequiredTitle'), t('details.nameRequiredBody'));
      return;
    }
    updateProfile.mutate(
      { name: clean, birthday: birthday.trim() === '' ? null : birthday.trim() },
      {
        onSuccess: (res) => {
          // The name the SERVER stored, not the one typed — it normalized and
          // may have truncated it, and the greeting must match the record.
          if (user) setUser({ ...user, name: res.profile.name });
          Alert.alert(
            t('details.savedTitle'),
            // The reply's figure. 0 on every save after the first, and the
            // sentence changes rather than showing "+0 points".
            res.bonusGranted > 0
              ? t('details.savedBonus', { points: formatNumber(res.bonusGranted, lang) })
              : t('details.savedBody'),
          );
          router.back();
        },
        onError: () => Alert.alert(t('common.error'), t('details.saveFailed')),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t('profile.details') }} />
      <Screen>
        {willEarn ? (
          <Card style={styles.bonusCard}>
            <Text variant="bodyBold" color={colors.primary}>
              {t('details.bonusPitch', {
                points: formatNumber(config.PROFILE_COMPLETION_BONUS, lang),
              })}
            </Text>
          </Card>
        ) : null}

        <Card style={styles.form}>
          <Text variant="caption" color={colors.warmGray}>{t('details.nameLabel')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('details.namePlaceholder')}
            placeholderTextColor={colors.warmGray}
            maxLength={MAX_NAME_LENGTH}
            style={[styles.input, { textAlign: lang === 'ar' ? 'right' : 'left' }]}
            accessibilityLabel={t('details.nameLabel')}
            autoCapitalize="words"
          />

          <Text variant="caption" color={colors.warmGray} style={styles.label}>
            {t('details.birthdayLabel')}
          </Text>
          <TextInput
            value={birthday}
            onChangeText={setBirthday}
            // A day key, typed. Not a date picker: this screen ships to the web
            // too, and a native picker there is a different component. The
            // server refuses anything that is not YYYY-MM-DD.
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.warmGray}
            maxLength={10}
            keyboardType="numbers-and-punctuation"
            style={[styles.input, { textAlign: lang === 'ar' ? 'right' : 'left' }]}
            accessibilityLabel={t('details.birthdayLabel')}
          />
          <Text variant="caption" color={colors.warmGray}>{t('details.birthdayHint')}</Text>

          {/* The phone number is not editable here: OTP proved it, and changing
              it would change which account this is. */}
          {user?.phone ? (
            <Text variant="caption" color={colors.warmGray} style={styles.label}>
              {t('details.phoneFixed', { phone: user.phone })}
            </Text>
          ) : null}
        </Card>

        <Button
          title={
            willEarn
              ? t('details.saveAndEarn', {
                  points: formatNumber(config.PROFILE_COMPLETION_BONUS, lang),
                })
              : t('common.save')
          }
          onPress={onSave}
          disabled={updateProfile.isPending}
          loading={updateProfile.isPending}
          fullWidth
          style={styles.save}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  bonusCard: { marginBottom: spacing.md, backgroundColor: colors.neutralWarm },
  form: { gap: spacing.xs },
  label: { marginTop: spacing.md },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    color: colors.dark,
  },
  save: { marginTop: spacing.lg },
});
