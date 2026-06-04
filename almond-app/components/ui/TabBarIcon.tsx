import { StyleSheet, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { colors } from '@/constants/theme';

/**
 * Tab icon from the unified line-icon set (no emoji). The focused dot is
 * absolutely positioned so it never adds height (prevents label clipping).
 */
export function TabBarIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={styles.wrap}>
      <Icon
        name={name}
        size={24}
        color={focused ? colors.primary : colors.warmGray}
        strokeWidth={focused ? 2.4 : 2}
      />
      {focused ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 30, height: 28, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    bottom: -5,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
});
