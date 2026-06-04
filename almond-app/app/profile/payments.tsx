import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { paymentIcon } from '@/lib/paymentIcon';
import { paymentMethods } from '@/services/seed';

export default function PaymentsScreen() {
  const { t, lang } = useI18n();
  return (
    <>
      <Stack.Screen options={{ title: t('profile.payments') }} />
      <Screen>
        <Card padded={false} style={styles.menu}>
          {paymentMethods.map((m, i) => (
            <View key={m.id} style={[styles.row, i > 0 && styles.border]}>
              <View style={styles.iconWrap}>
                <Icon name={paymentIcon(m.id)} size={20} color={colors.primary} strokeWidth={1.9} />
              </View>
              <Text variant="body" style={styles.label}>
                {lang === 'ar' ? m.nameAr : m.nameEn}
              </Text>
            </View>
          ))}
        </Card>
        <Text variant="caption" color={colors.warmGray} style={styles.note}>
          {/* Processing is mocked in MVP (section 0.3). */}
          {lang === 'ar'
            ? 'تتم معالجة الدفع بشكل تجريبي في هذه النسخة.'
            : 'Payment processing is mocked in this MVP.'}
        </Text>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  menu: { paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  border: { borderTopWidth: 1, borderTopColor: colors.neutralWarm },
  iconWrap: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { flex: 1 },
  note: { marginTop: spacing.lg, textAlign: 'center' },
});
