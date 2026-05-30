import { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors, spacing, radius, fontFamily, fontSize } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';

export default function Login() {
  const { t } = useI18n();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);

  const valid = phone.replace(/\s/g, '').length >= 9;

  const sendCode = async () => {
    if (!valid) return;
    setLoading(true);
    const full = `+962${phone.replace(/\s/g, '')}`;
    try {
      await authService.sendOtp(full);
      router.push({ pathname: '/(auth)/otp', params: { phone: full } });
    } finally {
      setLoading(false);
    }
  };

  const guest = () => {
    continueAsGuest();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.logo}>☕</Text>
          <Text variant="h1" center style={styles.title}>
            {t('auth.phoneTitle')}
          </Text>
          <Text variant="body" color={colors.warmGray} center style={styles.subtitle}>
            {t('auth.phoneSubtitle')}
          </Text>

          <View style={styles.inputRow}>
            <View style={styles.prefix}>
              <Text variant="bodyBold">+962</Text>
            </View>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('auth.phonePlaceholder')}
              placeholderTextColor={colors.warmGray}
              keyboardType="phone-pad"
              maxLength={12}
              autoFocus
            />
          </View>

          <Button
            title={t('auth.sendCode')}
            onPress={sendCode}
            disabled={!valid}
            loading={loading}
            style={{ marginTop: spacing.xl }}
          />

          <Pressable style={styles.guest} onPress={guest} hitSlop={10}>
            <Text variant="bodyBold" color={colors.brown}>
              {t('auth.guestMode')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  logo: { fontSize: 64, textAlign: 'center', marginBottom: spacing.lg },
  title: { marginBottom: spacing.sm },
  subtitle: { marginBottom: spacing.xl },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  prefix: {
    height: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lightGold,
  },
  input: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    color: colors.dark,
    borderWidth: 1,
    borderColor: colors.lightGold,
    textAlign: 'left',
  },
  guest: { alignSelf: 'center', marginTop: spacing.xl, padding: spacing.md },
});
