import { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors, spacing, radius, fontFamily, fontSize } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function Otp() {
  const { t } = useI18n();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  // Auto-verify once 6 digits entered (auto-fill from SMS, section 2.1).
  useEffect(() => {
    if (code.length === OTP_LENGTH) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const verify = async () => {
    if (code.length !== OTP_LENGTH || loading) return;
    setLoading(true);
    setError(false);
    try {
      const user = await authService.verifyOtp(phone ?? '', code);
      setUser(user);
      router.replace('/(tabs)');
    } catch {
      setError(true);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (seconds > 0) return;
    await authService.sendOtp(phone ?? '');
    setSeconds(RESEND_SECONDS);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text variant="h1" center style={styles.title}>
            {t('auth.otpTitle')}
          </Text>
          <Text variant="body" color={colors.warmGray} center style={styles.subtitle}>
            {t('auth.otpSubtitle', { phone })}
          </Text>

          <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.box,
                  i === code.length && styles.boxActive,
                  error && styles.boxError,
                ]}
              >
                <Text variant="h2">{code[i] ?? ''}</Text>
              </View>
            ))}
          </Pressable>

          {error ? (
            <Text variant="caption" color={colors.red} center style={styles.errorText}>
              {t('common.errorTitle')}
            </Text>
          ) : null}

          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, OTP_LENGTH))}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoFocus
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
          />

          <Button
            title={t('auth.verify')}
            onPress={verify}
            disabled={code.length !== OTP_LENGTH}
            loading={loading}
            style={{ marginTop: spacing.xl }}
          />

          <Pressable style={styles.resend} onPress={resend} disabled={seconds > 0} hitSlop={10}>
            <Text variant="bodyBold" color={seconds > 0 ? colors.warmGray : colors.brown}>
              {seconds > 0 ? t('auth.resendIn', { seconds }) : t('auth.resend')}
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
  title: { marginBottom: spacing.sm },
  subtitle: { marginBottom: spacing.xl },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  box: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.lightGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.gold, borderWidth: 2 },
  boxError: { borderColor: colors.red },
  errorText: { marginTop: spacing.md },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  resend: { alignSelf: 'center', marginTop: spacing.xl, padding: spacing.md },
});
