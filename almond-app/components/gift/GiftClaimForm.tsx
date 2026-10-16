import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { config } from '@/constants/config';
import { colors, fontFamily, fontSize, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useRedeemGift } from '@/hooks/useLoyalty';
import { formatJOD } from '@/lib/format';
import { claimGiftOnce, giftClaimErrorKey } from '@/lib/giftClaim';

type Props = { presentation?: 'inline' } | {
  presentation: 'sheet';
  visible: boolean;
  onClose: () => void;
};

/** One gift-code form for Wallet/Top up and the gift-card catalogue's sheet.
 * Precedent: Starbucks' explicit Add Card form beside card balance/reload.
 * This only presents the existing claim service; it never computes credit. */
export function GiftClaimForm(props: Props) {
  const { t, lang } = useI18n();
  const redeem = useRedeemGift();
  const [code, setCode] = useState('');
  const [added, setAdded] = useState<number | null>(null);
  const [error, setError] = useState<ReturnType<typeof giftClaimErrorKey> | null>(null);
  const lock = useRef(false);
  const session = useRef(0);
  const active = props.presentation !== 'sheet' || props.visible;
  const activeRef = useRef(active);
  activeRef.current = active;

  // A completed claim still refreshes the wallet through useRedeemGift, but
  // must not restore an old success view after its sheet closed/unmounted.
  useEffect(() => () => { session.current += 1; }, []);

  const close = () => {
    session.current += 1;
    setCode('');
    setAdded(null);
    setError(null);
    if (props.presentation === 'sheet') props.onClose();
  };

  const onRedeem = async () => {
    if (!active || !code.trim()) return;
    const requestSession = session.current;
    setError(null);
    setAdded(null);
    try {
      const reply = await claimGiftOnce(lock, code, redeem.mutateAsync);
      if (!reply || requestSession !== session.current || !activeRef.current) return;
      setAdded(reply.amount);
      setCode('');
    } catch (failure) {
      if (requestSession === session.current && activeRef.current) {
        setError(giftClaimErrorKey(failure, config.DATA_SOURCE === 'mock'));
      }
    }
  };

  const fields = (
    <View style={styles.fields}>
      <Text variant="caption" color={colors.warmGray}>{t('gift.redeemHint')}</Text>
      {config.DATA_SOURCE === 'mock' ? (
        <Text variant="caption" color={colors.warmGray}>{t('gift.claimDemo')}</Text>
      ) : null}
      <Text variant="bodyBold">{t('gift.codeLabel')}</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(value) => { setCode(value); setError(null); setAdded(null); }}
        placeholder={t('gift.codePh')}
        placeholderTextColor={colors.warmGray}
        accessibilityLabel={t('gift.codeLabel')}
        aria-invalid={error ? true : undefined}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        editable={!redeem.isPending}
        returnKeyType="done"
        onSubmitEditing={() => { void onRedeem(); }}
      />
      {error ? (
        <Text variant="caption" color={colors.red} role="alert" accessibilityLiveRegion="polite">{t(error)}</Text>
      ) : null}
    </View>
  );
  const action = (
    <Button
      title={t('gift.redeemCta')}
      onPress={() => { void onRedeem(); }}
      loading={redeem.isPending}
      disabled={!code.trim()}
    />
  );
  const success = added !== null ? (
    <Text variant="body" color={colors.green} role="status" accessibilityLiveRegion="polite">
      {t('gift.redeemedBody', { jod: formatJOD(added, lang) })}
    </Text>
  ) : null;

  if (props.presentation === 'sheet') {
    return (
      <BottomSheet
        visible={props.visible}
        onClose={close}
        title={t(added !== null ? 'gift.redeemedTitle' : 'gift.redeemTitle')}
        footer={added !== null ? <Button title={t('gift.done')} onPress={close} /> : action}
      >
        {added !== null ? (
          <View style={styles.success}>
            <View style={styles.badge}><Icon name="wallet" size={36} color={colors.onInk} /></View>
            {success}
          </View>
        ) : fields}
      </BottomSheet>
    );
  }

  return (
    <View style={styles.form} testID="gift-claim-form">
      <Text variant="title" role="heading" aria-level={2}>{t('gift.receivedTitle')}</Text>
      {fields}
      {action}
      {success}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  fields: { gap: spacing.sm },
  input: {
    minHeight: 48,
    padding: spacing.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.dark,
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  success: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  badge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center',
  },
});
