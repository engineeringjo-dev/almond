import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Stepper } from '@/components/ui/Stepper';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForItem } from '@/lib/productIcon';
import { lineUnitPrice, useCartStore } from '@/stores/cartStore';
import type { CartItem } from '@/types';

export function CartLine({ line }: { line: CartItem }) {
  const { t, lang } = useI18n();
  const incLine = useCartStore((s) => s.incLine);
  const decLine = useCartStore((s) => s.decLine);
  const removeLine = useCartStore((s) => s.removeLine);

  const custLabel = line.customizations
    .map((c) => (lang === 'ar' ? c.nameAr : c.nameEn))
    .join('، ');
  const sizeLabel = lang === 'ar' ? line.sizeNameAr : line.sizeNameEn;
  const lineTotal = lineUnitPrice(line) * line.qty;
  const name = lang === 'ar' ? line.nameAr : line.nameEn;

  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        <Icon name={iconForItem(line.itemId)} size={28} color={colors.brown} strokeWidth={1.7} />
      </View>
      <View style={styles.body}>
        <Text variant="bodyBold" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color={colors.warmGray} numberOfLines={1}>
          {sizeLabel}
          {custLabel ? ` · ${custLabel}` : ''}
        </Text>
        <Text variant="price" style={styles.price}>
          {formatJOD(lineTotal, lang)}
        </Text>
      </View>
      <View style={styles.controls}>
        <Stepper
          value={line.qty}
          min={0}
          onChange={(v) => (v > line.qty ? incLine(line.lineId) : decLine(line.lineId))}
          label={name}
        />
        {/* A named, 44×44 target (a 17×20 🗑️ emoji before, read as "wastebasket"
            or nothing). Sized, not hitSlop'd: react-native-web ignores hitSlop. */}
        <Pressable
          onPress={() => removeLine(line.lineId)}
          style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
          accessibilityRole="button"
          accessibilityLabel={t('cart.removeItem', { name })}
        >
          <Icon name="trash" size={18} color={colors.red} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 30 },
  body: { flex: 1, gap: 2 },
  price: { marginTop: spacing.xs },
  controls: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  remove: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: { backgroundColor: colors.neutralWarm },
});
