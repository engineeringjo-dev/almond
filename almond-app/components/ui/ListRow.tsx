import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

interface Props {
  emoji: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}

export function ListRow({ emoji, label, value, onPress, danger }: Props) {
  const { lang } = useI18n();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text variant="body" color={danger ? colors.red : colors.dark} style={styles.label}>
        {label}
      </Text>
      {value ? (
        <Text variant="caption" color={colors.warmGray}>
          {value}
        </Text>
      ) : null}
      <Text style={styles.chevron}>{lang === 'ar' ? '‹' : '›'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  pressed: { backgroundColor: colors.cream, borderRadius: radius.md },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18 },
  label: { flex: 1 },
  chevron: { fontSize: 24, color: colors.warmGray },
});
