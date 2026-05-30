import { View, StyleSheet } from 'react-native';
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

  return (
    <View style={styles.wrap}>
      {STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <View key={step.status} style={styles.step}>
            <View style={styles.indicator}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  active && styles.dotActive,
                ]}
              >
                <Text style={styles.dotEmoji}>{done ? step.emoji : ''}</Text>
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
  dot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.lightGold, borderColor: colors.gold },
  dotActive: { borderColor: colors.gold, borderWidth: 3 },
  dotEmoji: { fontSize: 18 },
  line: { width: 3, flex: 1, minHeight: 28, backgroundColor: colors.cardBg, marginVertical: 2 },
  lineDone: { backgroundColor: colors.gold },
  labelWrap: { flex: 1, justifyContent: 'center', paddingBottom: spacing.lg },
});
