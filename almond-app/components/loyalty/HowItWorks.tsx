import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { earnRangeCopy } from '@almond/shared/loyalty';

const STEPS: { icon: IconName; titleKey: string; bodyKey: string }[] = [
  { icon: 'qr', titleKey: 'rewards.step1Title', bodyKey: 'rewards.step1Body' },
  { icon: 'bean', titleKey: 'rewards.step2Title', bodyKey: 'rewards.step2Body' },
  { icon: 'gift', titleKey: 'rewards.step3Title', bodyKey: 'rewards.step3Body' },
];

/** The three steps — earn, watch, redeem. The guest's Rewards page shows them
 *  in place; a member, who already knows them, opens them from a tile. */
export function HowItWorksSteps() {
  const { t } = useI18n();
  return (
    <View style={styles.steps}>
      {STEPS.map((s) => (
        <View key={s.titleKey} style={styles.row}>
          <View style={styles.stepIcon}>
            <Icon name={s.icon} size={22} color={colors.primary} strokeWidth={1.9} />
          </View>
          <View style={styles.flex}>
            <Text variant="bodyBold">{t(s.titleKey)}</Text>
            <Text variant="caption" color={colors.warmGray}>
              {t(s.bodyKey)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * «كيف تعمل؟» for a member: the steps, then what every order pays back and
 * the double days — the two rules the hub no longer spells out below the fold.
 * A sheet, not a page: it is read once and closed (HIG, sheets for a short,
 * self-contained task).
 */
export function HowItWorksSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('rewards.howItWorks')}>
      <HowItWorksSteps />
      <View style={styles.facts}>
        <View style={styles.fact}>
          <Icon name="coins" size={18} color={colors.dark} strokeWidth={1.9} />
          <Text variant="caption" color={colors.dark} style={styles.flex}>
            {t('rewards.headlineSub', earnRangeCopy(lang))}
          </Text>
        </View>
        <View style={styles.fact}>
          <Icon name="sparkles" size={18} color={colors.dark} strokeWidth={1.9} />
          <Text variant="caption" color={colors.dark} style={styles.flex}>
            {t('tierBenefits.doubleDays')}
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  steps: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facts: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutralWarm,
  },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
