import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { colors, spacing } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { formatDate } from '@/lib/format';
import { loyaltyService } from '@/services/loyalty.service';
import { useAuthStore, useUserId } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';

/**
 * «حذف الحساب» — owner, 2026-10-15: «اضف حذف الحساب», «مهلة تراجع قبل الحذف
 * نعم», «عند الحذف يبقى الرصيد مربوط بالمعلومات ورقم الهاتف», «النقاط لا تسقط
 * الا بالموعدها». The rule: @almond/shared/loyalty/accountDeletion.
 *
 * The screen says plainly what goes and what stays BEFORE the member asks,
 * asks once more before sending, and afterwards gives the date and how to
 * change their mind. Precedent: Apple's guideline 5.1.1(v) (deletion offered
 * in the app) and Instagram/X (a grace period that a sign-in cancels).
 */
export default function DeleteAccountScreen() {
  const { t, lang } = useI18n();
  const userId = useUserId();
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();
  const key = ['deletion', userId] as const;
  const q = useQuery({ queryKey: key, queryFn: () => loyaltyService.getDeletion(userId) });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: key });
    } catch {
      useToastStore.getState().showError(t('deleteAccount.error'));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const pending = q.data ?? null;
  const days = config.ACCOUNT_DELETION_GRACE_DAYS;

  return (
    <>
      <Stack.Screen options={{ title: t('deleteAccount.title') }} />
      <Screen loading={q.isLoading} error={q.isError} onRetry={q.refetch}>
        {pending ? (
          <>
            <View style={styles.block}>
              <Text variant="h2">{t('deleteAccount.pendingTitle', { date: formatDate(pending.eraseAfter, lang) })}</Text>
              <Text variant="body" color={colors.warmGray}>
                {t('deleteAccount.pendingBody')}
              </Text>
            </View>
            <Card padded={false}>
              <ListRow
                icon="reorder"
                label={t('deleteAccount.cancel')}
                onPress={() => { if (!busy) void act(() => loyaltyService.cancelDeletion(userId)); }}
              />
              <ListRow
                icon="logout"
                label={t('profile.logout')}
                danger
                onPress={() => {
                  logout();
                  router.replace('/(auth)/login');
                }}
              />
            </Card>
          </>
        ) : (
          <>
            <View style={styles.block}>
              <Text variant="title">{t('deleteAccount.goesTitle')}</Text>
              <Text variant="body" color={colors.warmGray}>{t('deleteAccount.goesBody')}</Text>
            </View>
            <View style={styles.block}>
              <Text variant="title">{t('deleteAccount.staysTitle')}</Text>
              <Text variant="body" color={colors.warmGray}>{t('deleteAccount.staysBody')}</Text>
            </View>
            <View style={styles.block}>
              <Text variant="title">{t('deleteAccount.whenTitle')}</Text>
              <Text variant="body" color={colors.warmGray}>{t('deleteAccount.whenBody', { days })}</Text>
            </View>
            <Card padded={false}>
              {confirming ? (
                <>
                  <ListRow
                    icon="trash"
                    label={t('deleteAccount.confirm')}
                    danger
                    onPress={() => { if (!busy) void act(() => loyaltyService.requestDeletion(userId)); }}
                  />
                  <ListRow icon="close" label={t('deleteAccount.back')} onPress={() => setConfirming(false)} />
                </>
              ) : (
                <ListRow icon="trash" label={t('deleteAccount.request')} danger onPress={() => setConfirming(true)} />
              )}
            </Card>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs, marginBottom: spacing.lg },
});
