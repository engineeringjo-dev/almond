import { Text, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';

/** Emoji-based tab icon (operating rule 0.1 — emoji placeholder for missing assets). */
export function TabBarIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.icon, { opacity: focused ? 1 : 0.5 }]}>{emoji}</Text>
      {focused ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
    marginTop: 3,
  },
});
