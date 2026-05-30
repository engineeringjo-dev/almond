import { Component, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { Text } from './Text';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * App-wide error boundary (polish, section 14). Catches render errors so the
 * user sees a friendly recovery screen instead of a white crash.
 * Copy is bilingual-safe (shown regardless of i18n state).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn('Caught by ErrorBoundary:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>☕</Text>
        <Text variant="h2" center>
          حدث خطأ غير متوقع
        </Text>
        <Text variant="caption" color={colors.warmGray} center style={styles.body}>
          Something went wrong. Please try again.
        </Text>
        <Button
          title="إعادة المحاولة / Retry"
          onPress={() => this.setState({ hasError: false })}
          fullWidth={false}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emoji: { fontSize: 64 },
  body: { marginBottom: spacing.lg },
});
