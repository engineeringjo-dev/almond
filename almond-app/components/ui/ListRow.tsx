import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { forwardChevron, layoutFollowsLanguage } from '@/lib/direction';

interface Props {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}

export function ListRow({ icon, label, value, onPress, danger }: Props) {
  const { lang } = useI18n();
  const tint = danger ? colors.red : colors.primary;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        // `row` already reads right-to-left wherever the layout is mirrored;
        // reverse only where it is not, or Arabic rows come out LTR again.
        { flexDirection: layoutFollowsLanguage(lang) ? 'row' : 'row-reverse' },
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
      {/* A drawn chevron, like BackButton's. «‹»/«›» are bidi-MIRRORED
          characters: which way they are drawn depends on the base direction
          the platform resolves for a neutral-only string (LTR on the web, so
          it happened to look right there; a native RTL paragraph draws «‹» as
          «›» — one more mirror on top of the layout's). An icon does not
          mirror, so the language alone picks the side. */}
      <Icon name={forwardChevron(lang)} size={20} color={colors.warmGray} strokeWidth={2} />
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
});
