import { StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TierProgress } from '@/components/loyalty/TierProgress';
import { TierCards } from '@/components/loyalty/TierCards';
import { spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useLoyaltyBalance } from '@/hooks/useLoyalty';
import { useUser } from '@/stores/authStore';
import { tiers } from '@/services/seed';

/**
 * «فئتك ومزاياك» — where the member stands, and the three rungs side by side.
 *
 * Off the Rewards tab, which it used to sit at the bottom of as a carousel the
 * member had to swipe through. Precedent: Dunkin' UAE's Tier Benefits page —
 * a compact comparison. The live progress now also explains the two genuine
 * qualifying routes and the kept tier; allow scrolling at narrow/large text.
 * A guest
 * who reaches it by a link gets sign-in first, as Dunkin' puts «Sign up to
 * unlock» at the top of theirs.
 */
export default function TiersScreen() {
  const { t } = useI18n();
  const user = useUser();
  const isGuest = !user || user.isGuest;
  const balanceQ = useLoyaltyBalance();
  const header = <Stack.Screen options={{ headerShown: true, title: t('rewards.statusTitle') }} />;

  if (isGuest) {
    return (
      <>
        {header}
        <Screen>
          <Button
            title={t('auth.loginToContinue')}
            onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/tiers' } })}
            style={styles.loginCta}
          />
          <TierCards />
        </Screen>
      </>
    );
  }

  if (balanceQ.isLoading || balanceQ.isError || !balanceQ.data) {
    return (
      <>
        {header}
        <Screen loading={balanceQ.isLoading} error={balanceQ.isError} onRetry={balanceQ.refetch} />
      </>
    );
  }

  const balance = balanceQ.data;
  return (
    <>
      {header}
      <Screen onRefresh={balanceQ.refetch}>
        <Card style={styles.ladder}>
          <TierProgress tier={balance.tier} windowSpend={balance.windowSpend} nextTier={balance.nextTier} />
          {balance.tier !== tiers[tiers.length - 1].id && !balance.nextTier ? (
            <Button title={t('common.retry')} variant="outline" onPress={() => { void balanceQ.refetch(); }} style={styles.nextVisit} />
          ) : (
            <Button title={t('loyalty.nextVisitCta')} variant="outline" onPress={() => router.push('/(tabs)/order')} style={styles.nextVisit} />
          )}
        </Card>
        <TierCards current={balance.tier} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  loginCta: { marginBottom: spacing.lg },
  ladder: { marginBottom: spacing.lg },
  nextVisit: { marginTop: spacing.md },
});
