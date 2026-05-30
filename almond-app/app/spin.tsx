import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

// Stub — full animated wheel with live config built in step 11.
export default function SpinScreen() {
  const { t } = useI18n();
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎡</Text>
      <Text variant="h1" center>
        {t('spin.title')}
      </Text>
      <Button title={t('common.close')} onPress={() => router.back()} fullWidth={false} variant="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  emoji: { fontSize: 72 },
});
