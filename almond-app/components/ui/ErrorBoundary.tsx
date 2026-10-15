import { Component, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { Text } from './Text';
import { Icon } from './Icon';
import { Button } from './Button';
import i18n from '@/lib/i18n';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * App-wide error boundary (polish, section 14). Catches render errors so the
 * user sees a friendly recovery screen instead of a white crash.
 *
 * In the member's language, like every other screen: «الغة اما عربي او انجليزي
 * مش حلو الخلط» (owner, 2026-09-08). It said «إعادة المحاولة / Retry» on one
 * button (Arabic expert, 2026-10-15). Both languages appear only when i18n
 * never started, the one case where this screen cannot know which is theirs.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Caught by ErrorBoundary:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const ready = i18n.isInitialized;
    return (
      <View style={styles.container}>
        <Icon name="alert" size={48} color={colors.dark} strokeWidth={1.5} />
        <Text variant="h2" center>
          {ready ? i18n.t('common.errorTitle') : 'حدث خطأ غير متوقع'}
        </Text>
        <Text variant="caption" color={colors.warmGray} center style={styles.body}>
          {ready ? i18n.t('common.errorBody') : 'Something went wrong. Please try again.'}
        </Text>
        <Button
          title={ready ? i18n.t('common.retry') : 'إعادة المحاولة / Retry'}
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
  body: { marginBottom: spacing.lg },
});
