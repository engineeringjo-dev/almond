import { View, StyleSheet, Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { activeBonusDay } from '@/lib/bonusDay';
import { usePromoStore } from '@/stores/promoStore';

/**
 * Activatable "Double Beans Day" banner (variable-reward lever). Shows only when
 * today qualifies; the member must tap Activate to earn the bonus that day.
 */
export function BonusDayBanner() {
  const { t, lang } = useI18n();
  const activatedDate = usePromoStore((s) => s.activatedDate);
  const activate = usePromoStore((s) => s.activate);
  const isActivatedToday = usePromoStore((s) => s.isActivatedToday);

  const day = activeBonusDay();
  if (!day) return null;

  const label = lang === 'ar' ? day.labelAr : day.labelEn;
  const activated = isActivatedToday();
  // referencing activatedDate keeps this re-rendering when activation changes
  void activatedDate;

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Icon name="bean" size={22} color={colors.white} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text variant="bodyBold" color={colors.white}>
          {t('bonusDay.title', { label })}
        </Text>
        <Text variant="caption" color={colors.cream}>
          {activated
            ? t('bonusDay.activated', { mult: day.multiplier })
            : t('bonusDay.body', { mult: day.multiplier })}
        </Text>
      </View>
      {!activated ? (
        <Pressable style={styles.cta} onPress={activate} accessibilityRole="button">
          <Text variant="caption" color={colors.dark} style={styles.ctaText}>
            {t('bonusDay.activate')}
          </Text>
        </Pressable>
      ) : (
        <Icon name="navigation" size={20} color={colors.lightGold} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.dark,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  cta: {
    backgroundColor: colors.lightGold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  ctaText: { fontWeight: '700' },
});
