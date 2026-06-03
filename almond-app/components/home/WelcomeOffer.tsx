import { StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Gradient } from '@/components/ui/Gradient';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useOrderHistory } from '@/hooks/useOrder';

/**
 * New-member welcome offer (acquisition hook): a free drink on the first order.
 * Shown only while the member has no order history yet.
 */
export function WelcomeOffer() {
  const { t } = useI18n();
  const { data: history } = useOrderHistory();

  // Only for brand-new members (no past orders).
  if (history && history.length > 0) return null;

  return (
    <Pressable onPress={() => router.push('/(tabs)/order')} accessibilityRole="button">
      <Gradient preset="purple" style={styles.card}>
        <View style={styles.iconWrap}>
          <Icon name="gift" size={24} color={colors.white} />
        </View>
        <View style={styles.body}>
          <Text variant="bodyBold" color={colors.white}>{t('home.welcomeTitle')}</Text>
          <Text variant="caption" color={colors.white}>{t('home.welcomeBody')}</Text>
        </View>
        <Icon name="navigation" size={20} color={colors.white} />
      </Gradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
});
