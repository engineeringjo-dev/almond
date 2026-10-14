import { StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

/** Home entry to the gift-card catalog (gift coffee to someone). */
export function GiftCardHome() {
  const { t, lang } = useI18n();
  return (
    <Pressable
      onPress={() => router.push('/profile/gift-cards')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      
        <View style={styles.iconWrap}>
          <Icon name="gift" size={24} color={colors.dark} />
        </View>
        <View style={styles.body}>
          <Text variant="bodyBold" color={colors.dark}>{t('gift.title')}</Text>
          <Text variant="caption" color={colors.dark}>{t('gift.subtitle')}</Text>
        </View>
        <Icon name={lang === 'ar' ? 'chevron-left' : 'chevron-right'} size={20} color={colors.dark} />
      
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
    borderWidth: 1,
    borderColor: colors.neutralWarm,
    backgroundColor: colors.white,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { backgroundColor: colors.surface },
});
