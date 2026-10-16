import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Stepper } from '@/components/ui/Stepper';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForItem } from '@/lib/productIcon';
import { customizationText } from '@/lib/cartLineText';
import { lineUnitPrice, useCartStore } from '@/stores/cartStore';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';
import type { CartItem } from '@/types';

export function CartLine({ line, onEdit }: { line: CartItem; onEdit: (line: CartItem) => void }) {
  const { t, lang } = useI18n();
  const { width, fontScale } = useWindowDimensions();
  const stackControls = width < 400 || fontScale > 1.2;
  const incLine = useCartStore((s) => s.incLine);
  const decLine = useCartStore((s) => s.decLine);
  const removeLine = useCartStore((s) => s.removeLine);

  const detail = customizationText(line, lang);
  const lineTotal = lineUnitPrice(line) * line.qty;
  const name = lang === 'ar' ? line.nameAr : line.nameEn;

  return (
    <View style={[styles.row, stackControls && styles.rowStacked]}>
      <View style={styles.thumb}>
        <Icon name={iconForItem(line.itemId)} size={28} color={colors.brown} strokeWidth={1.7} />
      </View>
      <View style={styles.body}>
        <Text variant="bodyBold">{name}</Text>
        {/* Wrapped, never cut: which milk, which add-ons (audit P2). */}
        <Text variant="caption" color={colors.warmGray}>
          {detail}
        </Text>
        <Text variant="price" style={styles.price}>
          {formatJOD(lineTotal, lang)}
        </Text>
        <Pressable
          onPress={() => onEdit(line)}
          style={({ pressed }) => [styles.edit, pressed && styles.removePressed]}
          accessibilityRole="button"
          accessibilityLabel={t('cart.editItem', { name })}
        >
          <Text variant="caption">{t('cart.edit')}</Text>
        </Pressable>
      </View>
      <View style={[styles.controls, stackControls && styles.controlsStacked]}>
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
  rowStacked: { flexWrap: 'wrap' },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  price: { marginTop: spacing.xs },
  edit: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  controls: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  controlsStacked: { flexBasis: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  remove: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: { backgroundColor: colors.neutralWarm },
});
