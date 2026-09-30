import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { openDirections } from '@/lib/maps';
import type { CheckoutBlock } from '@/lib/cartBranch';
import type { Branch } from '@/types';

interface Props {
  branch: Branch;
  onPress?: () => void;
  selected?: boolean;
  /** Show the Google Maps directions button (Revision Pack §I). */
  showDirections?: boolean;
}

export function BranchCard({ branch, onPress, selected, showDirections = true }: Props) {
  const { t, lang } = useI18n();
  const name = lang === 'ar' ? branch.nameAr : branch.nameEn;
  const area = lang === 'ar' ? branch.areaAr : branch.areaEn;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.pin}>
        <Icon name="map-pin" size={22} color={colors.brown} />
      </View>
      <View style={styles.body}>
        <Text variant="bodyBold">{name}</Text>
        <Text variant="caption" color={colors.warmGray}>
          {area}
          {branch.distanceKm != null ? ` · ${branch.distanceKm.toFixed(1)} ${t('common.km')}` : ''}
        </Text>
      </View>
      <View style={[styles.status, { backgroundColor: branch.isOpen ? colors.green : colors.red }]}>
        <Text variant="caption" color="#FFFFFF">
          {branch.isOpen ? t('common.open') : t('common.closed')}
        </Text>
      </View>
      {showDirections ? (
        <Pressable
          style={styles.mapBtn}
          onPress={() => openDirections(branch.lat, branch.lng)}
          hitSlop={8}
          accessibilityLabel={t('home.directions')}
        >
          <Icon name="navigation" size={18} color={colors.gold} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const PLACEHOLDER_COPY: Record<CheckoutBlock, string> = {
  branchLoading: 'cart.branchLoading',
  branchError: 'cart.branchError',
  branchMissing: 'cart.branchChoose',
};

/**
 * Stands in for BranchCard while there is no branch to show — the list is
 * still loading, failed, or holds nothing the customer has chosen. Same card
 * shape, so the cart does not jump when the branch arrives.
 */
export function BranchCardPlaceholder({ state, onPress }: { state: CheckoutBlock; onPress: () => void }) {
  const { t } = useI18n();
  const loading = state === 'branchLoading';
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      aria-busy={loading}
    >
      <View style={styles.pin}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.brown} />
        ) : (
          <Icon name="map-pin" size={22} color={colors.brown} />
        )}
      </View>
      <View style={styles.body}>
        <Text variant="bodyBold" color={loading ? colors.warmGray : colors.dark}>
          {t(PLACEHOLDER_COPY[state])}
        </Text>
      </View>
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
    ...shadow.card,
  },
  selected: { borderWidth: 2, borderColor: colors.gold },
  pressed: { opacity: 0.85 },
  pin: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinEmoji: { fontSize: 22 },
  body: { flex: 1, gap: 2 },
  status: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  mapBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
