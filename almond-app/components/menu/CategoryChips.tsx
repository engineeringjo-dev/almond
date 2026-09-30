import { ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { MIN_TOUCH_TARGET, tabA11y } from '@/lib/a11y';
import { iconForCategory } from '@/lib/productIcon';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function CategoryChips({ categories, activeId, onSelect }: Props) {
  const { t, lang } = useI18n();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // One category shows at a time: a tablist whose tabs say which is on.
      // `accessibilityState` never reached the web build (react-native-web
      // 0.21 drops it), so the choice was silent there.
      role="tablist"
      aria-label={t('order.categories')}
    >
      {categories.map((c) => {
        const active = c.id === activeId;
        const name = lang === 'ar' ? c.nameAr : c.nameEn;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            style={[styles.chip, active && styles.chipActive]}
            {...tabA11y(active, name)}
          >
            <Icon
              name={iconForCategory(c.id)}
              size={16}
              color={active ? colors.white : colors.warmGray}
              strokeWidth={2}
            />
            <Text variant="bodyBold" color={active ? colors.white : colors.warmGray}>
              {name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs, paddingEnd: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    // A resting chip is a control: its own fill and a ≥3:1 edge, not white on white.
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
