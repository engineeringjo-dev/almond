import { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing, fontFamily, fontSize } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { validatePromo } from '@/lib/promo';

interface Props {
  subtotal: number;
  appliedCode: string | null;
  onApply: (code: string, discount: number) => void;
  onClear: () => void;
}

export function PromoInput({ subtotal, appliedCode, onApply, onClear }: Props) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const apply = () => {
    const result = validatePromo(code, subtotal);
    if (result.valid) {
      setError(false);
      onApply(result.code!, result.discount);
      setCode('');
    } else {
      setError(true);
    }
  };

  if (appliedCode) {
    return (
      <View style={[styles.row, styles.applied]}>
        <Text variant="bodyBold" color={colors.green}>
          ✓ {appliedCode}
        </Text>
        <Pressable onPress={onClear} hitSlop={8}>
          <Text variant="caption" color={colors.red}>
            {t('cart.remove')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setError(false);
          }}
          placeholder={t('cart.promoPlaceholder')}
          placeholderTextColor={colors.warmGray}
          autoCapitalize="characters"
        />
        <Pressable style={styles.applyBtn} onPress={apply} disabled={!code.trim()}>
          <Text variant="bodyBold" color={colors.dark}>
            {t('cart.apply')}
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text variant="caption" color={colors.red} style={styles.err}>
          {t('cart.promoInvalid')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  applied: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.dark,
    textAlign: 'left',
  },
  applyBtn: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.lightGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  err: { marginTop: spacing.xs },
});
