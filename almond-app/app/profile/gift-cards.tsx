import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { GiftCardTile } from '@/components/gift/GiftCardTile';
import { GiftSendSheet } from '@/components/gift/GiftSendSheet';
import { GiftRedeemSheet } from '@/components/gift/GiftRedeemSheet';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD, formatDate } from '@/lib/format';
import { useSentGifts } from '@/hooks/useLoyalty';
import {
  GIFT_DESIGNS,
  GIFT_OCCASIONS,
  giftDesignsByOccasion,
  giftDesignById,
  type GiftDesign,
} from '@/lib/giftDesigns';

export default function GiftCardsScreen() {
  const { t, lang } = useI18n();
  const { data: sentGifts } = useSentGifts();
  const [selected, setSelected] = useState<GiftDesign | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);

  const featured = GIFT_DESIGNS[2]; // a colourful birthday card as the hero

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('gift.title') }} />
      <Screen>
        <Text variant="caption" color={colors.warmGray} style={styles.subtitle}>
          {t('gift.subtitle')}
        </Text>

        {/* Got a gift card? Add it here */}
        <Pressable onPress={() => setRedeemOpen(true)}>
          <Card style={styles.addRow}>
            <View style={styles.addIcon}>
              <Icon name="card" size={20} color={colors.primary} />
            </View>
            <Text variant="bodyBold" style={styles.flex}>{t('gift.addHave')}</Text>
            <Icon name="plus" size={18} color={colors.primary} />
          </Card>
        </Pressable>

        {/* Featured hero */}
        <Text variant="title" style={styles.section}>{t('gift.featured')}</Text>
        <GiftCardTile design={featured} size="featured" onPress={() => setSelected(featured)} />

        {/* Occasions */}
        {GIFT_OCCASIONS.map((occ) => {
          const designs = giftDesignsByOccasion(occ.id);
          if (designs.length === 0) return null;
          return (
            <View key={occ.id} style={styles.section}>
              <Text variant="title" style={styles.occTitle}>
                {lang === 'ar' ? occ.titleAr : occ.titleEn}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {designs.map((d) => (
                  <GiftCardTile key={d.id} design={d} onPress={() => setSelected(d)} />
                ))}
              </ScrollView>
            </View>
          );
        })}

        {/* Sent eGift history */}
        {sentGifts && sentGifts.length > 0 ? (
          <View style={styles.section}>
            <Text variant="title" style={styles.occTitle}>{t('gift.history')}</Text>
            <Card padded={false} style={styles.historyCard}>
              {sentGifts.map((g, i) => (
                <View key={g.id} style={[styles.historyRow, i > 0 && styles.historyBorder]}>
                  <View style={styles.flex}>
                    <Text variant="bodyBold">{t('gift.toName', { name: g.recipientName })}</Text>
                    <Text variant="caption" color={colors.warmGray}>
                      {g.code} · {formatDate(g.createdAt, lang)}
                    </Text>
                  </View>
                  <Text variant="price">{formatJOD(g.amount, lang)}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {/* About */}
        <View style={styles.section}>
          <Text variant="title" style={styles.occTitle}>{t('gift.about')}</Text>
          <Text variant="body" color={colors.warmGray}>{t('gift.aboutBody')}</Text>
        </View>
      </Screen>

      <GiftSendSheet design={selected} visible={!!selected} onClose={() => setSelected(null)} />
      <GiftRedeemSheet visible={redeemOpen} onClose={() => setRedeemOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: spacing.lg },
  flex: { flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  addIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center', justifyContent: 'center',
  },
  section: { marginTop: spacing.xl },
  occTitle: { marginBottom: spacing.md },
  row: { gap: spacing.md, paddingEnd: spacing.lg },
  historyCard: { overflow: 'hidden' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  historyBorder: { borderTopWidth: 1, borderTopColor: colors.neutralWarm },
});
