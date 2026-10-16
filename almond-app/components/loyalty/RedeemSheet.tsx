import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { useRedeemReward } from '@/hooks/useLoyalty';
import { formatJOD, formatNumber } from '@/lib/format';
import { redeemStep, voucherAvailabilityKey } from '@/lib/redeemSheet';
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
  const issued = step === 'done' ? redeem.data?.voucher : undefined;
  // The issued id must survive `onClose` clearing the parent option. On web
  // and iOS, navigation waits for the real Modal dismissal: the outgoing
  // modal otherwise recaptures the new screen's focus during its close fade.
  const pendingDestination = useRef<Href | null>(null);
  const openVoucher = () => {
    const destination: Href = { pathname: '/vouchers', params: issued ? { voucherId: issued.id } : undefined };
    if (Platform.OS === 'android') {
      // RN Android removes a hidden Modal directly; it has no onDismiss event.
      onClose();
      router.push(destination);
      return;
    }
    pendingDestination.current = destination;
    onClose();
  };
  const finishVoucherNavigation = () => {
    const destination = pendingDestination.current;
    pendingDestination.current = null;
    if (destination) router.push(destination);
  };

  const confirm = () => {
    if (!shown || redeem.isPending) return;
    // Preserve the shared option's exact credit value. Issuing this Voucher
    // does not itself apply a discount to a cart or supply a POS credential.
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
      <Button
        title={issued ? t('rewards.viewVoucher') : t('profile.vouchers')}
        onPress={openVoucher}
      />
      <Button title={t('common.ok')} variant="ghost" onPress={onClose} />
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
      onDismiss={finishVoucherNavigation}
      title={step === 'done' ? t('rewards.redeemedTitle') : t('rewards.confirmTitle')}
      footer={footer}
    >
      {issued ? (
        <Text variant="bodyBold" color={colors.reward} style={styles.body} selectable>
          {lang === 'ar' ? issued.titleAr : issued.titleEn}
        </Text>
      ) : null}
      <Text variant="body" style={styles.body}>
        {step === 'done' ? t('rewards.redeemedBody') : t('rewards.confirmBody', { jod, points })}
      </Text>
      <Text variant="caption" color={colors.warmGray} style={styles.body}>
        {t(voucherAvailabilityKey(config.DATA_SOURCE))}
      </Text>
      {step === 'failed' ? (
        <Text variant="bodyBold" color={colors.red} style={styles.body} selectable accessibilityRole="alert">
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
