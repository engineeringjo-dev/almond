import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import type { OrderStatus } from '@/types';

const STEPS: { status: OrderStatus; key: string; emoji: string }[] = [
  { status: 'received', key: 'track.received', emoji: '🧾' },
  { status: 'preparing', key: 'track.preparing', emoji: '☕' },
  { status: 'ready', key: 'track.ready', emoji: '✅' },
  { status: 'completed', key: 'track.completed', emoji: '🎉' },
];

const ORDER: OrderStatus[] = ['received', 'preparing', 'ready', 'completed'];

export function StatusTimeline({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  const currentIdx = ORDER.indexOf(status);

  // Pulsing "live" ring on the active step.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={styles.wrap}>
      {STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <View key={step.status} style={styles.step}>
            <View style={styles.indicator}>
              <View style={styles.dotBox}>
                {active ? (
                  <Animated.View
                    style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
                  />
                ) : null}
                <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                  <Text style={styles.dotEmoji}>{done ? step.emoji : ''}</Text>
                </View>
              </View>
              {i < STEPS.length - 1 ? (
                <View style={[styles.line, i < currentIdx && styles.lineDone]} />
              ) : null}
            </View>
            <View style={styles.labelWrap}>
              <Text
                variant={active ? 'bodyBold' : 'body'}
                color={done ? colors.dark : colors.warmGray}
              >
                {t(step.key)}
              </Text>
              {active && status !== 'completed' ? (
                <Text variant="caption" color={colors.primary}>
                  {t('track.nowLive')}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md },
  indicator: { alignItems: 'center', width: 44 },
  dotBox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
  },
  dot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.lightGold, borderColor: colors.primary },
  dotActive: { borderColor: colors.primary, borderWidth: 3 },
  dotEmoji: { fontSize: 18 },
  line: { width: 3, flex: 1, minHeight: 28, backgroundColor: colors.neutralWarm, marginVertical: 2 },
  lineDone: { backgroundColor: colors.primary },
  labelWrap: { flex: 1, justifyContent: 'center', paddingBottom: spacing.lg, gap: 2 },
});
