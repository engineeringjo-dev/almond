import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useUsualOrder } from '@/hooks/useOrder';
import { useCartStore, lineUnitPrice } from '@/stores/cartStore';
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
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={addAll}
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <Text style={styles.emoji}>{usual.items[0]?.emoji ?? '☕'}</Text>
      </View>
      <View style={styles.body}>
        <Text variant="caption" color={colors.gold}>
          {t('home.usualOrder')}
        </Text>
        <Text variant="bodyBold" numberOfLines={1}>
          {summary}
        </Text>
        <Text variant="caption" color={colors.warmGray}>
          {t('home.usualOrderCta')} · {formatJOD(total, lang)}
        </Text>
      </View>
      <Text style={styles.plus}>＋</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.lightGold,
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 28 },
  body: { flex: 1, gap: 2 },
  plus: { fontSize: 28, color: colors.gold, paddingHorizontal: spacing.sm },
});
