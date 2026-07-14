import { Text as RNText, TextProps, StyleSheet, TextStyle } from 'react-native';
import { colors, fontFamily, fontSize } from '@/constants/theme';

type Variant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'title'
  | 'body'
  | 'bodyBold'
  | 'caption'
  | 'price';

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
}

// lineHeight ≈ 1.3–1.5× so Arabic ascenders/diacritics never clip.
const variantStyle: Record<Variant, TextStyle> = {
  display: { fontFamily: fontFamily.bold, fontSize: fontSize.display, lineHeight: 44 },
  h1: { fontFamily: fontFamily.bold, fontSize: fontSize.xxl, lineHeight: 38 },
  h2: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, lineHeight: 30 },
  title: { fontFamily: fontFamily.medium, fontSize: fontSize.lg, lineHeight: 26 },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.md, lineHeight: 24 },
  bodyBold: { fontFamily: fontFamily.medium, fontSize: fontSize.md, lineHeight: 24 },
  caption: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 20 },
  price: { fontFamily: fontFamily.bold, fontSize: fontSize.md, lineHeight: 22 },
};

/**
 * Themed text. RTL handled by I18nManager; we set writingDirection auto so
 * Arabic/English render correctly. `price` defaults to the gold accent.
 */
export function Text({ variant = 'body', color, center, style, ...rest }: Props) {
  return (
    <RNText
      style={[
        styles.base,
        variantStyle[variant],
        { color: color ?? (variant === 'price' ? colors.gold : colors.dark) },
        center && styles.center,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { writingDirection: 'auto' },
  center: { textAlign: 'center' },
});
