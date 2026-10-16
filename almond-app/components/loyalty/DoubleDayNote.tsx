import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, fontFamily, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { activeDoubleDay } from '@almond/shared/loyalty/earn';

/**
 * «نقاط مضاعفة اليوم بمناسبة …» — one line above the black card on a day the
 * server pays double (config.DOUBLE_POINTS_DAYS, by the Amman day of the sale).
 * Nothing renders on any other day.
 *
 * 🔴 IT REPLACES BonusDayBanner, WHICH NEVER SHOWED. That banner read
 * config.BONUS_BEAN_DAY, a tap-to-activate weekday that was retired with
 * `enabled: false` (2026-09-06) and that the server refuses to pay anyway
 * (bonusDayActivated is pinned to false, D2). The double days the owner
 * approved on 2026-10-15 are the calendar here — the same one Home's nudge
 * and computeEarn read — so the line says only what the receipt will carry.
 *
 * Information, not a button: there is nothing to activate. It is the place
 * the page-division prompt keeps for a deal of the week as well, if the owner
 * approves one (Dunkin' panel, question 3).
 */
export function DoubleDayNote() {
  const { t, lang } = useI18n();
  const today = activeDoubleDay();
  if (!today) return null;
  return (
    <View style={styles.note}>
      <Icon name="sparkles" size={18} color={colors.dark} strokeWidth={2} />
      <Text variant="caption" color={colors.dark} style={styles.text}>
        {t('home.nudgeDoubleToday', { name: lang === 'ar' ? today.nameAr : today.nameEn })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  // The caption's size in the medium face: a notice, not a heading.
  text: { flex: 1, fontFamily: fontFamily.medium },
});
