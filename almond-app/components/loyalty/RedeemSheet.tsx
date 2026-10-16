import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useRedeemReward } from '@/hooks/useLoyalty';
import { formatJOD, formatNumber } from '@/lib/format';
import { redeemStep } from '@/lib/redeemSheet';
import i18n from '@/lib/i18n';
import type { RedeemOption } from '@almond/shared/loyalty/redeem';
import type { Lang } from '@/types';

interface Props {
  /** The amount tapped on the Rewards tab; `null` keeps the sheet closed. */
  option: RedeemOption | null;
  onClose: () => void;
}

/**
 * «تأكيد الاستبدال» — the second of the two taps a redemption takes: the
 * amount on the Rewards tab, then «استبدال» here.
 *
 * Asked → done, with the way to the coupon it made («قسائمي») → or failed,
 * with «إعادة المحاولة». The steps are lib/redeemSheet.ts.
 */
export function RedeemSheet({ option, onClose }: Props) {
  const { t, lang } = useI18n();
  const redeem = useRedeemReward();
  const { reset } = redeem;
  // The amount and the answer stay on the sheet while it fades away, instead
  // of blanking — or flipping back to the question — the moment the parent
  // lets go. A NEW amount opens on the question: that is when the last
  // answer is cleared. A redemption already sent completes either way.
  const [shown, setShown] = useState<RedeemOption | null>(option);
  useEffect(() => {
    if (!option) return;
    setShown(option);
    reset();
  }, [option, reset]);

  const step = redeemStep(redeem);

  const confirm = () => {
    if (!shown || redeem.isPending) return;
    // The voucher is a CREDIT worth exactly `shown.jod`, not a named item
    // capped at a value: 1 point = 1 qirsh, so there is no cap to disclose and
    // no difference to pay at the till.
    const titleFor = (lng: Lang) => i18n.t('rewards.creditVoucher', { lng, jod: formatJOD(shown.jod, lng) });
    redeem.mutate({
      beans: shown.points,
      titleAr: titleFor('ar'),
      titleEn: titleFor('en'),
      type: 'credit',
      value: shown.jod,
    });
  };

  const jod = shown ? formatJOD(shown.jod, lang) : '';
  const points = shown ? formatNumber(shown.points, lang) : '';

  const footer = step === 'done' ? (
    <View style={styles.actions}>
      <Button title={t('common.ok')} onPress={onClose} />
      <Button
        title={t('profile.vouchers')}
        variant="outline"
        onPress={() => {
          onClose();
          router.push('/vouchers');
        }}
      />
    </View>
  ) : (
    <View style={styles.actions}>
      <Button
        title={step === 'failed' ? t('common.retry') : t('rewards.redeemCta')}
        onPress={confirm}
        loading={step === 'pending'}
      />
      <Button title={t('common.cancel')} variant="ghost" onPress={onClose} />
    </View>
  );

  return (
    <BottomSheet
      visible={option !== null}
      onClose={onClose}
      title={step === 'done' ? t('rewards.redeemedTitle') : t('rewards.confirmTitle')}
      footer={footer}
    >
      <Text variant="body" style={styles.body}>
        {step === 'done' ? t('rewards.redeemedBody', { jod }) : t('rewards.confirmBody', { jod, points })}
      </Text>
      {step === 'failed' ? (
        <Text variant="bodyBold" color={colors.red} style={styles.body} accessibilityRole="alert">
          {t('rewards.redeemFailed')}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: spacing.sm },
  actions: { gap: spacing.sm },
});
