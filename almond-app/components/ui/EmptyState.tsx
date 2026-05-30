import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { colors, spacing, radius } from '@/constants/theme';

interface Props {
  icon: IconName;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

/**
 * Friendly empty state (Revision Pack §N): soft illustration badge + warm copy
 * + a clear call to action. Fills the void instead of a bare line of text.
 */
export function EmptyState({ icon, title, subtitle, ctaLabel, onCta }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badgeOuter}>
        <View style={styles.badgeInner}>
          <Icon name={icon} size={48} color={colors.gold} strokeWidth={1.6} />
        </View>
      </View>
      <Text variant="h2" center>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color={colors.warmGray} center style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      {ctaLabel && onCta ? (
        <Button title={ctaLabel} onPress={onCta} fullWidth={false} style={styles.cta} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  badgeOuter: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badgeInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.lightGold,
    borderStyle: 'dashed',
  },
  subtitle: { marginTop: spacing.xs, maxWidth: 280 },
  cta: { marginTop: spacing.lg, paddingHorizontal: spacing.xxl, borderRadius: radius.md },
});
