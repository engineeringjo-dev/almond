import { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { Stack, router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing, radius, fontFamily } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { useLoyaltyBalance, usePreviewTransfer, useSendTransfer, useWallet } from '@/hooks/useLoyalty';
import { apiErrorCode, newIdempotencyKey } from '@/lib/apiClient';
import { formatJOD, formatNumber } from '@/lib/format';
import { toWesternDigits } from '@almond/shared/lib/phone';
import type { TransferKind } from '@almond/shared/loyalty/transfer';
import type { TransferPreview, TransferReceipt } from '@/services/loyalty.service';

/**
 * SEND TO A FRIEND — points or wallet balance. Owner, 2026-09-24.
 *
 * Three steps, each one a server answer, never a client guess:
 *   1. WHO: the member types a phone; POST /v1/me/transfers/preview answers
 *      with a MASKED name («سارة خ.») or a refusal — a number that has never
 *      signed in is refused, never turned into an account;
 *   2. HOW MUCH: the amount, within what the server says is left today;
 *   3. DONE: the receipt the transfer returned.
 *
 * The Idempotency-Key is made ONCE per confirmed amount and kept for retries,
 * so a double tap or a flaky network cannot send twice. There is no SMS
 * step-up: none exists in the server yet (docs/INTEGRATIONS.md) — the daily
 * cap is what bounds a lost phone.
 */
type Step = 'who' | 'amount' | 'done';

const KNOWN_ERRORS = new Set([
  'phone_invalid', 'recipient_not_found', 'transfer_to_self', 'transfer_below_min',
  'transfer_daily_cap', 'insufficient_points', 'insufficient_wallet', 'rate_limited',
]);

/** Arabic-Indic digits and a comma decimal both arrive from an Arabic keyboard. */
const parseAmount = (raw: string): number => Number(toWesternDigits(raw).replace('،', '.').replace(',', '.').trim());

export default function TransferScreen() {
  const { t, lang } = useI18n();
  const { data: balance } = useLoyaltyBalance();
  const { data: wallet } = useWallet();
  const preview = usePreviewTransfer();
  const send = useSendTransfer();

  const [kind, setKind] = useState<TransferKind>('points');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<Step>('who');
  const [who, setWho] = useState<TransferPreview | null>(null);
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
  // One key per confirmation; cleared when the amount or kind changes.
  const [idemKey, setIdemKey] = useState<string | null>(null);

  const errorOf = (e: unknown): string => {
    const c = apiErrorCode(e);
    return t(c && KNOWN_ERRORS.has(c) ? `transfer.error.${c}` : 'transfer.error.generic');
  };

  const onFind = () => {
    preview.mutate(phone.trim(), {
      onSuccess: (res) => { setWho(res); setStep('amount'); },
    });
  };

  const value = parseAmount(amount);
  const valid = Number.isFinite(value) && value > 0 && (kind === 'wallet' || Number.isInteger(value));

  const onSend = () => {
    const key = idemKey ?? newIdempotencyKey();
    setIdemKey(key);
    send.mutate(
      { phone: phone.trim(), kind, amount: value, idempotencyKey: key },
      { onSuccess: (res) => { setReceipt(res); setStep('done'); } },
    );
  };

  const remaining = who
    ? (kind === 'points'
      ? t('transfer.remainingPoints', { points: formatNumber(who.remainingToday.points, lang) })
      : t('transfer.remainingWallet', { jod: formatJOD(who.remainingToday.walletJod, lang) }))
    : null;
  const friendName = who?.displayName ?? t('transfer.aMember');

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('transfer.title') }} />
      <Screen>
        {step !== 'done' ? (
          <View style={styles.kindRow} accessibilityRole="radiogroup">
            {(['points', 'wallet'] as const).map((k) => {
              const active = kind === k;
              return (
                <Pressable
                  key={k}
                  style={[styles.kindChip, active && styles.kindActive]}
                  onPress={() => { setKind(k); setIdemKey(null); send.reset(); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <Text variant="bodyBold" color={active ? colors.white : colors.warmGray}>
                    {k === 'points' ? t('transfer.kindPoints') : t('transfer.kindWallet')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {step === 'who' ? (
          <Card style={styles.card}>
            <Text variant="caption" color={colors.warmGray}>
              {kind === 'points'
                ? t('transfer.havePoints', { points: formatNumber(balance?.points ?? 0, lang) })
                : t('transfer.haveWallet', { jod: formatJOD(wallet ?? 0, lang) })}
            </Text>
            <Text variant="bodyBold">{t('transfer.phoneLabel')}</Text>
            <TextInput
              value={phone}
              onChangeText={(v) => { setPhone(v); if (preview.isError) preview.reset(); }}
              placeholder={t('transfer.phonePlaceholder')}
              placeholderTextColor={colors.warmGray}
              keyboardType="phone-pad"
              maxLength={20}
              style={[styles.input, styles.ltr]}
              accessibilityLabel={t('transfer.phoneLabel')}
            />
            <Text variant="caption" color={colors.warmGray}>{t('transfer.registeredOnly')}</Text>
            {preview.isError ? (
              <Text variant="caption" color={colors.red} accessibilityLiveRegion="polite">
                {errorOf(preview.error)}
              </Text>
            ) : null}
            <Button
              title={t('transfer.find')}
              onPress={onFind}
              disabled={phone.trim() === ''}
              loading={preview.isPending}
            />
          </Card>
        ) : null}

        {step === 'amount' && who ? (
          <Card style={styles.card}>
            <Text variant="caption" color={colors.warmGray}>{t('transfer.sendingTo')}</Text>
            <Text variant="h2">{friendName}</Text>
            <Text variant="caption" color={colors.warmGray}>{t('transfer.checkName')}</Text>

            <Text variant="bodyBold" style={styles.label}>
              {kind === 'points' ? t('transfer.amountPoints') : t('transfer.amountWallet')}
            </Text>
            <TextInput
              value={amount}
              onChangeText={(v) => { setAmount(v); setIdemKey(null); if (send.isError) send.reset(); }}
              placeholder={kind === 'points'
                ? formatNumber(config.TRANSFER_POINTS_MIN, lang)
                : formatNumber(config.TRANSFER_WALLET_MIN_JOD, lang)}
              placeholderTextColor={colors.warmGray}
              keyboardType={kind === 'points' ? 'number-pad' : 'decimal-pad'}
              maxLength={10}
              style={[styles.input, styles.ltr]}
              accessibilityLabel={kind === 'points' ? t('transfer.amountPoints') : t('transfer.amountWallet')}
            />
            {remaining ? <Text variant="caption" color={colors.warmGray}>{remaining}</Text> : null}
            <Text variant="caption" color={colors.warmGray}>
              {kind === 'points' ? t('transfer.pointsKeepExpiry') : t('transfer.walletNote')}
            </Text>
            {send.isError ? (
              <Text variant="caption" color={colors.red} accessibilityLiveRegion="polite">
                {errorOf(send.error)}
              </Text>
            ) : null}
            <Button
              title={t('transfer.send', { name: friendName })}
              onPress={onSend}
              disabled={!valid}
              loading={send.isPending}
            />
            <Button
              title={t('transfer.changeNumber')}
              variant="ghost"
              onPress={() => { setStep('who'); setWho(null); setIdemKey(null); send.reset(); }}
            />
          </Card>
        ) : null}

        {step === 'done' && receipt ? (
          <Card style={[styles.card, styles.done]}>
            <Text style={styles.emoji}>✅</Text>
            <Text variant="h2" center>
              {receipt.kind === 'points'
                ? t('transfer.sentPoints', {
                    points: formatNumber(receipt.amount, lang),
                    name: receipt.recipientDisplayName ?? t('transfer.aMember'),
                  })
                : t('transfer.sentWallet', {
                    jod: formatJOD(receipt.amount, lang),
                    name: receipt.recipientDisplayName ?? t('transfer.aMember'),
                  })}
            </Text>
            <Text variant="body" center color={colors.warmGray}>
              {receipt.kind === 'points'
                ? t('transfer.nowPoints', { points: formatNumber(receipt.pointsBalance, lang) })
                : t('transfer.nowWallet', { jod: formatJOD(receipt.walletBalance, lang) })}
            </Text>
            <Button title={t('transfer.done')} onPress={() => router.back()} />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  kindRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.lg,
  },
  kindChip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  kindActive: { backgroundColor: colors.primary },
  card: { gap: spacing.sm },
  label: { marginTop: spacing.md },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    color: colors.dark,
  },
  // A phone number and an amount read left-to-right in both languages.
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  done: { alignItems: 'center' },
  emoji: { fontSize: 48 },
});
