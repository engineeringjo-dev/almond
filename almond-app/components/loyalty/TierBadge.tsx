import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { tiers } from '@/services/seed';
import { useI18n } from '@/hooks/useI18n';
import type { TierId } from '@/types';

/**
 * Premium tier badge (Revision Pack §O): warm, exclusive feel. The top rung is
 * dark to feel special; the two upper rungs get a coffee-bean icon (the loyalty
 * currency — no stars per the Wallet/Loyalty spec §0).
 *
 * The label is the RATE — "٢٪" / "٤٪" / "٦٪" — not a metal. See
 * packages/shared/src/loyalty/constants.ts for why.
 */
export function TierBadge({ tier, small }: { tier: TierId; small?: boolean }) {
  const { t } = useI18n();
  const def = tiers.find((x) => x.id === tier) ?? tiers[0];

  const isTop = tier === 'top';
  const bg = isTop ? colors.dark : def.color;
  const fg = colors.white;
  const border = isTop ? colors.dark : def.color;
  const iconColor = colors.white;
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
        {t(`tiers.${tier}`)}
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
