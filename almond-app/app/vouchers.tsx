import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { VoucherCard } from '@/components/loyalty/VoucherCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useVouchers } from '@/hooks/useLoyalty';
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
  const { data, isLoading, isError, refetch } = useVouchers();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('profile.vouchers') }} />
      <Screen loading={isLoading} error={isError} onRetry={refetch}>
        {data && data.length > 0 ? (
          <View style={styles.list}>
            {data.map((v: Voucher) => (
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
});
