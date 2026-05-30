import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { colors, spacing, radius, fontFamily, fontSize } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useAddressStore } from '@/stores/addressStore';

export default function AddressesScreen() {
  const { t } = useI18n();
  const { addresses, add, remove, hydrate } = useAddressStore();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [details, setDetails] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const save = () => {
    if (!label.trim() || !details.trim()) return;
    add(label.trim(), details.trim());
    setLabel('');
    setDetails('');
    setOpen(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: t('profile.addresses') }} />
      <Screen>
        {addresses.length > 0 ? (
          <View style={styles.list}>
            {addresses.map((a) => (
              <Card key={a.id} style={styles.row}>
                <Text style={styles.pin}>📍</Text>
                <View style={styles.body}>
                  <Text variant="bodyBold">{a.label}</Text>
                  <Text variant="caption" color={colors.warmGray}>
                    {a.details}
                  </Text>
                </View>
                <Pressable onPress={() => remove(a.id)} hitSlop={8}>
                  <Text color={colors.red}>🗑️</Text>
                </Pressable>
              </Card>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📍</Text>
            <Text variant="body" color={colors.warmGray}>
              {t('profile.noAddresses')}
            </Text>
          </View>
        )}

        <Button
          title={t('profile.addAddress')}
          onPress={() => setOpen(true)}
          variant="outline"
          leadingEmoji="＋"
          style={{ marginTop: spacing.lg }}
        />
      </Screen>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('profile.addAddress')}
        footer={<Button title={t('common.save')} onPress={save} />}
      >
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder={t('profile.addresses')}
            placeholderTextColor={colors.warmGray}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={details}
            onChangeText={setDetails}
            placeholder="..."
            placeholderTextColor={colors.warmGray}
            multiline
          />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pin: { fontSize: 22 },
  body: { flex: 1, gap: 2 },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  emptyEmoji: { fontSize: 56 },
  form: { gap: spacing.md },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.dark,
    textAlign: 'left',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
});
