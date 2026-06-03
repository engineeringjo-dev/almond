import { StyleSheet, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Gradient } from '@/components/ui/Gradient';
import { Logo } from '@/components/ui/Logo';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import type { GiftDesign } from '@/lib/giftDesigns';

interface Props {
  design: GiftDesign;
  onPress?: () => void;
  /** featured = full-width hero; tile = horizontal-scroll card. */
  size?: 'featured' | 'tile';
  /** Optional amount overlay (used in the send preview). */
  amount?: number;
}

/** A landscape eGift card: brand gradient + greeting + Almond badge + icon. */
export function GiftCardTile({ design, onPress, size = 'tile', amount }: Props) {
  const { lang } = useI18n();
  const fg = design.tone === 'dark' ? colors.dark : colors.white;
  const featured = size === 'featured';

  return (
    <Pressable
      style={({ pressed }) => [
        featured ? styles.featured : styles.tile,
        styles.shadow,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
    >
      <Gradient preset={design.gradient} style={styles.fill}>
        <View style={styles.topRow}>
          <View style={styles.iconBadge}>
            <Icon name={design.icon} size={featured ? 24 : 18} color={fg} strokeWidth={1.9} />
          </View>
          <Logo variant="badge" tone={design.tone === 'dark' ? 'dark' : 'light'} size={featured ? 30 : 22} />
        </View>

        <Text
          variant={featured ? 'h2' : 'bodyBold'}
          color={fg}
          style={styles.greeting}
          numberOfLines={2}
        >
          {lang === 'ar' ? design.greetingAr : design.greetingEn}
        </Text>

        {amount != null ? (
          <Text variant={featured ? 'h2' : 'bodyBold'} color={fg}>
            {formatJOD(amount, lang)}
          </Text>
        ) : null}
      </Gradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: 220, height: 132, borderRadius: radius.lg, overflow: 'hidden' },
  featured: { width: '100%', height: 180, borderRadius: radius.lg, overflow: 'hidden' },
  shadow: { ...shadow.card },
  pressed: { opacity: 0.9 },
  fill: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { marginTop: spacing.sm },
});
