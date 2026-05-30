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

const variantStyle: Record<Variant, TextStyle> = {
  display: { fontFamily: fontFamily.bold, fontSize: fontSize.display },
  h1: { fontFamily: fontFamily.bold, fontSize: fontSize.xxl },
  h2: { fontFamily: fontFamily.bold, fontSize: fontSize.xl },
  title: { fontFamily: fontFamily.medium, fontSize: fontSize.lg },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.md },
  bodyBold: { fontFamily: fontFamily.medium, fontSize: fontSize.md },
  caption: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  price: { fontFamily: fontFamily.bold, fontSize: fontSize.md },
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
