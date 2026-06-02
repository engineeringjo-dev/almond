import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Gradient } from '@/components/ui/Gradient';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useUsualOrder } from '@/hooks/useOrder';
import { useCartStore, lineUnitPrice } from '@/stores/cartStore';
import { iconForItem } from '@/lib/productIcon';
import { formatJOD } from '@/lib/format';

/** "طلبك المعتاد" one-tap reorder card (section 4.4 #3, 7.2). */
export function UsualOrderCard() {
  const { t, lang } = useI18n();
  const usual = useUsualOrder();
  const addLine = useCartStore((s) => s.addLine);

  if (!usual) return null;

  const summary = usual.items
    .map((i) => `${i.qty}× ${lang === 'ar' ? i.nameAr : i.nameEn}`)
    .join('، ');
  const total = usual.items.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0);

  const addAll = () => {
    usual.items.forEach((i) => addLine({ ...i }));
    router.push('/(tabs)/cart');
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.shadow, pressed && styles.pressed]}
      onPress={addAll}
      accessibilityRole="button"
    >
      <Gradient preset="purple" style={styles.card}>
        <View style={styles.iconWrap}>
          <Icon name={iconForItem(usual.items[0]?.itemId ?? '')} size={26} color={colors.white} strokeWidth={1.7} />
        </View>
        <View style={styles.body}>
          <Text variant="caption" color={colors.white} style={styles.label}>
            {t('home.usualOrder')}
          </Text>
          <Text variant="bodyBold" color={colors.white} numberOfLines={1}>
            {summary}
          </Text>
          <Text variant="caption" color={colors.white}>
            {t('home.usualOrderCta')} · {formatJOD(total, lang)}
          </Text>
        </View>
        <Text style={styles.plus}>＋</Text>
      </Gradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.lg, ...shadow.card },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { opacity: 0.85 },
  body: { flex: 1, gap: 2 },
  plus: { fontSize: 28, color: colors.white, paddingHorizontal: spacing.sm },
});
