import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { HeroCard } from '@/components/ui/HeroCard';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { ListRow } from '@/components/ui/ListRow';
import { TierBadge } from '@/components/loyalty/TierBadge';
import { LanguageSheet } from '@/components/profile/LanguageSheet';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { layoutFollowsLanguage } from '@/lib/direction';
import { formatJODHeld } from '@/lib/format';
import { config } from '@/constants/config';
import { isProfileComplete } from '@almond/shared/loyalty/profile';
import { ltrIsolate } from '@almond/shared/lib/phone';
import { useAuthStore } from '@/stores/authStore';
import { useLoyaltyBalance, useWallet } from '@/hooks/useLoyalty';

export default function ProfileScreen() {
  const { t, lang } = useI18n();
  // Reading-start edge for the name + tier badge. The web build now carries
  // <html dir>, so flex-start IS the reading start there too; only a native
  // layout not yet mirrored for the language needs the far edge.
  const startEdge = layoutFollowsLanguage(lang) ? 'flex-start' : 'flex-end';
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
        <HeroCard style={styles.header}>
          <View style={styles.avatar}>
            {isGuest ? (
              <Icon name="user" size={30} color={colors.onHero} />
            ) : (
              <Logo variant="badge" tone="light" size={40} />
            )}
          </View>
          <View style={[styles.headerBody, { alignItems: startEdge }]}>
            {/* The same blank-name fallback as the home greeting: `home.guest`
                exists in both locale files, `user.name` exists in neither. A
                bare `user?.name` rendered an empty heading the moment the
                fabricated literal was removed. */}
            <Text variant="h2" color={colors.onHero}>
              {isGuest || !user?.name?.trim() ? t('home.guest') : user.name}
            </Text>
            {!isGuest && user?.phone ? (
              // Left to right inside an Arabic line, or the "+" lands at the
              // far end: «962790000000+» (BD, lib/phone.ts).
              <Text variant="caption" color={colors.onHero}>
                {ltrIsolate(user.phone)}
              </Text>
            ) : null}
            {/* Tier badge sits directly under the name */}
            {balance ? (
              <View style={{ alignSelf: startEdge }}>
                <TierBadge tier={balance.tier} small />
              </View>
            ) : null}
          </View>
        </HeroCard>

        {/* Three groups, no headings: the account, the money, the app. One
            card of twelve rows read as a settings dump (page-division prompt,
            §8). «قسائمي» is not here any more: it is a door off the Rewards
            tab, where the coupon is made. */}
        <Card padded={false} style={styles.menu}>
          {/* First row on purpose: it is the only one that pays, and a member
              who has not filled it in is the one we most want to reach. */}
          <ListRow
            icon="user"
            label={t('profile.details')}
            value={
              // The same four facts the bonus is paid on (name, birth date,
              // gender, phone) — not a name alone, since 2026-09-24.
              user && isProfileComplete({
                name: user.name, birthday: user.birthday ?? null, gender: user.gender ?? null, phone: user.phone,
              })
                ? undefined
                : t('profile.detailsEarn', { points: config.PROFILE_COMPLETION_BONUS })
            }
            onPress={() => router.push('/profile/details')}
          />
          <ListRow
            icon="users"
            label={t('profile.referral')}
            value={t('profile.referralReward', { points: config.REFERRAL_REWARD_POINTS })}
            onPress={() => router.push('/referral')}
          />
          <ListRow icon="history" label={t('profile.orders')} onPress={() => router.push('/profile/orders')} />
          <ListRow icon="map-pin" label={t('profile.addresses')} onPress={() => router.push('/profile/addresses')} />
        </Card>

        <Card padded={false} style={styles.menu}>
          <ListRow
            icon="wallet"
            label={t('profile.wallet')}
            value={wallet != null ? formatJODHeld(wallet, lang) : undefined}
            onPress={() => router.push('/profile/wallet')}
          />
          <ListRow icon="gift" label={t('profile.giftCards')} onPress={() => router.push('/profile/gift-cards')} />
          <ListRow icon="share" label={t('profile.transfer')} onPress={() => router.push('/transfer')} />
          <ListRow icon="card" label={t('profile.payments')} onPress={() => router.push('/profile/payments')} />
        </Card>

        <Card padded={false} style={styles.menu}>
          <ListRow icon="bell" label={t('profile.notifications')} onPress={() => router.push('/notifications')} />
          <ListRow
            icon="globe"
            label={t('profile.language')}
            value={lang === 'ar' ? 'العربية' : 'English'}
            onPress={() => setLangOpen(true)}
          />
          <ListRow icon="help" label={t('profile.help')} onPress={() => router.push('/profile/help')} />
          <ListRow icon="menu" label={t('policies.title')} onPress={() => router.push('/profile/policies')} />
        </Card>

        <Card padded={false} style={styles.menu}>
          <ListRow icon="logout" label={t('profile.logout')} danger onPress={onLogout} />
          {/* Apple 5.1.1(v) / Google Play: deletion is offered in the app, by
              the member, for their own account — so not to a guest. */}
          {!isGuest ? (
            <ListRow icon="trash" label={t('deleteAccount.title')} danger onPress={() => router.push('/profile/delete-account')} />
          ) : null}
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
