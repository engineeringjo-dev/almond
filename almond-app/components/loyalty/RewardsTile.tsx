import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';

interface Props {
  icon: IconName;
  title: string;
  /** What is behind the tile, in the member's own numbers: the last movement,
   *  the active coupons, the rung and the next one. Two lines at most.
   *  `undefined` while that number is still loading: a line of skeleton holds
   *  its place, so the grid does not jump when it lands. */
  subline: string | undefined;
  onPress: () => void;
}

/**
 * One door off the Rewards tab. Owner, 2026-10-15, after Al Ameed's app: «الصفحة
 * جدا طويلة عندي اريد تقسيمها مثل العميد الى حد ما». Al Ameed gives each loyalty
 * job a short page of its own and a tile on one hub — «نقاطي», «المكافآت
 * المستبدلة» — and the hub fits one screen. These are those tiles, in line
 * icons on the resting fill instead of their branch photographs (owner
 * question 2 in docs/competitors/AL-AMEED-PAGE-DIVISION-2026-10.ar.md).
 *
 * The tile has no label of its own: its accessible name is its visible text,
 * the name and then the subline, so what a screen reader says is what the
 * member reads (WCAG 2.5.3). `testID` is the web build's `data-testid`, which
 * the one-screen check measures (e2e/app/rewards-hub.spec.ts).
 */
export function RewardsTile({ icon, title, subline, onPress }: Props) {
  return (
    <Pressable
      testID="rewards-tile"
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <Icon name={icon} size={20} color={colors.dark} strokeWidth={1.9} />
        <Text variant="bodyBold" style={styles.title}>
          {title}
        </Text>
      </View>
      {subline === undefined ? (
        <Skeleton width="60%" height={20} />
      ) : (
        <Text variant="caption" color={colors.warmGray} style={styles.subline}>
          {subline}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    // Two to a row: half the row less half the gap, so the pair fills it.
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: MIN_TOUCH_TARGET,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, minWidth: 0 },
  subline: { fontSize: fontSize.xs, lineHeight: 20 },
});
