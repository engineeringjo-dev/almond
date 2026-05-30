import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useAppStore } from '@/stores/appStore';

// Minimal stub — full 3-slide onboarding built in step 3.
export default function Onboarding() {
  const { t } = useI18n();
  const complete = useAppStore((s) => s.completeOnboarding);
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>☕</Text>
      <Text variant="h1" center>{t('onboarding.slide1Title')}</Text>
      <Button
        title={t('onboarding.start')}
        onPress={() => {
          complete();
          router.replace('/(tabs)');
        }}
        style={{ marginTop: spacing.xl }}
        fullWidth={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logo: { fontSize: 72, marginBottom: spacing.lg },
});
