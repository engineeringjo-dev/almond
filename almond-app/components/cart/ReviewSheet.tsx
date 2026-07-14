import { View, StyleSheet } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Summary } from '@/components/cart/Summary';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForItem } from '@/lib/productIcon';
import { lineUnitPrice, type CartTotals } from '@/stores/cartStore';
import { paymentMethods } from '@/services/seed';
import type { CartItem, Branch, PaymentMethodId } from '@/types';
import type { PickupEstimate } from '@/lib/pickup';

interface Props {
  visible: boolean;
  onClose: () => void;
  items: CartItem[];
  totals: CartTotals;
  pointsToEarn?: number;
  branch?: Branch;
  estimate: PickupEstimate;
  isPickup: boolean;
  paymentMethod: PaymentMethodId;
  submitting: boolean;
  onConfirm: () => void;
}

/**
 * Visual review before final confirm (UX §4): each item with its icon/photo,
 * size, customizations, and price + branch + ready time + total. "Edit" returns
 * to the cart (supports the 30s window after confirm too).
 */
export function ReviewSheet({
  visible,
  onClose,
  items,
  totals,
  pointsToEarn,
  branch,
  estimate,
  isPickup,
  paymentMethod,
  submitting,
  onConfirm,
}: Props) {
  const { t, lang } = useI18n();
  const pm = paymentMethods.find((m) => m.id === paymentMethod);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('cart.reviewTitle')}
      footer={
        <View style={styles.footer}>
          <Button title={t('cart.edit')} variant="ghost" onPress={onClose} style={styles.editBtn} />
          <Button
            title={`${t('cart.placeOrder')} · ${formatJOD(totals.total, lang)}`}
            onPress={onConfirm}
            loading={submitting}
            style={styles.confirmBtn}
          />
        </View>
      }
    >
      {/* Branch + ready estimate */}
      {isPickup && branch ? (
        <View style={styles.branchRow}>
          <Icon name="map-pin" size={18} color={colors.gold} />
          <Text variant="bodyBold" style={styles.flex}>
            {lang === 'ar' ? branch.nameAr : branch.nameEn}
          </Text>
          <Text variant="caption" color={colors.green}>
            {estimate.readyOnArrival
              ? t('cart.readyOnArrival')
              : t('cart.readyIn', { min: estimate.prepMinutes })}
          </Text>
        </View>
      ) : null}

      {/* Items with icons */}
      <View style={styles.items}>
        {items.map((line) => {
          const custLabel = line.customizations
            .map((c) => (lang === 'ar' ? c.nameAr : c.nameEn))
            .join('، ');
          return (
            <View key={line.lineId} style={styles.item}>
              <View style={styles.thumb}>
                <Icon name={iconForItem(line.itemId)} size={24} color={colors.brown} strokeWidth={1.7} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyBold" numberOfLines={1}>
                  {line.qty}× {lang === 'ar' ? line.nameAr : line.nameEn}
                </Text>
                <Text variant="caption" color={colors.warmGray} numberOfLines={1}>
                  {lang === 'ar' ? line.sizeNameAr : line.sizeNameEn}
                  {custLabel ? ` · ${custLabel}` : ''}
                </Text>
              </View>
              <Text variant="price">{formatJOD(lineUnitPrice(line) * line.qty, lang)}</Text>
            </View>
          );
        })}
      </View>

      {/* Payment method */}
      {pm ? (
        <View style={styles.payRow}>
          <Text variant="caption" color={colors.warmGray}>
            {t('cart.paymentMethod')}
          </Text>
          <Text variant="bodyBold">
            {pm.emoji} {lang === 'ar' ? pm.nameAr : pm.nameEn}
          </Text>
        </View>
      ) : null}

      <View style={styles.summary}>
        <Summary totals={totals} pointsToEarn={pointsToEarn} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  items: { gap: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutralWarm,
  },
  summary: { marginTop: spacing.md },
  footer: { flexDirection: 'row', gap: spacing.sm },
  editBtn: { flex: 1 },
  confirmBtn: { flex: 2 },
});
