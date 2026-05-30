import { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { colors, spacing, radius, fontFamily, fontSize } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { loyaltyService } from '@/services/loyalty.service';
import { useUserId } from '@/stores/authStore';
import { useInvalidateLoyalty } from '@/hooks/useLoyalty';

interface Props {
  visible: boolean;
  onClose: () => void;
  branchName: string;
  branchId: string;
  orderId: string;
}

export function RatingSheet({ visible, onClose, branchName, branchId, orderId }: Props) {
  const { t } = useI18n();
  const userId = useUserId();
  const invalidate = useInvalidateLoyalty();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ rewarded: boolean } | null>(null);

  const submit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const res = await loyaltyService.rateBranch({ userId, branchId, orderId, rating, comment });
      invalidate();
      setResult(res);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setRating(0);
    setComment('');
    setResult(null);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={reset}
      title={result ? undefined : t('track.rateTitle', { branch: branchName })}
      footer={
        result ? (
          <Button title={t('common.ok')} onPress={reset} />
        ) : (
          <Button title={t('track.rateSubmit')} onPress={submit} disabled={rating === 0} loading={submitting} />
        )
      }
    >
      {result ? (
        <View style={styles.success}>
          <Text style={styles.successEmoji}>{result.rewarded ? '🎉' : '🙏'}</Text>
          <Text variant="h2" center>
            {result.rewarded ? t('track.rateRewarded') : t('track.rateThanks')}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Text style={styles.star}>{n <= rating ? '⭐' : '☆'}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.comment}
            value={comment}
            onChangeText={setComment}
            placeholder={t('track.rateComment')}
            placeholderTextColor={colors.warmGray}
            multiline
          />
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  star: { fontSize: 40 },
  comment: {
    minHeight: 80,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.dark,
    textAlign: 'left',
    textAlignVertical: 'top',
  },
  success: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  successEmoji: { fontSize: 56 },
});
