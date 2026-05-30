import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useSpinEligibility } from '@/hooks/useLoyalty';

/**
 * Prominent Spin-the-Wheel card on Home (Revision Pack §D + §O): not buried in
 * the quick-action grid. Bold "win for free" copy + live spin availability.
 */
export function SpinHighlightCard() {
  const { t, lang } = useI18n();
  const { data: eligibility } = useSpinEligibility();

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push('/spin')}
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <Text style={styles.emoji}>🎡</Text>
      </View>
      <View style={styles.body}>
        <Text variant="title" color={colors.cream}>
          {t('home.spinWheel')}
        </Text>
        <Text variant="bodyBold" color={colors.gold}>
          {t('loyalty.winFree')}
        </Text>
        {eligibility?.canSpin ? (
          <Text variant="caption" color={colors.lightGold}>
            {t('spin.spinsLeft', { count: eligibility.spinsAvailable })}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>{lang === 'ar' ? '‹' : '›'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.brown,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    ...shadow.raised,
  },
  pressed: { opacity: 0.9 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 30 },
  body: { flex: 1, gap: 2 },
  chevron: { fontSize: 28, color: colors.lightGold },
});
