import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { PhotoDim } from '@/components/ui/PhotoDim';
import { colors, fontFamily, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { campaignAccessibleLabel, type CampaignSlide } from '@/lib/campaignSlides';
import { campaignSlidePhotos } from './campaignSlidePhotos';

export function CampaignSlideCard({ slide, active, extraPercent }: {
  slide: CampaignSlide;
  active: boolean;
  extraPercent: number;
}) {
  const { t, lang } = useI18n();
  const photo = slide.id === 'gift-card'
    ? campaignSlidePhotos[lang === 'ar' ? 'giftAr' : 'giftEn']
    : campaignSlidePhotos[slide.id];
  const title = t(`campaignSlides.${slide.titleKey}`, { extra: extraPercent });
  const body = t(`campaignSlides.${slide.bodyKey}`, { extra: extraPercent });
  const action = t(`campaignSlides.${slide.actionKey}`);
  const exclusions = slide.id === 'wallet' ? t('campaignSlides.walletExclusions') : '';
  const content = (
    <>
      <View style={styles.photo}>
        <Image source={photo} style={styles.image} resizeMode="contain" accessible={false} accessibilityIgnoresInvertColors />
        <PhotoDim />
      </View>
      <View style={styles.words}>
        <Text variant="h2">{title}</Text>
        <Text variant="caption" color={colors.warmGray}>{body}</Text>
        {exclusions ? <Text variant="caption" color={colors.warmGray}>{exclusions}</Text> : null}
        <Text variant="caption" style={styles.link}>{action}</Text>
      </View>
    </>
  );
  // Inactive slides contain no pressable descendant, so hidden actions cannot
  // enter keyboard focus even on renderers that ignore aria-hidden.
  if (!active) return <View style={styles.card}>{content}</View>;
  return (
    <Pressable
      onPress={() => router.push(slide.params ? { pathname: slide.href, params: slide.params } : slide.href)}
      accessibilityRole="button"
      accessibilityLabel={campaignAccessibleLabel(title, body, action, exclusions)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surface },
  photo: { height: 168, backgroundColor: colors.white, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  words: { padding: spacing.lg, gap: spacing.xs },
  link: { fontFamily: fontFamily.bold, textDecorationLine: 'underline', marginTop: spacing.xs },
  pressed: { opacity: 0.8 },
});
