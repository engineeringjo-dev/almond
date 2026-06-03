import { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useNearestBranch } from '@/hooks/useNearestBranch';
import { useCartStore } from '@/stores/cartStore';
import { openDirections } from '@/lib/maps';
import { aggregatorService } from '@/services/aggregator.service';

/**
 * "أقرب فرع لي" prominent button (Revision Pack §I). GPS → nearest branch →
 * three actions: pickup here / delivery / directions on Google Maps.
 */
export function NearestBranchButton() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const { nearestOpen, permissionDenied, loading } = useNearestBranch();
  const setOrderType = useCartStore((s) => s.setOrderType);
  const setBranch = useCartStore((s) => s.setBranch);

  const branch = nearestOpen;

  const pickupHere = () => {
    if (branch) {
      setBranch(branch.id);
      setOrderType('pickup');
    }
    setOpen(false);
    router.push('/(tabs)/order');
  };

  const delivery = async () => {
    setOpen(false);
    await WebBrowser.openBrowserAsync(aggregatorService.getRedirectUrl());
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <View style={styles.iconWrap}>
          <Icon name="map-pin" size={22} color="#000000" />
        </View>
        <Text variant="title" color="#000000" style={styles.btnLabel}>
          {t('home.myNearestBranch')}
        </Text>
        <Icon name="navigation" size={20} color="#000000" />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('home.myNearestBranch')}>
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginVertical: spacing.xl }} />
        ) : branch ? (
          <View style={styles.sheet}>
            <View style={styles.branchRow}>
              <Icon name="map-pin" size={26} color={colors.gold} />
              <View style={styles.branchBody}>
                <Text variant="h2">{lang === 'ar' ? branch.nameAr : branch.nameEn}</Text>
                <Text variant="caption" color={colors.warmGray}>
                  {branch.distanceKm != null ? `${branch.distanceKm.toFixed(1)} ${t('common.km')} · ` : ''}
                  {branch.isOpen ? t('common.open') : t('common.closed')}
                </Text>
              </View>
            </View>

            <Button title={t('home.pickupHere')} onPress={pickupHere} leadingEmoji="🏃" />
            <Button title={t('orderType.delivery')} onPress={delivery} variant="outline" leadingEmoji="🛵" />
            <Pressable style={styles.mapsLink} onPress={() => openDirections(branch.lat, branch.lng)}>
              <Icon name="navigation" size={18} color={colors.brown} />
              <Text variant="bodyBold" color={colors.brown}>
                {t('home.directions')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Text variant="body" color={colors.warmGray} center style={{ paddingVertical: spacing.xl }}>
            {permissionDenied ? t('home.noBranchLocation') : t('common.empty')}
          </Text>
        )}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  pressed: { opacity: 0.9 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: { flex: 1 },
  sheet: { gap: spacing.md, paddingBottom: spacing.md },
  branchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  branchBody: { flex: 1, gap: 2 },
  mapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
});
