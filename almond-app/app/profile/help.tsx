import { View, StyleSheet, Linking } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

export default function HelpScreen() {
  const { t, lang } = useI18n();
  return (
    <>
      <Stack.Screen options={{ title: t('profile.help') }} />
      <Screen>
        <View style={styles.hero}>
          <Text style={styles.emoji}>☕</Text>
          <Text variant="h2" center>
            {lang === 'ar' ? 'كيف نقدر نساعدك؟' : 'How can we help?'}
          </Text>
        </View>
        <Card padded={false}>
          <ListRow
            emoji="📞"
            label={lang === 'ar' ? 'اتصل بنا' : 'Call us'}
            value="+962 6 000 0000"
            onPress={() => Linking.openURL('tel:+96260000000')}
          />
          <ListRow
            emoji="✉️"
            label={lang === 'ar' ? 'راسلنا' : 'Email us'}
            onPress={() => Linking.openURL('mailto:hello@almondcoffeehouse.com')}
          />
          <ListRow
            emoji="🌐"
            label={lang === 'ar' ? 'موقعنا' : 'Our website'}
            onPress={() => Linking.openURL('https://almondcoffeehouse.com')}
          />
          <ListRow
            emoji="📸"
            label="Instagram"
            onPress={() => Linking.openURL('https://instagram.com')}
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
