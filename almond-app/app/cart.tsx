import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { BranchNotice } from '@/components/cart/BranchNotice';
import { BranchCard, BranchCardPlaceholder } from '@/components/branch/BranchCard';
import { BranchPicker } from '@/components/branch/BranchPicker';
import { Logo } from '@/components/ui/Logo';
import { BackButton } from '@/components/ui/BackButton';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useCartStore, computeTotals } from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';
import { useCartBranch } from '@/hooks/useCartBranch';
import { useAuthStore, useUserId } from '@/stores/authStore';
import { useCreateOrder } from '@/hooks/useOrder';
import { useWallet, useInvalidateLoyalty, useLoyaltyBalance } from '@/hooks/useLoyalty';
import { estimateEarnedPoints } from '@/lib/earnEstimate';
import { computePickupEstimate } from '@/lib/pickup';
import { checkoutBlock, type CheckoutBlock } from '@/lib/cartBranch';
import { CHECKOUT_RETURN, reviewOnReturn } from '@/lib/returnTo';
import { formatJOD } from '@/lib/format';
import { inputTextAlign } from '@/lib/inputAlign';
import { paymentService } from '@/services/payment.service';
import { loyaltyService } from '@/services/loyalty.service';
import { integration } from '@/constants/integration';
import { usePromoStore } from '@/stores/promoStore';
import { comboBasket } from '@/lib/combo';
import { aggregatorService } from '@/services/aggregator.service';

export default function CartScreen() {
  const { t, lang } = useI18n();
  // `review=1`: back from the sign-in the checkout gate sent a guest to.
  const { review } = useLocalSearchParams<{ review?: string }>();
  const items = useCartStore((s) => s.items);
  const orderType = useCartStore((s) => s.orderType);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const setBranch = useCartStore((s) => s.setBranch);
  const dismissBranchNotice = useCartStore((s) => s.dismissBranchNotice);
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
  // A stack screen now (no tab bar under it): the footer clears the home
  // indicator / gesture bar itself.
  const insets = useSafeAreaInsets();

  // The chosen branch while it is still listed and open, else the nearest open
  // one (section 7.3 #2) — persisted, so the order is placed where it is
  // shown, and never moved without saying so (`branchNotice`). `undefined`
  // only while there is no list yet: never assert it away.
  const {
    branches,
    branch,
    notice: branchNotice,
    loading: branchesLoading,
    error: branchesError,
    refetch: refetchBranches,
  } = useCartBranch();
  const userId = useUserId();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: walletBalance } = useWallet();
  const { data: loyalty } = useLoyaltyBalance();
  const createOrder = useCreateOrder();
  const invalidateLoyalty = useInvalidateLoyalty();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const block = checkoutBlock({
    orderType,
    branch,
    loading: branchesLoading,
    error: branchesError,
  });

  // Returning from login/OTP: reopen the review the customer asked for, once.
  const onReturn = reviewOnReturn({ review, isAuthenticated, itemCount: items.length, block });
  useEffect(() => {
    if (onReturn === 'none' || onReturn === 'wait') return;
    router.setParams({ review: undefined });
    if (onReturn === 'open') setReviewOpen(true);
  }, [onReturn]);
  const totals = useMemo(() => computeTotals(items, promoDiscount), [items, promoDiscount]);
  const pointsToEarn = useMemo(
    () =>
      estimateEarnedPoints({
        total: totals.total,
        items,
        windowSpend: loyalty?.windowSpend ?? 0,
        // The rung the member is PAID at. Without it a ratcheted member — one
        // whose 90-day window rolled below a threshold they already crossed —
        // is quoted the lower rate at checkout and then granted the higher one.
        heldRungId: loyalty?.tier,
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
    if (block) return; // the button is disabled and says why
    if (!isAuthenticated) {
      // Come back HERE, review open — not to Home (audit P1).
      router.push({ pathname: '/(auth)/login', params: { returnTo: CHECKOUT_RETURN } });
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
      // The bonus-day RULE (which weekday, which multiplier) lives in the shared
      // earn function; the caller only reports whether the member activated it.
      await loyaltyService.earn({
        userId,
        invoiceAmount: totals.total,
        paidFromBalance: paymentMethod === 'wallet',
        bonusDayActivated: usePromoStore.getState().isActivatedToday(),
        // The priced drink+food lines: the pair earns the combo INSTEAD of its
        // regular points (owner, 2026-09-24) — the shared engine decides which.
        combo: comboBasket(items, totals.total),
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
        <View style={[styles.titleRow, styles.emptyHeader]}>
          <BackButton fallback="/(tabs)/order" />
        </View>
        <EmptyState
          icon="cart"
          title={t('cart.empty')}
          subtitle={t('cart.emptyHint')}
          ctaLabel={t('cart.emptyCta')}
          // Back down to the menu under this screen, not a second copy of it.
          onCta={() => router.dismissTo('/(tabs)/order')}
        />
      </Screen>
    );
  }

  return (
    <>
      <Screen>
        <View style={styles.titleRow}>
          <BackButton fallback="/(tabs)/order" />
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
            <Icon name="delivery" size={40} color={colors.primary} strokeWidth={1.7} />
            <Text variant="title" center>
              {t('cart.delivery')}
            </Text>
            <Text variant="body" color={colors.warmGray} center>
              {t('cart.deliveryNote')}
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.section, styles.branchSection]}>
              {branchNotice ? (
                <BranchNotice
                  notice={branchNotice}
                  onChangeBranch={() => setPickerOpen(true)}
                  onDismiss={dismissBranchNotice}
                />
              ) : null}
              {orderType === 'pickup' ? (
                <PickupInfo
                  branch={branch}
                  estimate={estimate}
                  onChangeBranch={() => setPickerOpen(true)}
                  emptyLabel={block ? t(BLOCK_COPY[block]) : undefined}
                />
              ) : branch ? (
                <BranchCard branch={branch} onPress={() => setPickerOpen(true)} />
              ) : (
                <BranchCardPlaceholder
                  state={block ?? 'branchLoading'}
                  onPress={block === 'branchError' ? () => refetchBranches() : () => setPickerOpen(true)}
                />
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
                  <Toggle value={curbside} onValueChange={setCurbside} label={t('cart.curbsideSwitch')} />
                </View>
                {curbside ? (
                  <View style={styles.carField}>
                    {/* A label that stays while typing: the placeholder alone
                        vanished at the first letter (audit P2). */}
                    <Text variant="caption" color={colors.dark} nativeID="car-info-label">
                      {t('cart.carInfoLabel')}
                    </Text>
                    <TextInput
                      style={[styles.carInput, { textAlign: inputTextAlign(lang) }]}
                      value={carInfo}
                      onChangeText={setCarInfo}
                      placeholder={t('cart.carInfoPh')}
                      placeholderTextColor={colors.warmGray}
                      aria-labelledby="car-info-label"
                      accessibilityLabel={t('cart.carInfoLabel')}
                      returnKeyType="done"
                    />
                  </View>
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

              {/* Pay-from-wallet nudge. It used to promise "+50% points": that
                  is config.WALLET_EARN_MULTIPLIER, RETIRED to 1.0 on 2026-09-06
                  after zero rows in 171,291 live transactions, so the claim had
                  been false on screen ever since. The nudge stays — prepayment
                  is still worth encouraging — and now says only what is true. */}
              {paymentMethod === 'wallet' ? (
                <View style={styles.walletBonus}>
                  <Icon name="bean" size={16} color={colors.green} strokeWidth={2} />
                  <Text variant="caption" color={colors.green}>
                    {t('cart.walletSelected')}
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

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
        {orderType === 'delivery' ? (
          <Button title={t('cart.deliveryRedirect')} onPress={openDelivery} leadingIcon="delivery" />
        ) : (
          <>
            {block ? (
              <Text variant="caption" color={colors.warmGray} center style={styles.blockNote}>
                {t(BLOCK_COPY[block])}
              </Text>
            ) : null}
            <Button
              title={`${t('cart.reviewCta')} · ${formatJOD(totals.total, lang)}`}
              onPress={startCheckout}
              disabled={block !== null}
            />
          </>
        )}
      </View>

      <BranchPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        branches={branches}
        selectedId={branch?.id}
        onSelect={(b) => setBranch(b)}
      />

      <ReviewSheet
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
        items={items}
        totals={totals}
        pointsToEarn={pointsToEarn}
        branch={branch}
        branchNotice={branchNotice}
        estimate={estimate}
        isPickup={orderType === 'pickup'}
        paymentMethod={paymentMethod}
        submitting={submitting}
        onConfirm={placeOrder}
      />
    </>
  );
}

/** What the cart says while «مراجعة الطلب» waits for a branch. */
const BLOCK_COPY: Record<CheckoutBlock, string> = {
  branchLoading: 'cart.branchLoading',
  branchError: 'cart.branchError',
  branchMissing: 'cart.reviewNeedsBranch',
};

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  emptyHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, marginBottom: 0 },
  title: {},
  section: { marginTop: spacing.lg },
  sectionTitle: { marginBottom: spacing.md },
  earnNote: { marginBottom: spacing.md, marginTop: -spacing.sm },
  flex: { flex: 1 },
  curbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  carField: { marginTop: spacing.md, gap: spacing.xs },
  branchSection: { gap: spacing.md },
  carInput: {
    minHeight: 48,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.dark,
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
  blockNote: { marginBottom: spacing.sm },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.cardBg,
  },
});
