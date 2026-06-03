import { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, Share } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { GiftCardTile } from './GiftCardTile';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { useSendGift, useWallet } from '@/hooks/useLoyalty';
import type { GiftDesign } from '@/lib/giftDesigns';
import type { GiftCard } from '@/types';

const AMOUNTS = [5, 10, 15, 25];
const MAX_RECIPIENTS = 10;

interface Recipient {
  name: string;
  phone: string;
}

interface Props {
  design: GiftDesign | null;
  visible: boolean;
  onClose: () => void;
}

export function GiftSendSheet({ design, visible, onClose }: Props) {
  const { t, lang } = useI18n();
  const sendGift = useSendGift();
  const { data: wallet } = useWallet();
  const [amount, setAmount] = useState(10);
  const [recipients, setRecipients] = useState<Recipient[]>([{ name: '', phone: '' }]);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<GiftCard[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!design) return null;

  const valid = recipients.filter((r) => r.name.trim());
  const total = amount * Math.max(1, valid.length);

  const reset = () => {
    setAmount(10); setRecipients([{ name: '', phone: '' }]); setMessage(''); setSent(null);
  };
  const close = () => { reset(); onClose(); };

  const setRecipient = (i: number, patch: Partial<Recipient>) =>
    setRecipients((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRecipient = () =>
    setRecipients((prev) => (prev.length >= MAX_RECIPIENTS ? prev : [...prev, { name: '', phone: '' }]));
  const removeRecipient = (i: number) =>
    setRecipients((prev) => prev.filter((_, idx) => idx !== i));

  const onSend = async () => {
    if (valid.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const results: GiftCard[] = [];
      for (const r of valid) {
        const g = await sendGift.mutateAsync({
          designId: design.id,
          amount,
          recipientName: r.name.trim(),
          recipientPhone: r.phone.trim() || undefined,
          message: message.trim() || undefined,
        });
        results.push(g);
      }
      setSent(results);
    } finally {
      setSubmitting(false);
    }
  };

  const shareGift = (g: GiftCard) => {
    Share.share({
      message: t('gift.shareMessage', { jod: formatJOD(g.amount, lang), code: g.code }),
    }).catch(() => {});
  };

  // ---------- Success ----------
  if (sent) {
    return (
      <BottomSheet visible={visible} onClose={close} title={t('gift.sentTitle')}
        footer={<Button title={t('gift.done')} onPress={close} />}>
        <View style={styles.center}>
          <GiftCardTile design={design} size="featured" amount={amount} />
          <Text variant="body" color={colors.warmGray} center style={styles.sentBody}>
            {t('gift.sentCount', { count: sent.length })}
          </Text>
          {sent.map((g) => (
            <View key={g.id} style={styles.codeBox}>
              <View style={styles.flex}>
                <Text variant="bodyBold">{t('gift.toName', { name: g.recipientName })}</Text>
                <Text variant="caption" color={colors.warmGray}>{g.code}</Text>
              </View>
              <Pressable style={styles.shareBtn} onPress={() => shareGift(g)} hitSlop={6}>
                <Icon name="navigation" size={16} color={colors.primary} />
                <Text variant="caption" color={colors.primary}>{t('gift.share')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </BottomSheet>
    );
  }

  // ---------- Compose ----------
  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={t('gift.sendTitle')}
      footer={
        <Button
          title={`${t('gift.send')} · ${formatJOD(total, lang)}`}
          onPress={onSend}
          loading={submitting}
          disabled={valid.length === 0}
        />
      }
    >
      <View style={styles.preview}>
        <GiftCardTile design={design} size="featured" amount={amount} />
      </View>

      <Text variant="bodyBold" style={styles.label}>{t('gift.amount')}</Text>
      <View style={styles.amounts}>
        {AMOUNTS.map((a) => {
          const active = a === amount;
          return (
            <Pressable key={a} style={[styles.amountChip, active && styles.amountActive]} onPress={() => setAmount(a)}>
              <Text variant="bodyBold" color={active ? colors.dark : colors.warmGray}>
                {formatJOD(a, lang)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Recipients (group gifting up to 10) */}
      <View style={styles.recipHead}>
        <Text variant="bodyBold">{t('gift.recipients')}</Text>
        {recipients.length < MAX_RECIPIENTS ? (
          <Pressable style={styles.addRecip} onPress={addRecipient} hitSlop={6}>
            <Icon name="plus" size={16} color={colors.primary} />
            <Text variant="caption" color={colors.primary}>{t('gift.addRecipient')}</Text>
          </Pressable>
        ) : null}
      </View>
      {recipients.map((r, i) => (
        <View key={i} style={styles.recipRow}>
          <View style={styles.flex}>
            <TextInput
              style={styles.input}
              value={r.name}
              onChangeText={(v) => setRecipient(i, { name: v })}
              placeholder={t('gift.recipientNamePh')}
              placeholderTextColor={colors.warmGray}
            />
            <TextInput
              style={[styles.input, styles.phoneInput]}
              value={r.phone}
              onChangeText={(v) => setRecipient(i, { phone: v })}
              keyboardType="phone-pad"
              placeholder={t('gift.phoneOptional')}
              placeholderTextColor={colors.warmGray}
            />
          </View>
          {recipients.length > 1 ? (
            <Pressable onPress={() => removeRecipient(i)} hitSlop={8} style={styles.removeBtn}>
              <Icon name="close" size={18} color={colors.warmGray} />
            </Pressable>
          ) : null}
        </View>
      ))}

      <Text variant="bodyBold" style={styles.label}>{t('gift.message')}</Text>
      <TextInput
        style={[styles.input, styles.messageInput]}
        value={message}
        onChangeText={setMessage}
        placeholder={t('gift.messagePh')}
        placeholderTextColor={colors.warmGray}
        multiline
      />

      <Text variant="caption" color={colors.warmGray} style={styles.payNote}>
        {t('gift.payNote', { jod: formatJOD(wallet ?? 0, lang) })}
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  preview: { marginBottom: spacing.lg },
  flex: { flex: 1 },
  label: { marginTop: spacing.md, marginBottom: spacing.sm },
  amounts: { flexDirection: 'row', gap: spacing.sm },
  amountChip: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.cardBg,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  amountActive: { borderColor: colors.primary, backgroundColor: colors.lightGold },
  recipHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  addRecip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  recipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.cardBg, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: 16, color: colors.dark, textAlign: 'auto',
  },
  phoneInput: { marginTop: spacing.xs },
  messageInput: { minHeight: 64, textAlignVertical: 'top' },
  removeBtn: { padding: spacing.xs },
  payNote: { marginTop: spacing.md, textAlign: 'center' },
  center: { alignItems: 'center', gap: spacing.md },
  sentBody: { marginTop: spacing.sm },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    alignSelf: 'stretch',
    backgroundColor: colors.cardBg, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderWidth: 1.5, borderColor: colors.lightGold, borderStyle: 'dashed',
  },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
