import { View, StyleSheet } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Summary } from '@/components/cart/Summary';
import { BranchNotice } from '@/components/cart/BranchNotice';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForItem } from '@/lib/productIcon';
import { paymentIcon } from '@/lib/paymentIcon';
import { customizationText } from '@/lib/cartLineText';
import type { BranchSwitch } from '@/lib/cartBranch';
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
  /** Set when the cart moved the order off the customer's branch. */
  branchNotice?: BranchSwitch | null;
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
  branchNotice,
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
      {/* WHERE the order goes, for pickup AND dine-in (dine-in used to show
          no branch at all), named in full — the last look before paying. When
          the cart moved the order to another branch, the review says so too. */}
      {branch ? (
        <View style={styles.branchBlock}>
          <View style={styles.branchRow}>
            <Icon name="map-pin" size={20} color={colors.primary} />
            <View style={styles.flex}>
              <Text variant="caption" color={colors.warmGray}>
                {isPickup ? t('cart.reviewPickupAt') : t('cart.reviewDineInAt')}
              </Text>
              <Text variant="title">{lang === 'ar' ? branch.nameAr : branch.nameEn}</Text>
              {isPickup ? (
                <Text variant="caption" color={colors.dark}>
                  {estimate.readyOnArrival
                    ? t('cart.readyOnArrival')
                    : t('cart.readyIn', { count: estimate.prepMinutes })}
                </Text>
              ) : null}
            </View>
          </View>
          {branchNotice ? <BranchNotice notice={branchNotice} /> : null}
        </View>
      ) : null}

      {/* Items with icons */}
      <View style={styles.items}>
        {items.map((line) => {
          const detail = customizationText(line, lang);
          return (
            <View key={line.lineId} style={styles.item}>
              <View style={styles.thumb}>
                <Icon name={iconForItem(line.itemId)} size={24} color={colors.brown} strokeWidth={1.7} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyBold">
                  {line.qty}× {lang === 'ar' ? line.nameAr : line.nameEn}
                </Text>
                {/* In full, wrapped: this is where the customer checks which
                    milk and which add-ons they chose (it was cut to one line). */}
                <Text variant="caption" color={colors.warmGray}>
                  {detail}
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
          <View style={styles.payName}>
            <Icon name={paymentIcon(pm.id)} size={18} color={colors.primary} strokeWidth={1.9} />
            <Text variant="bodyBold">{lang === 'ar' ? pm.nameAr : pm.nameEn}</Text>
          </View>
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
  branchBlock: { gap: spacing.sm, marginBottom: spacing.md },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  items: { gap: spacing.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  payName: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
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
