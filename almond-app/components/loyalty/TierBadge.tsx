import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { tiers } from '@/services/seed';
import { useI18n } from '@/hooks/useI18n';
import type { TierId } from '@/types';

/**
 * Premium tier badge (Revision Pack §O): warm, exclusive feel. The Black tier
 * is gold-on-dark to feel special; higher tiers get a coffee-bean icon (the
 * loyalty currency — no stars per the Wallet/Loyalty spec §0).
 */
export function TierBadge({ tier, small }: { tier: TierId; small?: boolean }) {
  const { t } = useI18n();
  const def = tiers.find((x) => x.id === tier) ?? tiers[0];

  const isBlack = tier === 'black';
  const bg = isBlack ? colors.dark : def.color;
  const fg = isBlack ? colors.gold : colors.white;
  const border = isBlack ? colors.gold : def.color;
  const iconColor = isBlack ? colors.gold : colors.white;
  const exclusive = tier === 'gold' || tier === 'black';

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
