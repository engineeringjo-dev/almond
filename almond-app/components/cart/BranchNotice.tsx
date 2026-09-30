import { View, StyleSheet, Pressable } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { branchSwitchCopy, type BranchSwitch } from '@/lib/cartBranch';

interface Props {
  notice: BranchSwitch;
  /** Open the branch picker. Omitted in the review, which only states it. */
  onChangeBranch?: () => void;
  onDismiss?: () => void;
}

/**
 * «الفرع الذي اخترته (…) غير متاح الآن، فاخترنا لك أقرب فرع مفتوح: …»
 *
 * The cart moved the order to another branch. Said where the branch is shown,
 * with both names, and kept on screen until the customer answers it — a
 * customer who drives to the branch they chose last week must not find their
 * order waiting somewhere else. An alert, so a screen reader announces it.
 */
export function BranchNotice({ notice, onChangeBranch, onDismiss }: Props) {
  const { t, lang } = useI18n();
  const copy = branchSwitchCopy(notice, lang);
  return (
    <View style={styles.box} role="alert">
      <View style={styles.head}>
        <Icon name="alert" size={18} color={colors.red} strokeWidth={2.2} />
        <Text variant="bodyBold" style={styles.flex}>
          {t('cart.branchSwitchTitle')}
        </Text>
      </View>
      <Text variant="body">{t(copy.key, copy.params)}</Text>
      {onChangeBranch || onDismiss ? (
        <View style={styles.actions}>
          {onChangeBranch ? (
            <Pressable
              onPress={onChangeBranch}
              style={({ pressed }) => [styles.action, styles.actionPrimary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text variant="bodyBold" color={colors.white}>
                {t('cart.branchSwitchChoose')}
              </Text>
            </Pressable>
          ) : null}
          {onDismiss ? (
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text variant="bodyBold" color={colors.dark}>
                {t('common.ok')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.red,
    padding: spacing.md,
    gap: spacing.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  // 44pt: both are real targets, sized — react-native-web ignores hitSlop.
  action: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
  },
  actionPrimary: { backgroundColor: colors.dark },
  pressed: { opacity: 0.8 },
});
