import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { PhotoDim } from '@/components/ui/PhotoDim';
import { colors, fontFamily, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { comboCampaign, type ComboCampaignPhoto } from '@/lib/campaigns';
import { campaignPhotos } from './campaignPhotos';

/** Whole, price-free artwork; the current reward is separate readable text. */
export function CampaignPhoto({ photo, points, compact = false }: {
  photo: ComboCampaignPhoto;
  points: number;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const campaign = comboCampaign(points);
  if (!campaign) return null;
  return (
    <View style={[styles.frame, compact && styles.compact]}>
      <Image source={campaignPhotos[photo]} style={styles.image} resizeMode="contain" accessible={false} accessibilityIgnoresInvertColors />
      <PhotoDim />
      <View style={styles.badge}>
        <Text
          variant="caption"
          color={colors.red}
          accessibilityLabel={t('campaign.comboSummary', { points: campaign.points })}
          style={styles.badgeText}
        >
          {t('campaign.comboBadge', { points: campaign.points })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 3 / 2, backgroundColor: colors.white, overflow: 'hidden' },
  compact: { height: 168, aspectRatio: undefined },
  image: { width: '100%', height: '100%' },
  // Opaque theme paper keeps the red legible over either photograph/scheme.
  badge: { position: 'absolute', top: spacing.sm, start: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.cream },
  badgeText: { writingDirection: 'ltr', textAlign: 'left', fontFamily: fontFamily.bold, fontVariant: ['tabular-nums'] },
});
