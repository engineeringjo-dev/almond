import { View, StyleSheet, Pressable } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useAppStore } from '@/stores/appStore';
import type { Lang } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const OPTIONS: { id: Lang; key: string }[] = [
  { id: 'ar', key: 'language.arabic' },
  { id: 'en', key: 'language.english' },
];

export function LanguageSheet({ visible, onClose }: Props) {
  const { t, lang } = useI18n();
  const setLang = useAppStore((s) => s.setLang);

  const choose = async (next: Lang) => {
    if (next !== lang) {
      // Flipping RTL/LTR on native fully applies after a reload; text + i18n
      // update immediately. DECISION: no forced reload in MVP — re-render covers
      // most layouts (start/end-based), avoiding an expo-updates dependency.
      await setLang(next);
    }
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('language.title')}>
      <View style={styles.list}>
        {OPTIONS.map((o) => {
          const active = o.id === lang;
          return (
            <Pressable
              key={o.id}
              style={[styles.row, active && styles.rowActive]}
              onPress={() => choose(o.id)}
            >
              <Text variant="bodyBold" color={active ? colors.dark : colors.warmGray}>
                {t(o.key)}
              </Text>
              {active ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  rowActive: { borderColor: colors.gold },
  check: { color: colors.gold, fontSize: 18 },
});
