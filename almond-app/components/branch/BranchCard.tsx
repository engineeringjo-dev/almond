import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { openDirections } from '@/lib/maps';
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
