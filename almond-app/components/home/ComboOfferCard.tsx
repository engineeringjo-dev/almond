import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { CampaignPhoto } from '@/components/home/CampaignPhoto';
import { Text } from '@/components/ui/Text';
import { colors, fontFamily, radius, spacing } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { CAMPAIGN_DESTINATIONS } from '@/lib/campaigns';
import { comboOfferCopy } from '@/lib/comboOffer';
import { getComboStarter } from '@almond/shared/lib/recommendations';
import type { Lang } from '@/types';

/** A stationary campaign entry. The pictured pair is an example, so opening
 *  it never adds an unrelated recommendation to the customer's basket. */
export function ComboOfferCard({ inCarousel = false }: { inCarousel?: boolean }) {
  const { t, lang } = useI18n();
  const copy = comboOffer(lang);
  if (!copy) return null;
  return (
    <Pressable
      onPress={() => router.push(CAMPAIGN_DESTINATIONS.showcase)}
      accessibilityRole="button"
      accessibilityLabel={`${t('campaign.comboName')}. ${t('campaign.viewCombos')}`}
      accessibilityHint={`${t('campaign.comboSummary', copy.params)} ${t('campaign.exampleNote')} ${t(copy.bodyKey, copy.params)}`}
      style={({ pressed }) => [styles.card, inCarousel && styles.inCarousel, pressed && styles.pressed]}
    >
      <CampaignPhoto photo="americanoCookie" points={copy.params.points} compact />
      <View style={styles.words}>
        <Text variant="h2">{t('campaign.comboName')}</Text>
        <Text variant="caption" color={colors.warmGray}>{t('campaign.comboSummary', copy.params)}</Text>
        <Text variant="caption" color={colors.warmGray}>{t('campaign.comboEligibility')}</Text>
        <Text variant="caption" style={styles.link}>{t('campaign.viewCombos')}</Text>
      </View>
    </Pressable>
  );
}

/** Resolve the legacy offer's example through the shared menu helper. It stays
 *  descriptive; campaign photography never selects or adds an order line. */
export function comboOffer(lang: Lang) {
  // earn-arith-exempt: a campaign LABEL — no invoice and no grant. §7 T7.
  const points = config.COMBO_BONUS_POINTS;
  return comboOfferCopy(points, getComboStarter(), lang);
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surface, marginBottom: spacing.lg },
  inCarousel: { flex: 1, marginBottom: 0 },
  words: { padding: spacing.lg, gap: spacing.xs },
  link: { fontFamily: fontFamily.bold, textDecorationLine: 'underline', marginTop: spacing.xs },
  pressed: { opacity: 0.8 },
});
