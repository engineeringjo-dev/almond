import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { forwardChevron } from '@/lib/direction';
import { useCartStore } from '@/stores/cartStore';
import type { BranchRef } from '@/lib/cartBranch';
import { aggregatorService } from '@/services/aggregator.service';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Optionally pre-select a branch (e.g. from "nearest branch"). */
  branch?: BranchRef;
}

/**
 * Order-type chooser (Revision Pack §H): the user picks the type FIRST.
 * Pickup → continues in-app (menu); Delivery → external redirect (§7.4) — never
 * completed in-app.
 */
export function OrderTypeSheet({ visible, onClose, branch }: Props) {
  const { t, lang } = useI18n();
  const setOrderType = useCartStore((s) => s.setOrderType);
  const setBranch = useCartStore((s) => s.setBranch);

  const choosePickup = () => {
    setOrderType('pickup');
    if (branch) setBranch(branch);
    onClose();
    router.push('/(tabs)/order');
  };

  const chooseDelivery = async () => {
    onClose();
    await WebBrowser.openBrowserAsync(aggregatorService.getRedirectUrl());
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('orderType.choose')}>
      <View style={styles.list}>
        <Pressable style={({ pressed }) => [styles.option, styles.optionHero, pressed && styles.pressed]} onPress={choosePickup}>
          <Icon name="pickup" size={30} color={colors.dark} strokeWidth={1.6} />
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text variant="title">{t('orderType.pickup')}</Text>
              <View style={styles.recommended}>
                <Text variant="caption" color={colors.onInk}>
                  {t('orderType.recommended')}
                </Text>
              </View>
            </View>
            <Text variant="caption" color={colors.warmGray}>
              {t('orderType.pickupDesc')}
            </Text>
          </View>
          <Icon name={forwardChevron(lang)} size={22} color={colors.dark} />
        </Pressable>

        <Pressable style={({ pressed }) => [styles.option, pressed && styles.pressed]} onPress={chooseDelivery}>
          <Icon name="delivery" size={30} color={colors.dark} strokeWidth={1.6} />
          <View style={styles.body}>
            <Text variant="title">{t('orderType.delivery')}</Text>
            <Text variant="caption" color={colors.warmGray}>
              {t('orderType.deliveryDesc')}
            </Text>
          </View>
          <Icon name="external" size={20} color={colors.dark} />
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.lightGold,
  },
  optionHero: { borderColor: colors.gold, borderWidth: 2, backgroundColor: colors.neutralWarm },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recommended: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
});
