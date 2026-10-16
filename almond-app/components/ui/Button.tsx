import {
  Pressable,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, fontFamily, fontSize } from '@/constants/theme';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  /** A single-tone line icon before the label. There is no emoji form: the
   *  icon set is one line family (Icon.tsx), and the identity has no colour. */
  leadingIcon?: IconName;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  fullWidth = true,
  style,
  leadingIcon,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator color={labelColor[variant].color} />
      ) : (
        <View style={styles.row}>
          {leadingIcon ? (
            <Icon name={leadingIcon} size={18} color={labelColor[variant].color} strokeWidth={2} />
          ) : null}
          <Text style={[styles.label, labelColor[variant]]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * THE PRIMARY BUTTON IS FILLED. It was a white button with a black edge — the
 * same weight as every card around it, so the one action on a screen did not
 * read as the one action. Now it is the ink, solid, with `onInk` text: black
 * on the white page, white on the dark one. Secondary is the outlined form it
 * used to wear. Precedent: Material 3's filled button for the single most
 * important action; Apple HIG's prominent (filled) button style.
 */
const labelColor: Record<Variant, { color: string }> = {
  primary: { color: colors.onInk },
  secondary: { color: colors.dark },
  outline: { color: colors.dark },
  ghost: { color: colors.dark },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  primary: { backgroundColor: colors.dark },
  secondary: { backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.dark },
  outline: { borderWidth: 1.5, borderColor: colors.dark, backgroundColor: 'transparent' },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fontFamily.bold, fontSize: fontSize.md },
});
