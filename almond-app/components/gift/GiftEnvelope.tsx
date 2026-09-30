import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';

interface Props {
  amount: number;
  /** Recipients' names; empty ones are skipped. */
  names?: string[];
  message?: string;
}

/**
 * What travels WITH the card: the value, who it is for and the note. Kept off
 * the card face — the design brief puts personal details "inside the
 * envelope" so the artwork is never covered.
 */
export function GiftEnvelope({ amount, names = [], message }: Props) {
  const { t, lang } = useI18n();
  const to = names.map((n) => n.trim()).filter(Boolean);
  const note = message?.trim();
  return (
    <View style={styles.box}>
      <Text variant="h2" color={colors.dark}>{formatJOD(amount, lang)}</Text>
      {to.length > 0 ? (
        <Text variant="bodyBold" style={styles.line}>{t('gift.toName', { name: to.join(lang === 'ar' ? '، ' : ', ') })}</Text>
      ) : null}
      {note ? (
        <Text variant="body" color={colors.warmGray} style={styles.line}>{lang === 'ar' ? `«${note}»` : `“${note}”`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.lightGold,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  line: { marginTop: spacing.xs, textAlign: 'center' },
});
