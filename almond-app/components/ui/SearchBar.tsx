import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, fontFamily, fontSize } from '@/constants/theme';
import { Text } from './Text';
import { useI18n } from '@/hooks/useI18n';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder }: Props) {
  const { t } = useI18n();
  const hint = placeholder ?? t('common.search');
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon} aria-hidden>
        🔍
      </Text>
      <TextInput
        style={styles.input}
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
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.clearSearch')}
        >
          <Text style={styles.clear}>✕</Text>
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
    backgroundColor: colors.cardBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 48,
  },
  icon: { fontSize: 16 },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.dark,
    // No physical `left`: the field starts where the reading starts, beside
    // the icon, now that the web build carries <html dir>.
  },
  clear: { color: colors.warmGray, fontSize: 16 },
});
