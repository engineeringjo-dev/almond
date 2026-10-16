import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';

/**
 * THE BLACK CARD — what the violet gradients became. Owner, 2026-10-15:
 * «اعمل الهوية اسود وابيض كالشعار … المحل اندستريا واجهاته وسقفه اسود».
 *
 * Ink on the white page in light mode, the raised card with an edge in dark
 * mode (`colors.hero`, shared theme). Text inside it is `colors.onHero` and
 * its captions `colors.onHeroMuted`. Not `colors.white`, which is right only
 * while the card is black, and not the page's ink, which is black on black.
 */
export function HeroCard({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <View style={[styles.hero, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.hero,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroEdge,
  },
});
