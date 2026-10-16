import { createElement, useRef, useState } from 'react';
import { StyleSheet, TextInput, Platform, Pressable, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProfileBonusCelebration } from '@/components/loyalty/ProfileBonusCelebration';
import { colors, spacing, radius, fontFamily } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { choiceA11y, choiceGroupA11y, MIN_TOUCH_TARGET } from '@/lib/a11y';
import { birthdayInputText, birthdayISOFromInput } from '@/lib/birthdayInput';
import { formatNumber } from '@/lib/format';
import { notify } from '@/lib/dialog';
import { createProfileBonusFeedback } from '@/lib/profileBonusFeedback';
import { ltrIsolate, toWesternDigits } from '@almond/shared/lib/phone';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { useUpdateProfile } from '@/hooks/useLoyalty';
import { useAuthStore, useUser } from '@/stores/authStore';
import {
  GENDERS, MAX_NAME_LENGTH, isProfileComplete, normalizeName, type Gender,
} from '@almond/shared/loyalty/profile';

/**
 * "Your details" — the member tells us who they are, and is paid once for it.
 *
 * Owner, 2026-09-08: «٥٠ نقطة اذا بحط معلوماته وبصير الاسم مربوط باسم التعريف
 * فبتصير مثلا صباح الخير حمزة».
 *
 * The completion offer uses the SHARED predicate. The server's once-only stamp
 * and any points owed from an earlier refund still decide the actual credit.
 * The reply reports newly available and recovered points; this screen never
 * calculates either, and only the actual net credit chooses the feedback.
 *
 * 🔴 THE BONUS NOW NEEDS FOUR FACTS (owner, 2026-09-24): name, birth date,
 * gender — and the phone on record, which OTP already proved and which is
 * shown here, not typed. The member may save any subset; the +50 is predicted
 * (and paid by the server) only when all four are there.
 */
/**
 * THE BIRTHDAY KEEPS ITS CALENDAR. Owner, 2026-09-08: «العميل يختار من رزنامة
 * أسهل من تعبئة يدوية».
 *
 * Keep the browser's calendar, but not its locale-controlled visible order:
 * the owner requires DD/MM/YYYY in both languages. The field holds the whole
 * typed draft; only a valid date is converted to the server's unchanged ISO
 * value. A partial/invalid edit therefore cannot save an earlier valid value.
 * Native keeps the existing typed fallback, now in the same displayed order.
 */
function BirthdayField({ value, onChange, label, align }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  align: 'left' | 'right';
}) {
  const { t } = useI18n();
  const input = useRef<TextInput | null>(null);
  const calendar = useRef<HTMLInputElement | null>(null);
  const [calendarUnavailable, setCalendarUnavailable] = useState(false);
  const openCalendar = () => {
    try {
      if (calendar.current && typeof calendar.current.showPicker === 'function') {
        calendar.current.showPicker();
        return;
      }
    } catch { /* Keep the fixed-order field usable when the picker is blocked. */ }
    setCalendarUnavailable(true);
    input.current?.focus();
  };

  return (
    <View style={styles.birthday}>
      <View style={styles.birthdayRow}>
        <TextInput
          ref={input}
          value={value}
          onChangeText={(text) => onChange(toWesternDigits(text))}
          placeholder={t('details.birthdayPlaceholder')}
          placeholderTextColor={colors.warmGray}
          maxLength={10}
          keyboardType="numbers-and-punctuation"
          autoComplete={Platform.OS === 'web' ? 'off' : 'birthdate-full'}
          style={[styles.input, styles.birthdayInput, { textAlign: align }]}
          accessibilityLabel={label}
        />
        {Platform.OS === 'web' && !calendarUnavailable ? (
          <Pressable
            onPress={openCalendar}
            accessibilityRole="button"
            accessibilityLabel={t('details.birthdayCalendar')}
            style={({ pressed }) => [styles.calendarButton, pressed && styles.calendarPressed]}
          >
            <CalendarDays size={22} color={colors.dark} strokeWidth={1.8} accessible={false} />
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === 'web' ? (
        <>
          {calendarUnavailable ? <Text variant="caption" color={colors.warmGray} accessibilityLiveRegion="polite">{t('details.birthdayCalendarFallback')}</Text> : null}
          {/* The native input supplies the supported calendar only. Its
              locale-controlled editor never replaces the fixed-order field. */}
          {createElement('input', {
            ref: calendar,
            type: 'date',
            value: birthdayISOFromInput(value) ?? '',
            max: ammanDayKey(new Date()),
            min: '1900-01-01',
            'aria-label': t('details.birthdayCalendar'),
            'aria-hidden': true,
            tabIndex: -1,
            onChange: (e: { target: { value: string } }) => onChange(birthdayInputText(e.target.value)),
            style: { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' },
          })}
        </>
      ) : null}
    </View>
  );
}

export default function ProfileDetailsScreen() {
  const { t, lang } = useI18n();
  const user = useUser();
  const setUser = useAuthStore((s) => s.setUser);
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState(user?.name ?? '');
  const [birthday, setBirthday] = useState(() => birthdayInputText(user?.birthday ?? ''));
  const [gender, setGender] = useState<Gender | null>(user?.gender ?? null);
  const [bonusPoints, setBonusPoints] = useState<50 | null>(null);
  const [feedbackForReply] = useState(() => createProfileBonusFeedback());
  const savePending = useRef(false);

  // The phone does not know the server's once-only stamp or refund adjustment.
  // Show the completion offer while the locally stored profile is incomplete;
  // after saving, report only the server's actual net credit and recovery.
  const stored = { name: user?.name ?? '', birthday: user?.birthday ?? null, gender: user?.gender ?? null, phone: user?.phone };
  const firstTime = !isProfileComplete(stored);
  const typedBirthday = birthdayISOFromInput(birthday);
  const birthdayInvalid = birthday.trim() !== '' && typedBirthday === null;
  const willEarn = firstTime && isProfileComplete({ name, birthday: typedBirthday, gender, phone: user?.phone });

  const onSave = () => {
    if (savePending.current || bonusPoints !== null) return;
    const clean = normalizeName(name);
    if (clean === '') {
      notify(t('details.nameRequiredTitle'), t('details.nameRequiredBody'));
      return;
    }
    if (birthdayInvalid) {
      notify(t('details.birthdayInvalidTitle'), t('details.birthdayInvalidBody'));
      return;
    }
    savePending.current = true;
    updateProfile.mutate(
      { name: clean, birthday: typedBirthday, gender },
      {
        onSuccess: (res) => {
          const feedback = feedbackForReply(res);
          if (!feedback) return;
          // What the SERVER stored, not what was typed — it normalized and may
          // have truncated the name, and the greeting must match the record.
          if (user) {
            setUser({
              ...user, name: res.profile.name, birthday: res.profile.birthday, gender: res.profile.gender,
            });
          }
          if (feedback.kind === 'celebrate') {
            setBonusPoints(feedback.points);
            return;
          }
          notify(
            t('details.savedTitle'),
            feedback.kind === 'recovered'
              ? t(feedback.points > 0 ? 'details.savedBonusRecovered' : 'details.savedBonusRecoveredAll', {
                  points: formatNumber(feedback.points, lang),
                  recovered: formatNumber(feedback.recovered, lang),
                })
              : feedback.kind === 'bonus'
                ? t('details.savedBonus', { points: formatNumber(feedback.points, lang) })
                : t('details.savedBody'),
          );
          router.back();
        },
        onError: () => notify(t('common.error'), t('details.saveFailed')),
        onSettled: () => { savePending.current = false; },
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

          <Text variant="caption" color={colors.warmGray} style={styles.label}>
            {t('details.genderLabel')}
          </Text>
          {/* Two ids, never display text: the server stores 'male' | 'female'
              whatever language the member reads. */}
          <View style={styles.genderRow} {...choiceGroupA11y(false, t('details.genderLabel'))}>
            {GENDERS.map((g) => {
              const active = gender === g;
              return (
                <Pressable
                  key={g}
                  style={[styles.genderChip, active && styles.genderActive]}
                  onPress={() => setGender(g)}
                  // role + aria-checked: react-native-web drops accessibilityState,
                  // so the chosen answer was silent on the web build.
                  {...choiceA11y('radio', active, g === 'male' ? t('details.genderMale') : t('details.genderFemale'))}
                >
                  <Text variant="bodyBold" color={active ? colors.onInk : colors.warmGray}>
                    {g === 'male' ? t('details.genderMale') : t('details.genderFemale')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* The phone number is not editable here: OTP proved it, and changing
              it would change which account this is. */}
          {user?.phone ? (
            <Text variant="caption" color={colors.warmGray} style={styles.label}>
              {t('details.phoneFixed', { phone: ltrIsolate(user.phone) })}
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
          disabled={updateProfile.isPending || bonusPoints !== null}
          loading={updateProfile.isPending}
          fullWidth
          style={styles.save}
        />
      </Screen>
      {bonusPoints !== null ? (
        <ProfileBonusCelebration
          points={bonusPoints}
          onComplete={() => {
            setBonusPoints(null);
            router.back();
          }}
        />
      ) : null}
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
  birthday: { gap: spacing.sm },
  birthdayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  birthdayInput: { flex: 1, minWidth: 0, writingDirection: 'ltr', fontVariant: ['tabular-nums'] },
  calendarButton: { minWidth: MIN_TOUCH_TARGET, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.neutralWarm },
  calendarPressed: { opacity: 0.75 },
  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderChip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutralWarm,
  },
  genderActive: { backgroundColor: colors.primary },
});
