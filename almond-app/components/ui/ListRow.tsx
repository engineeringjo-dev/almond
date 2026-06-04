import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

interface Props {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}

export function ListRow({ icon, label, value, onPress, danger }: Props) {
  const { isRTL } = useI18n();
  const tint = danger ? colors.red : colors.primary;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <Icon name={icon} size={20} color={tint} strokeWidth={1.9} />
      </View>
      <Text variant="body" color={danger ? colors.red : colors.dark} style={styles.label}>
        {label}
      </Text>
      {value ? (
        <Text variant="caption" color={colors.warmGray}>
          {value}
        </Text>
      ) : null}
      <Text style={styles.chevron}>{isRTL ? '‹' : '›'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  pressed: { backgroundColor: colors.neutralWarm, borderRadius: radius.md },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
  chevron: { fontSize: 24, color: colors.warmGray },
});
