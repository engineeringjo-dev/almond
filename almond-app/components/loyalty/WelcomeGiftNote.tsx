import { View, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';

/**
 * «200 نقطة هدية تُضاف إلى رصيدك مع أول شراء» — the welcome gift while it is
 * still on offer (loyalty/welcome.ts). Owner, 2026-10-15: «امنح ٢٠٠ نقطة تفعل
 * بعد اول عملية شراء وتنزيل نقاط عالتطبيق».
 *
 * The count is the SERVER's (`LoyaltyBalance.welcomeBonusPending`), never the
 * dial read on the phone: a corporate member, or one already settled, is told
 * nothing, and that is the server's knowledge, not the app's. Renders nothing
 * at 0. It is shown BESIDE the balance, never added to it — the points are not
 * the member's until the purchase.
 */
export function WelcomeGiftNote({ points, color = colors.dark }: { points: number | undefined; color?: string }) {
  const { t, lang } = useI18n();
  if (!points || points <= 0) return null;
  const n = formatNumber(points, lang);
  return (
    <View style={styles.row} accessible accessibilityLabel={t('welcomeGift.pendingA11y', { points: n })}>
      <Icon name="gift" size={18} color={color} strokeWidth={1.75} />
      <Text variant="caption" color={color} style={styles.text}>
        {t('welcomeGift.pending', { points: n })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  text: { flex: 1, minWidth: 0 },
});
