import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { tiers } from '@/services/seed';
import { tierName } from '@almond/shared/loyalty';
import { useI18n } from '@/hooks/useI18n';
import type { TierId } from '@/types';

/**
 * The rung badge, in the black-and-white ramp (shared theme): darker is higher
 * on the white page, lighter is higher on the dark one, and the label is
 * always `onInk` on it. On the black card (`onHero`) it is an outlined pill,
 * because a black top-rung badge on a black card is no badge at all. The two
 * upper rungs get a coffee-bean icon (the loyalty currency — no stars per the
 * Wallet/Loyalty spec §0).
 *
 * The label is the RATE — "2%" / "4%" / "6%" — not a metal, and it is read off
 * the tier itself. It used to be `t(`tiers.${tier}`)`, and that namespace still
 * held bean/silver/gold/black, so this badge rendered the literal string
 * "tiers.base" on screen. See packages/shared/src/loyalty/constants.ts.
 */
export const TIER_FILL: Record<TierId, string> = {
  base: colors.tierBean,
  plus: colors.tierSilver,
  top: colors.tierGold,
};

export function TierBadge({ tier, small, onHero }: { tier: TierId; small?: boolean; onHero?: boolean }) {
  const { lang } = useI18n();
  const def = tiers.find((x) => x.id === tier) ?? tiers[0];

  const bg = onHero ? 'transparent' : TIER_FILL[def.id];
  const fg = onHero ? colors.onHero : colors.onInk;
  const border = onHero ? colors.onHero : TIER_FILL[def.id];
  const iconColor = fg;
  const exclusive = tier === 'plus' || tier === 'top';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: border },
        small && styles.small,
      ]}
    >
      <Icon name={exclusive ? 'bean' : 'coffee'} size={small ? 11 : 13} color={iconColor} strokeWidth={2.4} />
      <Text variant="caption" color={fg} style={styles.label}>
        {tierName(def, lang)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  small: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
  label: { fontWeight: '700' },
});
