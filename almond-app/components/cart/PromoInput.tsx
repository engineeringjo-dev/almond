import { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, radius, spacing, fontFamily, fontSize } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { validatePromo } from '@/lib/promo';
import { inputTextAlign } from '@/lib/inputAlign';

interface Props {
  subtotal: number;
  appliedCode: string | null;
  onApply: (code: string, discount: number) => void;
  onClear: () => void;
}

export function PromoInput({ subtotal, appliedCode, onApply, onClear }: Props) {
  const { t, lang } = useI18n();
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
        <View style={styles.appliedCode}>
          <Icon name="check" size={18} color={colors.green} strokeWidth={2.4} />
          <Text variant="bodyBold" color={colors.green}>
            {appliedCode}
          </Text>
        </View>
        {/* A 44pt target, sized (react-native-web ignores hitSlop), named for
            what it removes. */}
        <Pressable
          onPress={onClear}
          style={styles.removeBtn}
          accessibilityRole="button"
          accessibilityLabel={t('cart.promoRemove', { code: appliedCode })}
        >
          <Text variant="caption" color={colors.red}>
            {t('cart.remove')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.field}>
      {/* A label that stays: the placeholder was the field's only name and
          left at the first keystroke (audit P2). */}
      <Text variant="caption" color={colors.dark} nativeID="promo-label">
        {t('cart.promoLabel')}
      </Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { textAlign: inputTextAlign(lang) }]}
          aria-labelledby="promo-label"
          accessibilityLabel={t('cart.promoLabel')}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (code.trim()) apply();
          }}
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setError(false);
          }}
          placeholder={t('cart.promoPlaceholder')}
          placeholderTextColor={colors.warmGray}
          autoCapitalize="characters"
        />
        <Pressable
          style={styles.applyBtn}
          onPress={apply}
          disabled={!code.trim()}
          accessibilityRole="button"
          accessibilityState={{ disabled: !code.trim() }}
        >
          <Text variant="bodyBold" color={colors.dark}>
            {t('cart.apply')}
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text variant="caption" color={colors.red} role="alert">
          {t('cart.promoInvalid')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  appliedCode: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  removeBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
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
    // textAlign is set per language at render (lib/inputAlign): a fixed
    // 'left' pinned Arabic to the wrong edge.
  },
  applyBtn: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.lightGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
