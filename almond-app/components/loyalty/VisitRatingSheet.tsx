import { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, fontFamily, fontSize } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { loyaltyService } from '@/services/loyalty.service';
import { useUserId } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { apiErrorCode } from '@/lib/apiClient';
import { choiceA11y, choiceGroupA11y, MIN_TOUCH_TARGET } from '@/lib/a11y';
import { inputTextAlign } from '@/lib/inputAlign';
import { formatJOD, formatNumber } from '@/lib/format';
import { tierProgressCopy } from '@/lib/tierCopy';
import { useLoyaltyBalance } from '@/hooks/useLoyalty';
import { config } from '@/constants/config';
// earn-arith-exempt: points→JOD for DISPLAY, via the one shared conversion. §7 T7.
import { jodFromPoints } from '@almond/shared/loyalty/earn';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The visit: "order:<id>" or "pos:<ref>" (@almond/shared/loyalty/visitRating). */
  visitRef: string;
  /** Null when the branch is not one the app lists (a till's own id). */
  branchName: string | null;
  /**
   * Set when the sheet is the thank-you after a visit: it opens with the
   * points that visit added (Al Ameed's «شكراً لزيارتك»). Unset on the order
   * screen, where the member chose to rate.
   */
  pointsAdded?: number;
}

/**
 * Rate a visit: 1-5 stars and an optional comment. ONE sheet for both ways in
 * — the thank-you that opens after a purchase (components/loyalty/
 * PostVisitSheet.tsx) and «قيّم» on a finished order.
 *
 * It pays nothing and promises nothing (owner, 2026-10-15: «لا تعد بشيء»).
 * The old sheet announced «حصلت على 50 نقطة» from a mock the server never
 * matched, and posted to a route the server never had.
 *
 * The stars are a radio group (WAI-ARIA: one answer of five), drawn from the
 * icon set rather than emoji.
 */
export function VisitRatingSheet({ visible, onClose, visitRef, branchName, pointsAdded }: Props) {
  const { t, lang } = useI18n();
  const userId = useUserId();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { data: balance } = useLoyaltyBalance();
  // The thank-you says where the visit left the member: the balance in
  // points and in money, and the next rung (expert panel, 2026-10-15).
  // Precedent: Starbucks' receipt screen shows the Stars added and the new
  // total; Al Ameed's «شكراً لزيارتك» the points.
  const progress = balance ? tierProgressCopy(balance, lang) : null;

  const submit = async () => {
    if (stars === 0) return;
    setSubmitting(true);
    try {
      await loyaltyService.rateVisit({ userId, ref: visitRef, stars, comment });
      setDone(true);
    } catch (e) {
      // Already rated — on another device, or a second tap that raced the
      // first. The member's rating is in; say thank you.
      if (apiErrorCode(e) === 'visit_already_rated') setDone(true);
      else useToastStore.getState().showError(t('visit.rateError'));
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    setStars(0);
    setComment('');
    setDone(false);
    onClose();
  };

  const question = branchName ? t('track.rateTitle', { branch: branchName }) : t('visit.rateGeneric');

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={done ? undefined : pointsAdded !== undefined ? t('visit.thanksTitle') : question}
      label={pointsAdded !== undefined ? t('visit.thanksTitle') : question}
      footer={
        done ? (
          <Button title={t('common.ok')} onPress={close} />
        ) : (
          <Button title={t('track.rateSubmit')} onPress={submit} disabled={stars === 0} loading={submitting} />
        )
      }
    >
      {done ? (
        <View style={styles.done}>
          <Icon name="star" size={40} color={colors.brown} fill={colors.brown} />
          <Text variant="h2" center>
            {t('track.rateThanks')}
          </Text>
        </View>
      ) : (
        <>
          {pointsAdded !== undefined ? (
            <View style={styles.thanks}>
              {pointsAdded > 0 ? (
                <Text variant="title" center color={colors.dark}>
                  {t('visit.pointsAdded', { points: formatNumber(pointsAdded, lang) })}
                </Text>
              ) : null}
              {balance ? (
                <Text variant="body" center color={colors.dark}>
                  {t('visit.balanceNow', {
                    points: formatNumber(balance.points, lang),
                    jod: formatJOD(jodFromPoints(balance.points), lang),
                  })}
                </Text>
              ) : null}
              {progress ? (
                <Text variant="caption" center color={colors.warmGray}>
                  {t(progress.key, progress.params)}
                </Text>
              ) : null}
              <Text variant="body" center color={colors.warmGray}>
                {question}
              </Text>
            </View>
          ) : null}
          <View style={styles.stars} {...choiceGroupA11y(false, t('visit.starsGroup'))}>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = n <= stars;
              return (
                <Pressable
                  key={n}
                  onPress={() => setStars(n)}
                  style={styles.star}
                  {...choiceA11y('radio', n === stars, t('visit.starsLabel', { n }))}
                >
                  <Icon
                    name="star"
                    size={32}
                    color={on ? colors.brown : colors.warmGray}
                    fill={on ? colors.brown : undefined}
                    strokeWidth={1.8}
                  />
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={[styles.comment, { textAlign: inputTextAlign(lang) }]}
            value={comment}
            onChangeText={setComment}
            placeholder={t('track.rateComment')}
            placeholderTextColor={colors.warmGray}
            accessibilityLabel={t('track.rateComment')}
            maxLength={config.VISIT_RATING_COMMENT_MAX}
            multiline
          />
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  thanks: { gap: spacing.xs, marginBottom: spacing.lg },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  star: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  comment: {
    minHeight: 80,
    // The resting field fill: on the sheet's white, cardBg drew no field at all.
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.dark,
    textAlignVertical: 'top',
  },
  done: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
});
