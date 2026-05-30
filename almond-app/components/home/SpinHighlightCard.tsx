import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
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
      style={({ pressed }) => [styles.shadow, pressed && styles.pressed]}
      onPress={() => router.push('/spin')}
      accessibilityRole="button"
    >
      <Gradient preset="mocha" style={styles.card}>
        <View style={styles.iconWrap}>
          <Text style={styles.emoji}>🎡</Text>
        </View>
        <View style={styles.body}>
          <Text variant="title" color={colors.cream}>
            {t('home.spinWheel')}
          </Text>
          <Text variant="bodyBold" color={colors.lightGold}>
            {t('loyalty.winFree')}
          </Text>
          {eligibility?.canSpin ? (
            <Text variant="caption" color={colors.lightGold}>
              {t('spin.spinsLeft', { count: eligibility.spinsAvailable })}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>{lang === 'ar' ? '‹' : '›'}</Text>
      </Gradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.lg, ...shadow.raised },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    overflow: 'hidden',
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
