import { StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Gradient } from '@/components/ui/Gradient';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

/** Home entry to the gift-card catalog (gift coffee to someone). */
export function GiftCardHome() {
  const { t } = useI18n();
  return (
    <Pressable onPress={() => router.push('/profile/gift-cards')} accessibilityRole="button">
      <Gradient preset="purple" style={styles.card}>
        <View style={styles.iconWrap}>
          <Icon name="gift" size={24} color={colors.white} />
        </View>
        <View style={styles.body}>
          <Text variant="bodyBold" color={colors.white}>{t('gift.title')}</Text>
          <Text variant="caption" color={colors.white}>{t('gift.subtitle')}</Text>
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
