import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { PhotoDim } from '@/components/ui/PhotoDim';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { CAMPAIGN_DESTINATIONS } from '@/lib/campaigns';
import { campaignPhotos } from './campaignPhotos';

/** Real café photography and the owner's extracted cup lead to the menu;
 *  neither image claims an invented product, price or immediate offer. */
export function CafeDiscovery() {
  const { t } = useI18n();
  return (
    <View style={styles.section}>
      <Text variant="h2" accessibilityRole="header">{t('campaign.cafeTitle')}</Text>
      <View style={styles.row}>
        <View style={styles.photo}>
          <Image source={campaignPhotos.cafe} style={styles.image} resizeMode="contain" accessible={false} accessibilityIgnoresInvertColors />
          <PhotoDim />
        </View>
        <View style={styles.words}>
          <Image source={campaignPhotos.cup} style={styles.cup} resizeMode="contain" accessible={false} accessibilityIgnoresInvertColors />
          <Text variant="body">{t('campaign.cafeBody')}</Text>
        </View>
      </View>
      <Button title={t('campaign.browseMenu')} onPress={() => router.push(CAMPAIGN_DESTINATIONS.menu)} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  photo: { width: '42%', aspectRatio: 2 / 3, backgroundColor: colors.white, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  words: { flex: 1, minWidth: 0, gap: spacing.sm },
  cup: { width: '100%', height: 112 },
});
