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
  leadingEmoji?: string;
  /** Preferred over leadingEmoji — a single-tone line icon. */
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
  leadingEmoji,
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
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#000000' : colors.gold} />
      ) : (
        <View style={styles.row}>
          {leadingIcon ? (
            <Icon name={leadingIcon} size={18} color={labelColor[variant].color} strokeWidth={2} />
          ) : leadingEmoji ? (
            <Text style={styles.emoji}>{leadingEmoji} </Text>
          ) : null}
          <Text style={[styles.label, labelColor[variant]]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const labelColor: Record<Variant, { color: string }> = {
  primary: { color: '#000000' }, // black text on the white primary button
  secondary: { color: colors.cream },
  outline: { color: colors.gold },
  ghost: { color: colors.brown },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // Gold button → white background, black text, thin border for definition on cream.
  primary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  secondary: { backgroundColor: colors.dark },
  outline: { borderWidth: 1.5, borderColor: colors.gold, backgroundColor: 'transparent' },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fontFamily.bold, fontSize: fontSize.md },
  emoji: { fontSize: fontSize.md },
});
