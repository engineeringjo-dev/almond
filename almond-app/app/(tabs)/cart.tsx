import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toggle } from '@/components/ui/Toggle';
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
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useCartStore, computeTotals } from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';
import { useNearestBranch } from '@/hooks/useNearestBranch';
import { useAuthStore, useUserId } from '@/stores/authStore';
import { useCreateOrder } from '@/hooks/useOrder';
import { useWallet, useInvalidateLoyalty, useLoyaltyBalance } from '@/hooks/useLoyalty';
import { estimateEarnedPoints } from '@/lib/earnEstimate';
import { computePickupEstimate } from '@/lib/pickup';
import { formatJOD } from '@/lib/format';
import { paymentService } from '@/services/payment.service';
import { loyaltyService } from '@/services/loyalty.service';
import { integration } from '@/constants/integration';
import { usePromoStore } from '@/stores/promoStore';
import { activeBonusDay } from '@/lib/bonusDay';
import { comboBonusPoints } from '@/lib/combo';
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
  const curbside = useCartStore((s) => s.curbside);
  const setCurbside = useCartStore((s) => s.setCurbside);
  const carInfo = useCartStore((s) => s.carInfo);
  const setCarInfo = useCartStore((s) => s.setCarInfo);
  const clear = useCartStore((s) => s.clear);

  const { branches } = useNearestBranch();
  const userId = useUserId();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: walletBalance } = useWallet();
  const { data: loyalty } = useLoyaltyBalance();
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
  const pointsToEarn = useMemo(
    () =>
      estimateEarnedPoints({
        total: totals.total,
        items,
        tierMultiplier: loyalty?.multiplier ?? 1,
        paidFromBalance: paymentMethod === 'wallet',
      }),
    [totals.total, items, loyalty, paymentMethod],
  );

  // If wallet is selected but no longer covers the total, fall back to cash
  // (the wallet option is also disabled in the picker).
  useEffect(() => {
    if (paymentMethod === 'wallet' && walletBalance != null && walletBalance < totals.total) {
      setPaymentMethod('cash');
    }
  }, [paymentMethod, walletBalance, totals.total, setPaymentMethod]);
  const estimate = useMemo(
    () => computePickupEstimate(items, branch?.distanceKm),
    [items, branch],
  );

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
    // Guard: never let a wallet payment proceed with an insufficient balance
    // (previously failed silently). Surface it and stop.
    if (paymentMethod === 'wallet' && walletBalance != null && walletBalance < totals.total) {
      useToastStore.getState().showError(t('cart.walletInsufficient'));
      return;
    }
    setSubmitting(true);
    try {
      if (paymentMethod === 'wallet' && integration.enabled.wallet) {
        // Deduct from the stored-value e-wallet on the loyalty server (Odoo).
        await loyaltyService.chargeWallet(userId, totals.total);
      } else {
        const payment = await paymentService.pay(totals.total, paymentMethod);
        if (!payment.success) {
          useToastStore.getState().showError(t('cart.paymentFailed'));
          return;
        }
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
        curbside: orderType === 'pickup' ? curbside : undefined,
        carInfo: orderType === 'pickup' && curbside ? carInfo.trim() || undefined : undefined,
      });

      // Award loyalty beans + cup (section 8.2). Server does this in prod.
      const bonusDay = activeBonusDay();
      const bonusActive = !!bonusDay && usePromoStore.getState().isActivatedToday();
      await loyaltyService.earn({
        userId,
        invoiceAmount: totals.total,
        paidFromBalance: paymentMethod === 'wallet',
        bonusMultiplier: bonusActive ? bonusDay!.multiplier : 1,
        comboBonusPoints: comboBonusPoints(items),
      });
      invalidateLoyalty();

      clear();
      router.replace({ pathname: '/order/confirm', params: { id: order.id } });
    } catch {
      // Never fail silently — surface the checkout error so the user can retry.
      useToastStore.getState().showError(t('cart.checkoutError'));
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

            {/* Curbside pickup (Starbucks Curbside) — only for pickup orders */}
            {orderType === 'pickup' ? (
              <View style={styles.section}>
                <View style={styles.curbRow}>
                  <View style={styles.flex}>
                    <Text variant="bodyBold">{t('cart.curbside')}</Text>
                    <Text variant="caption" color={colors.warmGray}>{t('cart.curbsideHint')}</Text>
                  </View>
                  <Toggle value={curbside} onValueChange={setCurbside} />
                </View>
                {curbside ? (
                  <TextInput
                    style={styles.carInput}
                    value={carInfo}
                    onChangeText={setCarInfo}
                    placeholder={t('cart.carInfoPh')}
                    placeholderTextColor={colors.warmGray}
                  />
                ) : null}
              </View>
            ) : null}

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
              <Summary totals={totals} pointsToEarn={pointsToEarn} />
            </View>

            <View style={styles.section}>
              <Text variant="title" style={styles.sectionTitle}>
                {t('cart.paymentMethod')}
              </Text>
              <Text variant="caption" color={colors.green} style={styles.earnNote}>
                {t('cart.earnAllMethods')}
              </Text>

              {/* Pay-from-wallet upsell (Wallet spec §1.2): +50% beans. Shown as
                  a one-tap nudge when not already paying from balance and the
                  wallet covers the order; becomes a confirmation once selected. */}
              {paymentMethod === 'wallet' ? (
                <View style={styles.walletBonus}>
                  <Icon name="bean" size={16} color={colors.green} strokeWidth={2} />
                  <Text variant="caption" color={colors.green}>
                    {t('cart.walletEarnBonus')}
                  </Text>
                </View>
              ) : (walletBalance ?? 0) >= totals.total ? (
                <Pressable
                  style={styles.walletUpsell}
                  onPress={() => setPaymentMethod('wallet')}
                  accessibilityRole="button"
                >
                  <Icon name="wallet" size={18} color={colors.primary} strokeWidth={1.9} />
                  <Text variant="caption" color={colors.dark} style={styles.flex}>
                    {t('cart.walletUpsell')}
                  </Text>
                  <Icon name="plus" size={16} color={colors.primary} />
                </Pressable>
              ) : null}

              <PaymentMethods
                value={paymentMethod}
                onChange={setPaymentMethod}
                walletBalance={walletBalance}
                total={totals.total}
              />
            </View>
          </>
        )}
      </Screen>

      <View style={styles.footer}>
        {orderType === 'delivery' ? (
          <Button title={t('cart.deliveryRedirect')} onPress={openDelivery} leadingIcon="delivery" />
        ) : (
          <Button
            title={`${t('cart.reviewCta')} · ${formatJOD(totals.total, lang)}`}
            onPress={startCheckout}
            disabled={!branch}
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
        pointsToEarn={pointsToEarn}
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
  flex: { flex: 1 },
  curbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  carInput: {
    marginTop: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.dark,
    textAlign: 'auto',
    ...shadow.card,
  },
  walletUpsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  walletBonus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
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
