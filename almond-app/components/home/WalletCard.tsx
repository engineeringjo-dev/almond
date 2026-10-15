import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { HeroCard } from '@/components/ui/HeroCard';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { useWallet } from '@/hooks/useLoyalty';
import { useWalletRate } from '@/hooks/useWalletRate';

/**
 * Wallet card on Home (Revision Pack §J): prominent balance + top-up CTA.
 *
 * The hint states the wallet's one bonus: paying FROM the balance earns more
 * (config.WALLET_EARN_MULTIPLIER, reinstated at 1.5 on 2026-09-08), named as
 * the member's rate from the balance beside their rate otherwise — «٣٪» vs
 * «٢٪» on the entry rung — by useWalletRate. It used to promise a reload bonus
 * ("top up 20 JOD or more and get bonus points"); that is deleted (owner,
 * 2026-10-15: «لا يوجد بونص شحن، البونص للانفاق فقط»).
 */
export function WalletCard() {
  const { t, lang } = useI18n();
  const { data: balance } = useWallet();
  const walletRate = useWalletRate();

  return (
    <HeroCard style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Icon name="wallet" size={24} color={colors.onHero} />
        </View>
        <View style={styles.balanceBox}>
          <Text variant="caption" color={colors.onHero}>
            {t('home.walletBalance')}
          </Text>
          <Text variant="h1" color={colors.onHero}>
            {formatJOD(balance ?? 0, lang)}
          </Text>
        </View>
      </View>

      <Text variant="caption" color={colors.onHero} style={styles.hint}>
        {t('home.walletHint', walletRate)}
      </Text>

      {/* The card's one action: a light button on the black card. */}
      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        onPress={() => router.push('/profile/wallet')}
        accessibilityRole="button"
      >
        <Icon name="plus" size={18} color={colors.hero} />
        <Text variant="bodyBold" color={colors.hero}>
          {t('home.topUpWallet')}
        </Text>
      </Pressable>
    </HeroCard>
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
    backgroundColor: colors.onHero,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.9 },
});
