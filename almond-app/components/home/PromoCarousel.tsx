import { StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { ComboOfferCard } from '@/components/home/ComboOfferCard';
import { Button } from '@/components/ui/Button';
import { config } from '@/constants/config';
import { spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { homeCampaignEntry } from '@/lib/campaigns';

/** Keep Home stationary and compact. The actionable offer rail lives on
 *  /campaigns; ordering and reordering stay close to the member card. */
export function PromoCarousel() {
  const { t } = useI18n();
  // earn-arith-exempt: choosing a presentation from the configured LABEL. §7 T7.
  const entry = homeCampaignEntry(config.COMBO_BONUS_POINTS);
  if (entry.kind === 'combo') return <ComboOfferCard />;
  return (
    <Button
      title={t(entry.labelKey)}
      variant="secondary"
      onPress={() => router.push(entry.href)}
      style={styles.entry}
    />
  );
}

const styles = StyleSheet.create({
  entry: { marginBottom: spacing.lg },
});
