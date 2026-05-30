import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { OrderTypeSheet } from '@/components/order/OrderTypeSheet';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

interface Action {
  key: string;
  emoji: string;
  onPress: () => void;
}

/** Quick actions 2×2 (section 4.4 #5). "اطلب الآن" opens the type chooser (§H). */
export function QuickActions() {
  const { t } = useI18n();
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);

  const actions: Action[] = [
    { key: 'home.quickOrder', emoji: '🛍️', onPress: () => setOrderSheetOpen(true) },
    { key: 'home.trackOrder', emoji: '📍', onPress: () => router.push('/(tabs)/track') },
    { key: 'home.rewards', emoji: '🎁', onPress: () => router.push('/loyalty') },
    { key: 'home.spinWheel', emoji: '🎡', onPress: () => router.push('/spin') },
  ];

  return (
    <>
      <View style={styles.grid}>
        {actions.map((a) => (
          <Pressable
            key={a.key}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            onPress={a.onPress}
            accessibilityRole="button"
            accessibilityLabel={t(a.key)}
          >
            <Text style={styles.emoji}>{a.emoji}</Text>
            <Text variant="bodyBold" center>
              {t(a.key)}
            </Text>
          </Pressable>
        ))}
      </View>
      <OrderTypeSheet visible={orderSheetOpen} onClose={() => setOrderSheetOpen(false)} />
    </>
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
  emoji: { fontSize: 30 },
});
