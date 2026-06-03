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
import { useSendGift } from '@/hooks/useLoyalty';
import type { GiftDesign } from '@/lib/giftDesigns';
import type { GiftCard } from '@/types';

const AMOUNTS = [5, 10, 15, 25];

interface Props {
  design: GiftDesign | null;
  visible: boolean;
  onClose: () => void;
}

export function GiftSendSheet({ design, visible, onClose }: Props) {
  const { t, lang } = useI18n();
  const sendGift = useSendGift();
  const [amount, setAmount] = useState(10);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<GiftCard | null>(null);

  if (!design) return null;

  const reset = () => {
    setAmount(10); setName(''); setPhone(''); setMessage(''); setSent(null);
  };
  const close = () => { reset(); onClose(); };

  const onSend = () => {
    if (!name.trim() || sendGift.isPending) return;
    sendGift.mutate(
      { designId: design.id, amount, recipientName: name.trim(), recipientPhone: phone.trim() || undefined, message: message.trim() || undefined },
      { onSuccess: (gift) => setSent(gift) },
    );
  };

  const onShare = () => {
    if (!sent) return;
    Share.share({ message: t('gift.shareMessage', { jod: formatJOD(sent.amount, lang), code: sent.code }) }).catch(() => {});
  };

  // Success state
  if (sent) {
    return (
      <BottomSheet visible={visible} onClose={close} title={t('gift.sentTitle')}
        footer={<Button title={t('gift.done')} onPress={close} />}>
        <View style={styles.center}>
          <GiftCardTile design={design} size="featured" amount={sent.amount} />
          <Text variant="body" color={colors.warmGray} center style={styles.sentBody}>
            {t('gift.sentBody', { name: sent.recipientName })}
          </Text>
          <View style={styles.codeBox}>
            <Text variant="caption" color={colors.warmGray}>{t('gift.code')}</Text>
            <Text variant="h2" color={colors.dark}>{sent.code}</Text>
          </View>
          <Pressable style={styles.shareBtn} onPress={onShare}>
            <Icon name="navigation" size={18} color={colors.primary} />
            <Text variant="bodyBold" color={colors.primary}>{t('gift.share')}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={t('gift.sendTitle')}
      footer={
        <Button
          title={`${t('gift.send')} · ${formatJOD(amount, lang)}`}
          onPress={onSend}
          loading={sendGift.isPending}
          disabled={!name.trim()}
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

      <Text variant="bodyBold" style={styles.label}>{t('gift.recipientName')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('gift.recipientNamePh')}
        placeholderTextColor={colors.warmGray}
      />

      <Text variant="bodyBold" style={styles.label}>{t('gift.phoneOptional')}</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder={t('auth.phonePlaceholder')}
        placeholderTextColor={colors.warmGray}
      />

      <Text variant="bodyBold" style={styles.label}>{t('gift.message')}</Text>
      <TextInput
        style={[styles.input, styles.messageInput]}
        value={message}
        onChangeText={setMessage}
        placeholder={t('gift.messagePh')}
        placeholderTextColor={colors.warmGray}
        multiline
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  preview: { marginBottom: spacing.lg },
  label: { marginTop: spacing.md, marginBottom: spacing.sm },
  amounts: { flexDirection: 'row', gap: spacing.sm },
  amountChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  amountActive: { borderColor: colors.gold, backgroundColor: colors.lightGold },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.dark,
    textAlign: 'auto',
  },
  messageInput: { minHeight: 72, textAlignVertical: 'top' },
  center: { alignItems: 'center', gap: spacing.md },
  sentBody: { marginTop: spacing.sm },
  codeBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.lightGold,
    borderStyle: 'dashed',
  },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
});
