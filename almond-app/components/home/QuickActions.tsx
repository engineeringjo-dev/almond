import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

interface Action {
  key: string;
  icon: IconName;
  onPress: () => void;
}

/** Quick-action shortcuts (consistent icon set, Master Pack §M). */
export function QuickActions() {
  const { t } = useI18n();

  const actions: Action[] = [
    { key: 'tabs.menu', icon: 'menu', onPress: () => router.push('/(tabs)/menu') },
    { key: 'home.trackOrder', icon: 'track', onPress: () => router.push('/(tabs)/track') },
    { key: 'home.rewards', icon: 'gift', onPress: () => router.push('/loyalty') },
    { key: 'home.spinWheel', icon: 'sparkles', onPress: () => router.push('/spin') },
  ];

  return (
    <View style={styles.grid}>
      {actions.map((a) => (
        <Pressable
          key={a.key}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          onPress={a.onPress}
          accessibilityRole="button"
          accessibilityLabel={t(a.key)}
        >
          <View style={styles.iconWrap}>
            <Icon name={a.icon} size={24} color={colors.primary} />
          </View>
          <Text variant="bodyBold" center>
            {t(a.key)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
