import { createElement, useState } from 'react';
import { View, StyleSheet, TextInput, Alert, Platform } from 'react-native';
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
/**
 * THE BIRTHDAY IS PICKED, NOT TYPED. Owner, 2026-09-08: «العميل يختار من رزنامة
 * أسهل من تعبئة يدوية».
 *
 * This replaces a free-text `YYYY-MM-DD` field whose comment said a picker was
 * impossible — "this screen ships to the web too, and a native picker there is
 * a different component". That reasoning inverted once the shipping target was
 * checked: there is no `eas.json` and the only pipeline is `deploy-web.yml`, so
 * TODAY THIS SCREEN SHIPS TO THE WEB AND NOWHERE ELSE — and the web has a real
 * calendar built into the platform. `<input type="date">` opens the browser's
 * own date picker, is keyboard- and screen-reader-accessible for free, follows
 * the reader's locale, and needs no dependency.
 *
 * Its value format is `YYYY-MM-DD` — byte for byte what the server already
 * requires — so the contract does not move and neither does the parent's state.
 *
 * `max` is today: nobody was born tomorrow, and the browser enforces it before
 * the value ever reaches us. `min` is 1900-01-01 rather than unbounded so the
 * year spinner opens somewhere useful instead of at year 0.
 *
 * The native branch keeps the typed field. It is unreachable while there is no
 * native build; it stays so that adding one is not a regression, and it is the
 * one place a real native picker (a dependency, and a rebuild) would go.
 */
function BirthdayField({ value, onChange, label, align }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  align: 'left' | 'right';
}) {
  const today = new Date().toISOString().slice(0, 10);

  if (Platform.OS === 'web') {
    // A DOM node inside the RN tree: legal on react-native-web, and the only
    // way to reach the platform's calendar without pulling in a picker package.
    // Styled inline because a StyleSheet id means nothing to a raw <input>.
    return createElement('input', {
      type: 'date',
      value,
      max: today,
      min: '1900-01-01',
      'aria-label': label,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      style: {
        minHeight: 48,
        boxSizing: 'border-box',
        width: '100%',
        borderRadius: radius.md,
        border: 'none',
        outline: 'none',
        backgroundColor: colors.neutralWarm,
        paddingInline: spacing.md,
        fontFamily: fontFamily.regular,
        fontSize: 16,
        color: colors.dark,
        textAlign: align,
      },
    });
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={colors.warmGray}
      maxLength={10}
      keyboardType="numbers-and-punctuation"
      style={[styles.input, { textAlign: align }]}
      accessibilityLabel={label}
    />
  );
}

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
          <BirthdayField
            value={birthday}
            onChange={setBirthday}
            label={t('details.birthdayLabel')}
            align={lang === 'ar' ? 'right' : 'left'}
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
