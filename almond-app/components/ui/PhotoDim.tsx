import { StyleSheet, View } from 'react-native';
import { colors, colorScheme } from '@/constants/theme';

/**
 * Laid over a product photograph, after the image and before anything drawn
 * on it (a favourite button, «نفد»): in dark mode it dims the photo and its
 * white ground together (theme `photoDim`), in light mode it is nothing.
 */
export function PhotoDim() {
  if (colorScheme !== 'dark') return null;
  return <View style={[StyleSheet.absoluteFill, styles.dim]} />;
}

const styles = StyleSheet.create({
  dim: { backgroundColor: colors.photoDim, pointerEvents: 'none' },
});
