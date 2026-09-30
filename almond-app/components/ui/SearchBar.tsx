import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, fontFamily, fontSize } from '@/constants/theme';
import { Icon } from './Icon';
import { useI18n } from '@/hooks/useI18n';
import { startTextAlign } from '@/lib/direction';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder }: Props) {
  const { t, lang } = useI18n();
  const hint = placeholder ?? t('common.search');
  return (
    <View style={[styles.wrap, value.length === 0 && styles.wrapIdle]}>
      {/* Drawn icons (lucide), not the old search/clear emoji: those render per-OS, ignore the
          tint and were read aloud. */}
      <Icon name="search" size={18} color={colors.warmGray} strokeWidth={2} />
      <TextInput
        // Start where the interface reads from: the web input is dir="auto",
        // so an empty field (or its Arabic placeholder) otherwise sat left.
        style={[styles.input, { textAlign: startTextAlign(lang) }]}
        aria-label={hint}
        value={value}
        onChangeText={onChangeText}
        placeholder={hint}
        placeholderTextColor={colors.warmGray}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          style={styles.clear}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t('common.clearSearch')}
        >
          <Icon name="close" size={18} color={colors.warmGray} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // A field is a control: its own fill and a ≥3:1 edge, not white on white.
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.pill,
    paddingStart: spacing.lg,
    paddingEnd: spacing.xs,
    height: 48,
  },
  // Without the clear button, the text keeps the same inset as the icon side.
  wrapIdle: { paddingEnd: spacing.lg },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.dark,
  },
  // 44×44: sized, since the web ignores hitSlop.
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
