import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { PhotoDim } from '@/components/ui/PhotoDim';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';
import { CAMPAIGN_DESTINATIONS } from '@/lib/campaigns';
import { forwardChevron } from '@/lib/direction';
import { campaignPhotos } from './campaignPhotos';

/** A real contact handoff, not an instant catering basket or a quote form. */
export function CateringEntry() {
  const { t, lang } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('campaign.cateringAction')}
      accessibilityHint={t('campaign.cateringBody')}
      onPress={() => router.push(CAMPAIGN_DESTINATIONS.catering)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.photo}>
        <Image source={campaignPhotos.catering} style={styles.image} resizeMode="contain" accessible={false} accessibilityIgnoresInvertColors />
        <PhotoDim />
      </View>
      <View style={styles.words}>
        <Text variant="title">{t('campaign.cateringTitle')}</Text>
        <Text variant="caption" color={colors.warmGray}>{t('campaign.cateringAction')}</Text>
      </View>
      <Icon name={forwardChevron(lang)} size={18} color={colors.warmGray} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH_TARGET, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline, marginBottom: spacing.lg },
  photo: { width: '32%', aspectRatio: 3 / 2, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.white },
  image: { width: '100%', height: '100%' },
  words: { flex: 1, minWidth: 0, gap: spacing.xs },
  pressed: { opacity: 0.75 },
});
