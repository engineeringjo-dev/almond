import { View, StyleSheet, Linking } from 'react-native';
import { Stack } from 'expo-router';
import { contactLinks } from '@almond/shared/lib/phone';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { spacing } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';

// U+2066 … U+2069: isolate the number as left-to-right inside Arabic text, or
// the leading "+" is laid out at the far end of it.
const ltr = (s: string): string => `⁦${s}⁩`;

/**
 * Help: the unified call centre and WhatsApp line, read from
 * config.CONTACT_PHONE_E164 (owner, 2026-10-15). This screen used to ship a
 * placeholder number (+962 6 000 0000) and a link to instagram.com's home
 * page; the Instagram row is gone until the account's real address is given.
 */
export default function HelpScreen() {
  const { t } = useI18n();
  const contact = contactLinks(config.CONTACT_PHONE_E164);
  return (
    <>
      <Stack.Screen options={{ title: t('profile.help') }} />
      <Screen>
        <View style={styles.hero}>
          <Text style={styles.emoji}>☕</Text>
          <Text variant="h2" center>
            {t('help.heading')}
          </Text>
          <Text variant="caption" center>
            {t('help.hours')}
          </Text>
        </View>
        <Card padded={false}>
          <ListRow
            icon="whatsapp"
            label={t('help.whatsapp')}
            value={ltr(contact.display)}
            onPress={() => Linking.openURL(contact.whatsapp)}
          />
          <ListRow
            icon="phone"
            label={t('help.call')}
            value={ltr(contact.display)}
            onPress={() => Linking.openURL(contact.tel)}
          />
          <ListRow
            icon="mail"
            label={t('help.email')}
            onPress={() => Linking.openURL('mailto:hello@almondcoffeehouse.com')}
          />
          <ListRow
            icon="globe"
            label={t('help.website')}
            onPress={() => Linking.openURL('https://almondcoffeehouse.com')}
          />
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  emoji: { fontSize: 56 },
});
