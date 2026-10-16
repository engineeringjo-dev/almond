import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useIsFocused, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { VoucherCard } from '@/components/loyalty/VoucherCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useVouchers } from '@/hooks/useLoyalty';
import { voucherHandoff } from '@/lib/redeemSheet';
import type { Voucher } from '@/types';

/**
 * «قسائمي» — the discounts a member has made from their points.
 *
 * A door off the Rewards tab, where the coupon is made, instead of a row in
 * «المزيد» (owner question 3, page-division prompt: one entry, in Rewards).
 * Precedent: Al Ameed's «المكافآت المستبدلة» tile, on its points hub. The old
 * address, /profile/vouchers, redirects here.
 */
export default function VouchersScreen() {
  const { t } = useI18n();
  const { voucherId: rawVoucherId } = useLocalSearchParams<{ voucherId?: string | string[] }>();
  const voucherId = Array.isArray(rawVoucherId) ? rawVoucherId[0] : rawVoucherId;
  const { data, isLoading, isFetching, isError, refetch } = useVouchers();
  const { selected, others } = voucherHandoff(data ?? [], voucherId);
  const focused = useIsFocused();
  // A callback ref runs when the card actually mounts, including after Screen
  // removes its loading/error state. Refocus when this route becomes active.
  const focusSelected = useCallback((node: View | null) => {
    if (focused) node?.focus();
  }, [focused]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('profile.vouchers') }} />
      <Screen
        loading={isLoading || Boolean(voucherId && isFetching && !selected)}
        error={isError}
        onRetry={refetch}
        scrollLabel={t('profile.vouchers')}
      >
        {voucherId && !selected ? (
          <View style={styles.unavailable}>
            <Text variant="body" accessibilityRole="alert">{t('loyalty.voucherUnavailable')}</Text>
            <Button title={t('common.retry')} variant="outline" onPress={() => { void refetch(); }} />
          </View>
        ) : null}
        {data && data.length > 0 ? (
          <View style={styles.list}>
            {selected ? (
              <View
                key={selected.id}
                ref={focusSelected}
                focusable
                role="region"
                aria-label={t('loyalty.yourVoucher')}
                style={styles.list}
                testID="issued-voucher"
              >
                <Text variant="title" role="heading" aria-level={2}>{t('loyalty.yourVoucher')}</Text>
                <VoucherCard voucher={selected} />
              </View>
            ) : null}
            {others.map((v: Voucher) => (
              <VoucherCard key={v.id} voucher={v} />
            ))}
          </View>
        ) : (
          <EmptyState icon="gift" title={t('loyalty.noVouchers')} />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  unavailable: { gap: spacing.md, marginBottom: spacing.lg },
});
