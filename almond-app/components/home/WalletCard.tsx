import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Gradient } from '@/components/ui/Gradient';
import { colors, spacing, radius, shadow } from '@/constants/theme';
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
  const { data: balance } = useWallet();

  return (
    <Gradient preset="purple" style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Icon name="wallet" size={24} color={colors.white} />
        </View>
        <View style={styles.balanceBox}>
          <Text variant="caption" color={colors.white}>
            {t('home.walletBalance')}
          </Text>
          <Text variant="h1" color={colors.white}>
            {formatJOD(balance ?? 0, lang)}
          </Text>
        </View>
      </View>

      <Text variant="caption" color={colors.white} style={styles.hint}>
        {t('home.walletHint', { min: config.WALLET_RELOAD_BONUS[0].minJOD })}
      </Text>

      {/* Gold button → white background, black text (per design). */}
      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        onPress={() => router.push('/profile/wallet')}
        accessibilityRole="button"
      >
        <Icon name="plus" size={18} color="#000000" />
        <Text variant="bodyBold" color="#000000">
          {t('home.topUpWallet')}
        </Text>
      </Pressable>
    </Gradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
    ...shadow.raised,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceBox: { flex: 1, gap: 2 },
  hint: {},
  cta: {
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
