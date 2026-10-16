import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { formatDate } from '@/lib/format';
import { voucherAvailabilityKey } from '@/lib/redeemSheet';
import type { Voucher } from '@/types';

const TYPE_ICON: Record<Voucher['type'], IconName> = {
  credit: 'coins',
  'free-item': 'gift',
  discount: 'tag',
};

export function VoucherCard({ voucher }: { voucher: Voucher }) {
  const { t, lang } = useI18n();
  return (
    <View style={styles.card} testID="voucher-card">
      <View style={styles.left}>
        <Icon name={TYPE_ICON[voucher.type]} size={24} color={colors.dark} strokeWidth={1.75} />
      </View>
      <View style={styles.body}>
        <Text variant="bodyBold" selectable>{lang === 'ar' ? voucher.titleAr : voucher.titleEn}</Text>
        <Text variant="caption" color={colors.warmGray} selectable>
          {t('loyalty.expiresOn', { date: formatDate(voucher.expiresAt, lang) })}
        </Text>
        <Text variant="caption" color={colors.warmGray}>
          {t(voucherAvailabilityKey(config.DATA_SOURCE))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.lightGold,
    borderStyle: 'dashed',
  },
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
