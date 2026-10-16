import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { CampaignPhoto } from '@/components/home/CampaignPhoto';
import { CafeDiscovery } from '@/components/home/CafeDiscovery';
import { CateringEntry } from '@/components/home/CateringEntry';
import { MemberOffers } from '@/components/home/MemberOffers';
import { comboOffer } from '@/components/home/ComboOfferCard';
import { config } from '@/constants/config';
import { colors, layout, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { CAMPAIGN_DESTINATIONS, campaignColumns, comboCampaign } from '@/lib/campaigns';

/** Price-free campaign examples. Actual item selection and pricing happen
 *  in the existing Order journey; these photos never mutate a basket. */
export default function CampaignsScreen() {
  const { t, lang } = useI18n();
  const { width, fontScale } = useWindowDimensions();
  const columns = campaignColumns(width, fontScale);
  // earn-arith-exempt: the campaign's configured points LABEL only. §7 T7.
  const campaign = comboCampaign(config.COMBO_BONUS_POINTS);
  const copy = comboOffer(lang);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('campaign.title') }} />
      <Screen edges={['bottom']} contentStyle={styles.content}>
        {campaign && copy ? (
          <View style={styles.section}>
            <Text variant="h1" accessibilityRole="header">{t('campaign.comboName')}</Text>
            <Text variant="body">{t('campaign.comboSummary', copy.params)}</Text>
            <Text variant="caption" color={colors.warmGray}>{t('campaign.exampleNote')}</Text>
            <Text variant="caption" color={colors.warmGray}>{t(copy.bodyKey, copy.params)}</Text>
            <Text variant="caption" color={colors.warmGray}>{t('campaign.pointsNote')}</Text>
            <Button title={t('campaign.chooseCombo')} onPress={() => router.push(CAMPAIGN_DESTINATIONS.menu)} />
            <View style={styles.grid}>
              {campaign.examples.map((example) => (
                <View key={example.id} style={[styles.example, columns === 2 && styles.half]}>
                  <CampaignPhoto photo={example.photo} points={campaign.points} />
                  <Text variant="bodyBold" style={styles.caption}>{t(example.titleKey)}</Text>
                </View>
              ))}
            </View>
            <Button title={t('campaign.chooseCombo')} onPress={() => router.push(CAMPAIGN_DESTINATIONS.menu)} />
          </View>
        ) : null}

        <CafeDiscovery />
        <CateringEntry />
        <MemberOffers />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', gap: spacing.xl },
  section: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  example: { width: '100%', minWidth: 0 },
  half: { width: undefined, flexBasis: '45%', flexGrow: 1 },
  caption: { paddingTop: spacing.sm },
});
