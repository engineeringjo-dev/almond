import { View, ViewProps, StyleSheet } from 'react-native';
import { colors, radius, spacing, shadow } from '@/constants/theme';

interface Props extends ViewProps {
  padded?: boolean;
}

/** Card: 16px radius, subtle shadow, card background (section 3.3). */
export function Card({ padded = true, style, children, ...rest }: Props) {
  return (
    <View style={[styles.card, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    // Hairline lavender border so white cards separate from the white
    // background even where the soft shadow is faint (e.g. on web).
    borderWidth: 1,
    borderColor: colors.neutralWarm,
    ...shadow.card,
  },
  padded: { padding: spacing.lg },
});
