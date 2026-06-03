import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Stack, router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toggle } from '@/components/ui/Toggle';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatDate } from '@/lib/format';
import {
  useInbox,
  useNotifSettings,
  useUpdateNotifSettings,
  useMarkRead,
} from '@/hooks/useNotifications';
import { useUserId } from '@/stores/authStore';
import { startGeofencing, stopGeofencing } from '@/lib/geofence';
import type { AppNotification, NotifSettings } from '@/types';

const CATEGORY_EMOJI: Record<string, string> = {
  order: '📦',
  promo: '🏷️',
  points: '☕',
  location: '📍',
  'new-item': '✨',
};

export default function NotificationsScreen() {
  const { t, lang } = useI18n();
  const userId = useUserId();
  const inboxQ = useInbox();
  const settingsQ = useNotifSettings();
  const updateSettings = useUpdateNotifSettings();
  const markRead = useMarkRead();
  const [showExplainer, setShowExplainer] = useState(false);

  const settings = settingsQ.data;

  const setSetting = (patch: Partial<NotifSettings>) => {
    if (!settings) return;
    updateSettings.mutate({ ...settings, ...patch });
  };

  // Location offers require explicit opt-in + background permission (section 14.2).
  const onToggleLocation = async (on: boolean) => {
    if (on) {
      setShowExplainer(true);
    } else {
      setSetting({ location: false });
      await stopGeofencing();
    }
  };

  const confirmLocationOptIn = async () => {
    const ok = await startGeofencing(userId);
    setSetting({ location: ok });
    setShowExplainer(false);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('notifications.title') }} />
      <Screen
        loading={inboxQ.isLoading || settingsQ.isLoading}
        error={inboxQ.isError}
        onRetry={inboxQ.refetch}
      >
        {/* Settings */}
        <Text variant="title" style={styles.sectionTitle}>
          {t('notifications.settings')}
        </Text>
        <Card padded={false} style={styles.settingsCard}>
          <SettingRow
            label={t('notifications.promos')}
            value={!!settings?.promos}
            onChange={(v) => setSetting({ promos: v })}
          />
          <SettingRow
            label={t('notifications.order')}
            value={!!settings?.order}
            onChange={(v) => setSetting({ order: v })}
            bordered
          />
          <SettingRow
            label={t('notifications.location')}
            hint={t('notifications.locationOptIn')}
            value={!!settings?.location}
            onChange={onToggleLocation}
            bordered
          />
        </Card>

        {/* Inbox */}
        <Text variant="title" style={styles.sectionTitle}>
          {t('notifications.inbox')}
        </Text>
        {inboxQ.data && inboxQ.data.length > 0 ? (
          <View style={styles.list}>
            {inboxQ.data.map((n: AppNotification) => (
              <Pressable
                key={n.id}
                onPress={() => {
                  markRead.mutate(n.id);
                  if (n.deepLink) router.push(n.deepLink as never);
                }}
              >
                <Card style={[styles.notif, !n.read && styles.notifUnread]}>
                  <Text style={styles.notifEmoji}>{CATEGORY_EMOJI[n.category] ?? '🔔'}</Text>
                  <View style={styles.notifBody}>
                    <Text variant="bodyBold">{lang === 'ar' ? n.titleAr : n.titleEn}</Text>
                    <Text variant="caption" color={colors.warmGray}>
                      {lang === 'ar' ? n.bodyAr : n.bodyEn}
                    </Text>
                    <Text variant="caption" color={colors.warmGray}>
                      {formatDate(n.createdAt, lang)}
                    </Text>
                  </View>
                  {!n.read ? <View style={styles.unreadDot} /> : null}
                </Card>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState icon="bell" title={t('notifications.empty')} />
        )}
      </Screen>

      {/* Pre-permission explainer for background location (section 14.2) */}
      {showExplainer ? (
        <View style={styles.explainerOverlay}>
          <Card style={styles.explainerCard}>
            <Text style={styles.explainerEmoji}>📍</Text>
            <Text variant="h2" center>
              {t('notifications.location')}
            </Text>
            <Text variant="body" color={colors.warmGray} center style={styles.explainerBody}>
              {t('notifications.locationOptIn')}
            </Text>
            <View style={styles.explainerActions}>
              <Pressable style={styles.explainerBtn} onPress={confirmLocationOptIn}>
                <Text variant="bodyBold" color={colors.dark}>
                  {t('common.ok')}
                </Text>
              </Pressable>
              <Pressable style={styles.explainerCancel} onPress={() => setShowExplainer(false)}>
                <Text variant="bodyBold" color={colors.warmGray}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>
      ) : null}
    </>
  );
}

function SettingRow({
  label,
  hint,
  value,
  onChange,
  bordered,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  bordered?: boolean;
}) {
  return (
    <View style={[styles.settingRow, bordered && styles.settingBorder]}>
      <View style={styles.settingLabel}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="caption" color={colors.warmGray}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Toggle value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginBottom: spacing.md, marginTop: spacing.sm },
  settingsCard: { padding: spacing.xs, marginBottom: spacing.xl },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.md,
  },
  settingBorder: { borderTopWidth: 1, borderTopColor: colors.neutralWarm },
  settingLabel: { flex: 1, gap: 2 },
  list: { gap: spacing.md },
  notif: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  notifUnread: { borderWidth: 1, borderColor: colors.lightGold },
  notifEmoji: { fontSize: 24 },
  notifBody: { flex: 1, gap: 2 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  emptyEmoji: { fontSize: 56 },
  explainerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(46,37,82,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  explainerCard: { alignItems: 'center', gap: spacing.sm, width: '100%' },
  explainerEmoji: { fontSize: 56 },
  explainerBody: { marginVertical: spacing.sm },
  explainerActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  explainerBtn: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  explainerCancel: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
