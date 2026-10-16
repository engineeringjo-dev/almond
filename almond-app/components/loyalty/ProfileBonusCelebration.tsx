import { useRef, useState } from 'react';
import { Image, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';

interface Props {
  /** The exact amount confirmed by a fresh profile-save reply. */
  points: 50;
  onComplete: () => void;
}

/** One quiet reward moment after a confirmed grant, never a prediction.
 * The image is supplementary: the returned amount and reason remain native
 * text. Opaque paper preserves the dark lettering in either appearance. */
export function ProfileBonusCelebration({ points, onComplete }: Props) {
  const { t, lang } = useI18n();
  const { height } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const closing = useRef(false);
  const completed = useRef(false);

  const finish = () => {
    if (!closing.current || completed.current) return;
    completed.current = true;
    onComplete();
  };
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setVisible(false);
    // Android removes a hidden Modal directly and has no onDismiss event.
    if (Platform.OS === 'android') finish();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      onDismiss={finish}
      title={t('details.bonusCelebrationTitle')}
      footer={<Button title={t('details.bonusCelebrationClose')} onPress={close} />}
    >
      <View
        style={[styles.artworkFrame, { height: Math.min(256, Math.round(height * 0.36)) }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <Image
          source={require('../../assets/rewards/profile-bonus-50.png')}
          style={styles.artwork}
          resizeMode="contain"
          accessible={false}
          accessibilityIgnoresInvertColors
        />
      </View>
      <Text variant="body" center selectable style={styles.body}>
        {t('details.bonusCelebrationBody', { points: formatNumber(points, lang) })}
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  artworkFrame: { backgroundColor: colors.white, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  artwork: { width: '100%', height: '100%' },
  body: { marginTop: spacing.md },
});
