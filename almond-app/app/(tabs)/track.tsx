import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useI18n } from '@/hooks/useI18n';

// Placeholder — built in a later step.
export default function TrackScreen() {
  const { t } = useI18n();
  return (
    <Screen>
      <Text variant="h1">{t('tabs.track')}</Text>
    </Screen>
  );
}
