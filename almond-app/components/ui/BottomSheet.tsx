import { ReactNode, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';
import { Text } from './Text';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Footer stays pinned below the scrollable content (e.g. an Add button). */
  footer?: ReactNode;
}

export function BottomSheet({ visible, onClose, title, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translate = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    Animated.spring(translate, {
      toValue: visible ? 0 : height,
      useNativeDriver: true,
      friction: 11,
      tension: 70,
    }).start();
  }, [visible, height, translate]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          { maxHeight: height * 0.9, transform: [{ translateY: translate }] },
        ]}
      >
        <View style={styles.handle} />
        {title ? (
          <Text variant="h2" style={styles.title}>
            {title}
          </Text>
        ) : null}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            {footer}
          </View>
        ) : (
          <View style={{ height: insets.bottom }} />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,18,8,0.5)' },
  sheet: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    backgroundColor: colors.cream,
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.warmGray,
    opacity: 0.4,
    marginBottom: spacing.md,
  },
  title: { marginBottom: spacing.md },
  content: { paddingBottom: spacing.lg },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBg,
  },
});
