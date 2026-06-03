import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderTypeTabs } from '@/components/cart/OrderTypeTabs';
import { CartLine } from '@/components/cart/CartLine';
import { PickupInfo } from '@/components/cart/PickupInfo';
import { PromoInput } from '@/components/cart/PromoInput';
import { Summary } from '@/components/cart/Summary';
import { PaymentMethods } from '@/components/cart/PaymentMethods';
import { ReviewSheet } from '@/components/cart/ReviewSheet';
import { CrossSellRow } from '@/components/cart/CrossSellRow';
import { BranchCard } from '@/components/branch/BranchCard';
import { BranchPicker } from '@/components/branch/BranchPicker';
import { Logo } from '@/components/ui/Logo';
import { colors, spacing } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { useCartStore, computeTotals } from '@/stores/cartStore';
import { useNearestBranch } from '@/hooks/useNearestBranch';
import { useAuthStore, useUserId } from '@/stores/authStore';
import { useCreateOrder } from '@/hooks/useOrder';
import { useWallet, useLoyaltyBalance, useInvalidateLoyalty } from '@/hooks/useLoyalty';
import { computePickupEstimate } from '@/lib/pickup';
import { formatJOD } from '@/lib/format';
import { paymentService } from '@/services/payment.service';
import { loyaltyService } from '@/services/loyalty.service';
import { aggregatorService } from '@/services/aggregator.service';

export default function CartScreen() {
  const { t, lang } = useI18n();
  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const branchId = useCartStore((s) => s.branchId);
  const setBranch = useCartStore((s) => s.setBranch);
  const paymentMethod = useCartStore((s) => s.paymentMethod);
  const setPaymentMethod = useCartStore((s) => s.setPaymentMethod);
  const promoCode = useCartStore((s) => s.promoCode);
  const promoDiscount = useCartStore((s) => s.promoDiscount);
  const setPromo = useCartStore((s) => s.setPromo);
  const clear = useCartStore((s) => s.clear);

  const { branches } = useNearestBranch();
  const userId = useUserId();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: walletBalance } = useWallet();
  const { data: loyaltyBalance } = useLoyaltyBalance();
  const createOrder = useCreateOrder();
  const invalidateLoyalty = useInvalidateLoyalty();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-select nearest open branch for pickup (section 7.3 #2).
  useEffect(() => {
    if (!branchId && branches.length > 0) {
      const nearestOpen = branches.find((b) => b.isOpen) ?? branches[0];
      setBranch(nearestOpen.id);
    }
  }, [branchId, branches, setBranch]);

  const branch = useMemo(
    () => branches.find((b) => b.id === branchId),
    [branches, branchId],
  );
  const totals = useMemo(() => computeTotals(items, promoDiscount), [items, promoDiscount]);
  const estimate = useMemo(
    () => computePickupEstimate(items, branch?.distanceKm),
    [items, branch],
  );

  // Pay-with-points (§K): points needed for the invoice (100 pts = 1 JOD).
  const pointsNeeded = Math.ceil(totals.total * config.POINTS_PER_JOD_REDEEM);
  const payingWithPoints = paymentMethod === 'points';

  const openDelivery = async () => {
    await WebBrowser.openBrowserAsync(aggregatorService.getRedirectUrl());
  };

  // Open the visual review (UX §4); gate guests to login first.
  const startCheckout = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    setReviewOpen(true);
  };

  const placeOrder = async () => {
    if (!branch) return;
    setSubmitting(true);
    try {
      if (payingWithPoints) {
        // Spend loyalty points directly on the invoice (§K).
        await loyaltyService.spendPoints(userId, pointsNeeded);
      } else {
        const payment = await paymentService.pay(totals.total, paymentMethod);
        if (!payment.success) return;
      }

      const order = await createOrder.mutateAsync({
        userId,
        type: orderType,
        branchId: branch.id,
        branchNameAr: branch.nameAr,
        branchNameEn: branch.nameEn,
        items,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        paymentMethod,
        paidFromBalance: paymentMethod === 'wallet',
        prepMinutes: estimate.prepMinutes,
        travelMinutes: estimate.travelMinutes,
        promoCode: promoCode ?? undefined,
      });

      // Award loyalty points + cup beans (section 8.2). Server does this in prod.
      await loyaltyService.earn({
        userId,
        invoiceAmount: totals.total,
        paidFromBalance: paymentMethod === 'wallet',
      });
      invalidateLoyalty();

      clear();
      router.replace({ pathname: '/order/confirm', params: { id: order.id } });
    } finally {
      setSubmitting(false);
    }
  };

  // Empty state.
  if (items.length === 0) {
    return (
      <Screen scroll={false}>
        <EmptyState
          icon="cart"
          title={t('cart.empty')}
          subtitle={t('cart.emptyHint')}
          ctaLabel={t('cart.emptyCta')}
          onCta={() => router.push('/(tabs)/order')}
        />
      </Screen>
    );
  }

  return (
    <>
      <Screen>
        <View style={styles.titleRow}>
          <Logo variant="badge" tone="dark" size={28} />
          <Text variant="h1" style={styles.title}>
            {t('cart.title')}
          </Text>
        </View>

        <OrderTypeTabs value={orderType} onChange={setOrderType} />

        {orderType === 'delivery' ? (
          // Delivery is handled entirely off-app (section 7.4): no in-app cart,
          // payment, or summary — just a clear explainer + external hand-off.
          <View style={styles.deliveryBox}>
            <Text style={styles.deliveryEmoji}>🛵</Text>
            <Text variant="title" center>
              {t('cart.delivery')}
            </Text>
            <Text variant="body" color={colors.warmGray} center>
              {t('cart.deliveryNote')}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              {orderType === 'pickup' ? (
                <PickupInfo
                  branch={branch}
                  estimate={estimate}
                  onChangeBranch={() => setPickerOpen(true)}
                />
              ) : (
                <BranchCard branch={branch!} onPress={() => setPickerOpen(true)} />
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.lines}>
                {items.map((line) => (
                  <CartLine key={line.lineId} line={line} />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <CrossSellRow items={items} />
            </View>

            <View style={styles.section}>
              <PromoInput
                subtotal={totals.subtotal}
                appliedCode={promoCode}
                onApply={(code, discount) => setPromo(code, discount)}
                onClear={() => setPromo(null, 0)}
              />
            </View>

            <View style={styles.section}>
              <Summary totals={totals} />
            </View>

            <View style={styles.section}>
              <Text variant="title" style={styles.sectionTitle}>
                {t('cart.paymentMethod')}
              </Text>
              <Text variant="caption" color={colors.green} style={styles.earnNote}>
                {t('cart.earnAllMethods')}
              </Text>
              <PaymentMethods
                value={paymentMethod}
                onChange={setPaymentMethod}
                walletBalance={walletBalance}
                pointsBalance={loyaltyBalance?.points}
                pointsNeeded={pointsNeeded}
              />
            </View>
          </>
        )}
      </Screen>

      <View style={styles.footer}>
        {orderType === 'delivery' ? (
          <Button title={t('cart.deliveryRedirect')} onPress={openDelivery} leadingEmoji="🛵" />
        ) : (
          <Button
            title={`${t('cart.reviewCta')} · ${formatJOD(totals.total, lang)}`}
            onPress={startCheckout}
            disabled={
              !branch ||
              (payingWithPoints && (loyaltyBalance?.points ?? 0) < pointsNeeded)
            }
          />
        )}
      </View>

      <BranchPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        branches={branches}
        selectedId={branchId}
        onSelect={(b) => setBranch(b.id)}
      />

      <ReviewSheet
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
        items={items}
        totals={totals}
        branch={branch}
        estimate={estimate}
        isPickup={orderType === 'pickup'}
        paymentMethod={paymentMethod}
        submitting={submitting}
        onConfirm={placeOrder}
      />
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  title: {},
  section: { marginTop: spacing.lg },
  sectionTitle: { marginBottom: spacing.md },
  earnNote: { marginBottom: spacing.md, marginTop: -spacing.sm },
  lines: { gap: spacing.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyEmoji: { fontSize: 64 },
  deliveryBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  deliveryEmoji: { fontSize: 40 },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.cardBg,
  },
});
