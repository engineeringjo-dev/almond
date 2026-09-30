import { useRef } from 'react';
import { StyleSheet, Pressable, Animated, Image } from 'react-native';

import { radius, shadow } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { GIFT_ART } from '@/lib/giftArt';
import type { GiftDesign } from '@almond/shared/gifts';

/** The artwork's shape: a CR80 card, 243 × 153 pt. */
export const GIFT_CARD_RATIO = 243 / 153;

interface Props {
  design: GiftDesign;
  onPress?: () => void;
  /** featured = full width (hero, send preview); tile = horizontal-scroll card. */
  size?: 'featured' | 'tile';
}

/**
 * One eGift card: the design's artwork, exactly as drawn. The phrase and logo
 * are part of the art, so nothing is laid over it — amount, recipient and
 * message sit outside the card (GiftEnvelope), per the design brief.
 * Precedent: Starbucks and Apple Wallet show the card art untouched and put
 * the personal details beneath it.
 */
export function GiftCardTile({ design, onPress, size = 'tile' }: Props) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) => {
    if (reduced) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, friction: 7 }).start();
  };

  const card = (
    <Animated.View
      style={[size === 'featured' ? styles.featured : styles.tile, styles.shadow, { backgroundColor: design.bg, transform: [{ scale }] }]}
    >
      <Image
        source={GIFT_ART[design.id]}
        style={styles.art}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );

  if (!onPress) {
    return (
      <Animated.View role="img" aria-label={design.phrase} accessibilityLanguage={design.lang}>
        {card}
      </Animated.View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => press(0.97)}
      onPressOut={() => press(1)}
      role="button"
      aria-label={design.phrase}
      accessibilityHint={design.gloss}
      accessibilityLanguage={design.lang}
    >
      {card}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: 220, aspectRatio: GIFT_CARD_RATIO, borderRadius: radius.lg, overflow: 'hidden' },
  featured: { width: '100%', aspectRatio: GIFT_CARD_RATIO, borderRadius: radius.lg, overflow: 'hidden' },
  // A hairline so the dark and the pale cards both keep an edge on any
  // background. Inline hex on purpose: bff/test/earn.test.ts uses this file
  // as its "hex literals survive the comment stripper" canary.
  shadow: { ...shadow.card, borderWidth: StyleSheet.hairlineWidth, borderColor: '#2A20401F' },
  art: { width: '100%', height: '100%' },
});
