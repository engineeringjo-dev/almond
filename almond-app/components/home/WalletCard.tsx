import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { useWallet } from '@/hooks/useLoyalty';

/**
 * Wallet card on Home (Revision Pack §J): prominent balance + top-up CTA.
 *
 * The hint used to read "Pay from balance and earn +50% points (×1.5)" —
 * config.WALLET_EARN_MULTIPLIER is 1.0 (retired, zero rows in 171,291 live
 * transactions), so that paid nothing. The RELOAD bonus is real and unretired
 * (config.WALLET_RELOAD_BONUS, granted in bff/src/routes/wallet.ts), so the
 * card now says that instead, with its own threshold interpolated.
 */
export function WalletCard() {
  const { t, lang } = useI18n();
  const { data: balance, isLoading, isError, refetch } = useWallet();

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Icon name="wallet" size={24} color={colors.dark} />
        </View>
        <View style={styles.balanceBox}>
          <Text variant="caption" color={colors.dark}>
            {t('home.walletBalance')}
          </Text>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel={t('common.loading')} style={styles.loading} />
          ) : isError || balance == null ? (
            <Text variant="body" color={colors.textSecondary}>{t('home.walletUnavailable')}</Text>
          ) : (
            <Text variant="h1" color={colors.dark}>{formatJOD(balance, lang)}</Text>
          )}
        </View>
      </View>

      <Text variant="caption" color={colors.dark} style={styles.hint}>
        {t('home.walletHint', { min: config.WALLET_RELOAD_BONUS[0].minJOD })}
      </Text>

      {/* A failed balance request is recoverable without displaying a false zero. */}
      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        onPress={() => { if (isError || balance == null) { void refetch(); } else { router.push('/profile/wallet'); } }}
        disabled={isLoading}
        aria-disabled={isLoading}
        accessibilityLabel={isError || (!isLoading && balance == null) ? t('home.retryWallet') : t('home.topUpWallet')}
        accessibilityRole="button"
      >
        <Icon name={isError || balance == null ? 'reorder' : 'plus'} size={18} color={colors.primary} />
        <Text variant="bodyBold" color={colors.primary}>
          {t(isError || (!isLoading && balance == null) ? 'common.retry' : 'home.topUpWallet')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceBox: { flex: 1, minWidth: 0, gap: 2 },
  loading: { alignSelf: 'flex-start', minHeight: 34 },
  hint: {},
  cta: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.9 },
});
