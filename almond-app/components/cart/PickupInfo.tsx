import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { HeroCard } from '@/components/ui/HeroCard';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import type { Branch } from '@/types';
import type { PickupEstimate } from '@/lib/pickup';

interface Props {
  branch?: Branch;
  estimate: PickupEstimate;
  onChangeBranch: () => void;
  /** Said in place of the branch name while there is none (loading / not chosen). */
  emptyLabel?: string;
}

/** Smart-pickup branch + ready-time estimate, on the black card. */
export function PickupInfo({ branch, estimate, onChangeBranch, emptyLabel }: Props) {
  const { t, lang } = useI18n();
  return (
    <View style={styles.shadow}>
      <HeroCard style={styles.card}>
        <View style={styles.branchRow}>
          <View style={styles.left}>
            <Text variant="caption" color={colors.onHero}>
              {t('cart.branch')}
            </Text>
            <View style={styles.branchName}>
              <Icon name="map-pin" size={16} color={colors.onHero} />
              <Text variant="bodyBold" color={colors.onHero}>
                {branch ? (lang === 'ar' ? branch.nameAr : branch.nameEn) : (emptyLabel ?? '—')}
              </Text>
            </View>
          </View>
          {/* 44pt tall, sized — the pill was ≈28 px and react-native-web
              ignores hitSlop. Named for what it changes. */}
          <Pressable
            onPress={onChangeBranch}
            style={({ pressed }) => [styles.changeBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('cart.changeBranch')}
          >
            <Text variant="bodyBold" color={colors.hero}>
              {t('cart.change')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.estimate}>
          <Icon
            name={estimate.readyOnArrival ? 'sparkles' : 'clock'}
            size={20}
            color={colors.hero}
            strokeWidth={2}
          />
          <Text variant="bodyBold" color={colors.hero} style={styles.estimateText}>
            {estimate.readyOnArrival
              ? t('cart.readyOnArrival')
              : // `count` picks the Arabic plural: «دقيقتين», «٧ دقائق», «١١ دقيقة».
                t('cart.readyIn', { count: estimate.prepMinutes })}
          </Text>
        </View>
      </HeroCard>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.lg, ...shadow.card },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  branchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  left: { gap: 2, flex: 1 },
  branchName: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  changeBtn: {
    backgroundColor: colors.onHero,
    borderRadius: radius.pill,
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  estimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.onHero,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  estimateText: { flex: 1 },
});
