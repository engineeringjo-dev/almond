import { useEffect, useRef } from 'react';
import { ScrollView, Pressable, StyleSheet, Platform, type View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { MIN_TOUCH_TARGET, navItemA11y } from '@/lib/a11y';
import type { Category } from '@/types';

interface Props {
  categories: Category[];
  /** The section in view. */
  activeId: string;
  /** Jump to a section. */
  onSelect: (id: string) => void;
}

/**
 * THE MENU'S SECTION BAR — pinned over one list, it jumps to a section and
 * marks the one in view (Dunkin' panel, 2026-10-15). It used to be a filter
 * that scrolled away with the first swipe, over a «الكل» of 375 tiles with no
 * heading. Precedent: Dunkin' 07, Talabat, Careem, Deliveroo; the website's
 * CategoryRail already does it.
 *
 * Navigation, not tabs: it moves within one page rather than switching
 * panels, so the chips are buttons and the one in view is aria-current.
 */
export function CategoryChips({ categories, activeId, onSelect }: Props) {
  const { t, lang } = useI18n();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const chips = useRef(new Map<string, View | null>());
  const xs = useRef(new Map<string, number>());

  // The chip of the section in view is kept in the row as the list scrolls.
  //
  // The web moves the ROW by the chip's distance from its edge, measured on
  // screen, which holds in right-to-left too (a scrollTo from the left lands
  // nowhere in Arabic). Not scrollIntoView: it also scrolls every ancestor,
  // the menu list among them, and that cancelled the jump the same tap had
  // just started. Native scrolls to the chip's x.
  useEffect(() => {
    if (Platform.OS === 'web') {
      const row = (scrollRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)?.getScrollableNode?.();
      const chip = chips.current.get(activeId) as unknown as HTMLElement | null;
      if (!row || !chip?.getBoundingClientRect) return;
      const r = row.getBoundingClientRect();
      const c = chip.getBoundingClientRect();
      const delta = c.left < r.left + spacing.lg ? c.left - r.left - spacing.lg : c.right > r.right - spacing.lg ? c.right - r.right + spacing.lg : 0;
      if (delta !== 0) row.scrollBy({ left: delta, behavior: reduceMotion ? 'auto' : 'smooth' });
      return;
    }
    const x = xs.current.get(activeId);
    if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x - spacing.lg), animated: !reduceMotion });
  }, [activeId, reduceMotion]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      role="navigation"
      aria-label={t('order.categories')}
    >
      {categories.map((c) => {
        const active = c.id === activeId;
        const name = lang === 'ar' ? c.nameAr : c.nameEn;
        return (
          <Pressable
            key={c.id}
            ref={(node) => {
              chips.current.set(c.id, node);
            }}
            onLayout={(e) => xs.current.set(c.id, e.nativeEvent.layout.x)}
            onPress={() => onSelect(c.id)}
            style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
            {...navItemA11y(active, name)}
          >
            <Text variant="caption" color={active ? colors.onInk : colors.dark}>
              {name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    // A resting chip is a control: its own fill and a ≥3:1 edge, not white on white.
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.75 },
});
