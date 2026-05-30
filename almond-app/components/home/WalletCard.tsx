import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { useWallet } from '@/hooks/useLoyalty';

/**
 * Wallet card on Home (Revision Pack §J): prominent balance + top-up CTA with
 * the pay-from-balance hint (1.5× cup fill).
 */
export function WalletCard() {
  const { t, lang } = useI18n();
  const { data: balance } = useWallet();

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Icon name="wallet" size={24} color={colors.gold} />
        </View>
        <View style={styles.balanceBox}>
          <Text variant="caption" color={colors.lightGold}>
            {t('home.walletBalance')}
          </Text>
          <Text variant="h1" color={colors.cream}>
            {formatJOD(balance ?? 0, lang)}
          </Text>
        </View>
      </View>

      <Text variant="caption" color={colors.lightGold} style={styles.hint}>
        {t('home.walletHint')}
      </Text>

      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        onPress={() => router.push('/profile/wallet')}
        accessibilityRole="button"
      >
        <Icon name="plus" size={18} color={colors.dark} />
        <Text variant="bodyBold" color={colors.dark}>
          {t('home.topUpWallet')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dark,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.raised,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brown,
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
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.9 },
});
