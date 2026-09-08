import { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Gradient } from '@/components/ui/Gradient';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useLoyaltyBalance } from '@/hooks/useLoyalty';
import { useUserId } from '@/stores/authStore';
import { usePromotionStore } from '@/stores/promotionStore';
import { promotionCopy } from '@/lib/promotion';

/**
 * «🎉 مبروك! خصمك تضاعف — صرت على ٤٪ · وباقي لك ٧ زيارات للـ٦٪»
 *
 * ── WHY IT IS HERE, ON HOME ─────────────────────────────────────────────────
 *
 * The promotion happens AT A TILL, hours or days before the member next opens
 * the app, and the only thing that changes on the server is a rung id. So the
 * surface cannot be a toast on the earn response (the member is not holding
 * their phone), cannot be a push (there is no notification pipeline — FINAL.md
 * §4.5), and cannot be anything that only shows on a screen the member has to
 * go looking for. Home is the screen the app opens on. The banner sits above
 * the fold with the other lifecycle surfaces (HomeNudge, VisitRewardBanner),
 * and it PERSISTS: it is owed until it is dismissed, so a member promoted on
 * Tuesday who opens the app on Friday still sees it.
 *
 * This component is also the only OBSERVER. Folding the balance into the record
 * on every screen would gain nothing — the record is a high-water mark, so the
 * outcome is identical — and would spread a persistence side effect across the
 * app. One writer, on the screen that renders the result.
 */
export function PromotionBanner() {
  const { t, lang } = useI18n();
  const userId = useUserId();
  const { data } = useLoyaltyBalance();
  const hydrated = usePromotionStore((s) => s.hydrated);
  const pending = usePromotionStore((s) => s.record.pending);
  const observe = usePromotionStore((s) => s.observe);
  const dismiss = usePromotionStore((s) => s.dismiss);

  // `data.tier` is the rung the member is PAID at — standing().held, i.e.
  // max(floor, live window). Not tierFromSpend(windowSpend), which disagrees
  // with it for every ratcheted member. The store ignores this until the disk
  // has been read; `hydrated` is in the dependency list so the observation is
  // re-run once it has.
  useEffect(() => {
    if (data?.tier) observe(userId, data.tier);
  }, [observe, userId, data?.tier, hydrated]);

  // Nothing is shown until the balance has landed. The second clause of the
  // approved sentence («· وباقي لك ٧ زيارات للـ٦٪») comes off `nextTier`, so
  // rendering early would show the headline alone and then grow a line under
  // the member — half the approved copy, then a jump.
  const copy = data ? promotionCopy(pending, data.nextTier, lang) : null;
  if (!copy) return null;

  return (
    <Pressable
      style={styles.shadow}
      accessibilityRole="button"
      onPress={() => {
        // Seen and acted on: the ladder is on the rewards screen, and the
        // celebration is spent either way.
        dismiss();
        router.push('/(tabs)/rewards');
      }}
    >
      <Gradient preset="purple" style={styles.card}>
        <View style={styles.body}>
          <Text variant="bodyBold" color={colors.white}>
            {t(copy.key, copy.params)}
          </Text>
          {copy.next ? (
            <Text variant="caption" color={colors.white}>
              {t(copy.next.key, copy.next.params)}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Icon name="close" size={18} color={colors.white} strokeWidth={2} />
        </Pressable>
      </Gradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The banner owns its own bottom margin because Home mounts it unwrapped —
  // a <View style={section}> around it would hold a gap open on every launch
  // with nothing to celebrate.
  shadow: { borderRadius: radius.lg, marginBottom: spacing.xl, ...shadow.card },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  body: { flex: 1, gap: spacing.xs },
});
