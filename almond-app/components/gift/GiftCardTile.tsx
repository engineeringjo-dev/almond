import { useRef } from 'react';
import { StyleSheet, Pressable, View, Animated } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Gradient } from '@/components/ui/Gradient';
import { Logo } from '@/components/ui/Logo';
import { GiftCardArt } from './GiftCardArt';
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

/** A landscape eGift card: gradient + occasion artwork + greeting + Almond badge. */
export function GiftCardTile({ design, onPress, size = 'tile', amount }: Props) {
  const { lang } = useI18n();
  const fg = design.tone === 'dark' ? colors.dark : colors.white;
  const artColor = design.tone === 'dark' ? colors.dark : '#FFFFFF';
  const featured = size === 'featured';

  // Subtle press-scale for a tactile feel.
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 7 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} disabled={!onPress} accessibilityRole="button">
      <Animated.View
        style={[featured ? styles.featured : styles.tile, styles.shadow, { transform: [{ scale }] }]}
      >
        <Gradient preset={design.gradient} style={styles.fill}>
          <GiftCardArt occasion={design.occasion} color={artColor} />

          <View style={styles.content}>
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
          </View>
        </Gradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: 220, height: 132, borderRadius: radius.lg, overflow: 'hidden' },
  featured: { width: '100%', height: 180, borderRadius: radius.lg, overflow: 'hidden' },
  shadow: { ...shadow.card },
  fill: { flex: 1 },
  content: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
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
