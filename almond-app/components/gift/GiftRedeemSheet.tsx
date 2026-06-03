import { useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { useRedeemGift } from '@/hooks/useLoyalty';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function GiftRedeemSheet({ visible, onClose }: Props) {
  const { t, lang } = useI18n();
  const redeem = useRedeemGift();
  const [code, setCode] = useState('');
  const [added, setAdded] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const close = () => { setCode(''); setAdded(null); setError(false); onClose(); };

  const onRedeem = () => {
    if (!code.trim() || redeem.isPending) return;
    setError(false);
    redeem.mutate(code, {
      onSuccess: (res) => setAdded(res.amount),
      onError: () => setError(true),
    });
  };

  if (added != null) {
    return (
      <BottomSheet visible={visible} onClose={close} title={t('gift.redeemedTitle')}
        footer={<Button title={t('gift.done')} onPress={close} />}>
        <View style={styles.center}>
          <View style={styles.badge}>
            <Icon name="wallet" size={36} color={colors.white} />
          </View>
          <Text variant="body" color={colors.warmGray} center>
            {t('gift.redeemedBody', { jod: formatJOD(added, lang) })}
          </Text>
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={t('gift.redeemTitle')}
      footer={
        <Button title={t('gift.redeemCta')} onPress={onRedeem} loading={redeem.isPending} disabled={!code.trim()} />
      }
    >
      <Text variant="body" color={colors.warmGray} style={styles.hint}>
        {t('gift.redeemHint')}
      </Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(v) => { setCode(v); setError(false); }}
        placeholder={t('gift.codePh')}
        placeholderTextColor={colors.warmGray}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {error ? (
        <Text variant="caption" color={colors.red} style={styles.error}>
          {t('gift.invalidCode')}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hint: { marginBottom: spacing.md },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 18,
    color: colors.dark,
    textAlign: 'center',
    letterSpacing: 1,
  },
  error: { marginTop: spacing.sm },
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  badge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center',
  },
});
