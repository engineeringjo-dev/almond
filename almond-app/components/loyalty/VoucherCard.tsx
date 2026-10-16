import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { RedemptionQr } from './RedemptionQr';
import { colors, spacing, radius } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { formatDate, formatTime } from '@/lib/format';
import { voucherAvailabilityKey } from '@/lib/redeemSheet';
import type { Voucher } from '@/types';

const TYPE_ICON: Record<Voucher['type'], IconName> = {
  credit: 'coins',
  'free-item': 'gift',
  discount: 'tag',
};

export function VoucherCard({ voucher, showBarcode, onShowBarcode }: { voucher: Voucher; showBarcode?: boolean; onShowBarcode?: () => void }) {
  const { t, lang } = useI18n();
  return (
    <View style={[styles.card, voucher.redemptionId && styles.reservation]} testID="voucher-card">
      <View style={styles.summary}>
      <View style={styles.left}>
        <Icon name={TYPE_ICON[voucher.type]} size={24} color={colors.dark} strokeWidth={1.75} />
      </View>
      <View style={styles.body}>
        <Text variant="bodyBold" selectable>{lang === 'ar' ? voucher.titleAr : voucher.titleEn}</Text>
        <Text variant="caption" color={colors.warmGray} selectable>
          {voucher.redemptionId ? t('loyalty.redemptionReservationUntil', { time: formatTime(voucher.expiresAt, lang) }) : t('loyalty.expiresOn', { date: formatDate(voucher.expiresAt, lang) })}
        </Text>
        {!voucher.redemptionId ? <Text variant="caption" color={colors.warmGray}>
          {t(voucherAvailabilityKey(config.DATA_SOURCE))}
        </Text> : null}
      </View>
      </View>
      {voucher.redemptionId ? showBarcode ? <RedemptionQr key={voucher.redemptionId} redemptionId={voucher.redemptionId} /> : <Button title={t('loyalty.redemptionShowBarcode')} onPress={onShowBarcode} disabled={!onShowBarcode} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.lightGold,
    borderStyle: 'dashed',
  },
  summary: { flexDirection: 'row', gap: spacing.md },
  reservation: { borderStyle: 'solid' },
  left: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.lightGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing.xs },
});
