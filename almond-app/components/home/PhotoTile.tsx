import { View, StyleSheet, Pressable, Image, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { menuImage } from '@/lib/menuImage';
import { PhotoDim } from '@/components/ui/PhotoDim';

export interface PhotoTileProps {
  title: string;
  subtitle?: string;
  /** The action, in words, on an ink chip: «أضف الاثنين», «اشحن محفظتك». */
  cta?: string;
  /** Menu photo paths. One, or two for a pair; none falls back to `icon`. */
  photos?: (string | undefined)[];
  icon?: IconName;
  onPress: () => void;
  /** Read after the name by a screen reader: what the tap does, when the
   *  words on the tile leave it unsaid. */
  accessibilityHint?: string;
  /** Keyboard focus on the web: the carousel brings a focused slide into view. */
  onFocus?: () => void;
  titleVariant?: 'h2' | 'bodyBold';
  /** The photo panel's width and least height, in points. */
  plate?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * ONE TILE FOR HOME: words at the start, a product photograph at the end.
 *
 * The order button, every slide of the offers carousel and «طلبك المعتاد» are
 * this tile, so Home is a few blocks that look alike rather than fourteen
 * cards that do not (expert panel, 2026-10-15: «رئيسية من 4 كتل»). Precedent:
 * Al Ameed's photo tiles and Starbucks' order cards, a photograph with a
 * short label.
 *
 * The tile is the `surface` fill, the colour of something to press. The black
 * card above it is the only black on Home.
 *
 * THE PHOTOGRAPH LEADS: it fills the tile's end edge to edge, top to bottom,
 * where it was a 112pt plate inset in the tile, 24% of it (Dunkin' panel,
 * 2026-10-15: photographs fill 53% of Dunkin's Home and 5.7% of ours).
 * Precedent: Dunkin', Talabat and Careem offer cards, the picture to the
 * card's edge.
 *
 * The photograph sits on a WHITE plate in both schemes. All but two of the
 * 308 menu photos are shot on white, so a plate is the photo's own ground. In
 * dark mode it reads as a product card, not as a white hole cut in the tile,
 * and PhotoDim takes the edge off it, so it is not the brightest thing there.
 */
export function PhotoTile({
  title,
  subtitle,
  cta,
  photos = [],
  icon = 'coffee',
  onPress,
  accessibilityHint,
  onFocus,
  titleVariant = 'bodyBold',
  plate = 140,
  style,
}: PhotoTileProps) {
  const shots = photos.filter((p): p is string => !!p).slice(0, 2);
  return (
    <Pressable
      onPress={onPress}
      onFocus={onFocus}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, style]}
    >
      <View style={styles.words}>
        <Text variant={titleVariant} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={colors.warmGray} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {cta ? (
          <View style={styles.cta}>
            <Text variant="caption" color={colors.onInk} style={styles.ctaText} numberOfLines={1}>
              {cta}
            </Text>
          </View>
        ) : null}
      </View>
      <Plate shots={shots} icon={icon} size={plate} />
    </Pressable>
  );
}

/** The photograph, or two of them for a pair, on white; an icon when there
 *  is no photograph. Decorative: the words beside it already name it. */
function Plate({ shots, icon, size }: { shots: string[]; icon: IconName; size: number }) {
  if (shots.length === 0) {
    return (
      <View style={[styles.plate, styles.iconPlate, { width: size, minHeight: size }]}>
        <Icon name={icon} size={Math.round(size * 0.42)} color={colors.dark} strokeWidth={1.5} />
      </View>
    );
  }
  return (
    <View
      style={[styles.plate, styles.photoPlate, { width: size, minHeight: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {shots.length === 1 ? (
        <Image source={{ uri: menuImage(shots[0], size * 2) }} style={styles.single} resizeMode="contain" />
      ) : (
        // Side by side, each in its own half: the photos are opaque white
        // squares, so an overlap would let one photo's paper cut into the
        // other's product.
        <View style={styles.pairRow}>
          {shots.map((uri) => (
            <View key={uri} style={styles.pairHalf}>
              <Image source={{ uri: menuImage(uri, size * 2) }} style={styles.pairPhoto} resizeMode="contain" />
            </View>
          ))}
        </View>
      )}
      <PhotoDim />
    </View>
  );
}

const styles = StyleSheet.create({
  // The words keep the padding; the photo runs to the tile's edge, which
  // clips it to the tile's corners.
  tile: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  /** `minWidth: 0` lets a long Arabic name wrap instead of pushing the plate
   *  off the tile. */
  words: { flex: 1, minWidth: 0, gap: spacing.xs, alignItems: 'flex-start', justifyContent: 'center', padding: spacing.lg },
  cta: {
    marginTop: spacing.xs,
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    maxWidth: '100%',
  },
  ctaText: { fontWeight: '700' },
  plate: { alignSelf: 'stretch', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoPlate: { backgroundColor: colors.white },
  iconPlate: { backgroundColor: colors.neutralWarm },
  // The product fills about half of each frame; the zoom crops the white
  // margin so the product, not the paper, fills the plate.
  single: { width: '100%', height: '100%', transform: [{ scale: 1.3 }] },
  pairRow: { flexDirection: 'row', width: '100%', height: '100%' },
  pairHalf: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pairPhoto: { width: '100%', aspectRatio: 1, transform: [{ scale: 1.5 }] },
});
