import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { radius, spacing } from '@/constants/theme';
import { tiers } from '@/services/seed';
import { useI18n } from '@/hooks/useI18n';
import type { TierId } from '@/types';

export function TierBadge({ tier, small }: { tier: TierId; small?: boolean }) {
  const { t } = useI18n();
  const def = tiers.find((x) => x.id === tier) ?? tiers[0];
  return (
    <View style={[styles.badge, { backgroundColor: def.color }, small && styles.small]}>
      <Text variant="caption" color="#FFFFFF" style={styles.label}>
        ☕ {t(`tiers.${tier}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  small: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
  label: { fontWeight: '700' },
});
