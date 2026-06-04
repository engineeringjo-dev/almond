import { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Gradient } from '@/components/ui/Gradient';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { ListRow } from '@/components/ui/ListRow';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { LanguageSheet } from '@/components/profile/LanguageSheet';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { useAuthStore } from '@/stores/authStore';
import { useLoyaltyBalance, useWallet } from '@/hooks/useLoyalty';

export default function ProfileScreen() {
  const { t, lang, isRTL } = useI18n();
  // Reading-start edge so the name + tier badge hug the correct side on web
  // (native flips automatically).
  const startEdge = Platform.OS === 'web' && isRTL ? 'flex-end' : 'flex-start';
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data: balance } = useLoyaltyBalance();
  const { data: wallet } = useWallet();
  const [langOpen, setLangOpen] = useState(false);

  const isGuest = !user || user.isGuest;

  const onLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <>
      <Screen>
        <Text variant="h1" style={styles.title}>
          {t('profile.title')}
        </Text>

        {/* Header card — purple identity hero */}
        <Gradient preset="purple" style={styles.header}>
          <View style={styles.avatar}>
            {isGuest ? (
              <Icon name="user" size={30} color={colors.white} />
            ) : (
              <Logo variant="badge" tone="light" size={40} />
            )}
          </View>
          <View style={[styles.headerBody, { alignItems: startEdge }]}>
            <Text variant="h2" color={colors.white}>{isGuest ? t('home.guest') : user?.name}</Text>
            {!isGuest && user?.phone ? (
              <Text variant="caption" color={colors.white}>
                {user.phone}
              </Text>
            ) : null}
            {/* Tier badge sits directly under the name */}
            {balance ? (
              <View style={{ alignSelf: startEdge }}>
                <TierBadge tier={balance.tier} small />
              </View>
            ) : null}
          </View>
        </Gradient>

        {/* Menu */}
        <Card padded={false} style={styles.menu}>
          <ListRow icon="history" label={t('profile.orders')} onPress={() => router.push('/profile/orders')} />
          <ListRow icon="ticket" label={t('profile.vouchers')} onPress={() => router.push('/profile/vouchers')} />
          <ListRow icon="gift" label={t('profile.giftCards')} onPress={() => router.push('/profile/gift-cards')} />
          <ListRow icon="map-pin" label={t('profile.addresses')} onPress={() => router.push('/profile/addresses')} />
          <ListRow icon="card" label={t('profile.payments')} onPress={() => router.push('/profile/payments')} />
          <ListRow
            icon="wallet"
            label={t('profile.wallet')}
            value={wallet != null ? formatJOD(wallet, lang) : undefined}
            onPress={() => router.push('/profile/wallet')}
          />
          <ListRow
            icon="user"
            label={t('profile.referral')}
            value={t('profile.referralReward')}
            onPress={() => router.push('/referral')}
          />
          <ListRow icon="bell" label={t('profile.notifications')} onPress={() => router.push('/notifications')} />
          <ListRow
            icon="globe"
            label={t('profile.language')}
            value={lang === 'ar' ? 'العربية' : 'English'}
            onPress={() => setLangOpen(true)}
          />
          <ListRow icon="help" label={t('profile.help')} onPress={() => router.push('/profile/help')} />
        </Card>

        <Card padded={false} style={styles.menu}>
          <ListRow icon="logout" label={t('profile.logout')} danger onPress={onLogout} />
        </Card>
      </Screen>

      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32 },
  headerBody: { flex: 1, gap: spacing.xs },
  menu: { marginTop: spacing.lg, paddingVertical: spacing.xs },
});
