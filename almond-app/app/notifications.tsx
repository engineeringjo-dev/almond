import { View, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

// Stub — full inbox + settings + geofence opt-in built in step 13.
export default function NotificationsScreen() {
  const { t } = useI18n();
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('notifications.title') }} />
      <Screen scroll={false}>
        <View style={styles.center}>
          <Text style={styles.emoji}>🔔</Text>
          <Text variant="h2" center>
            {t('notifications.title')}
          </Text>
          <Button
            title={t('common.close')}
            onPress={() => router.back()}
            variant="ghost"
            fullWidth={false}
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emoji: { fontSize: 64 },
});
