import { ReactNode } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { Text } from './Text';
import { Button } from './Button';
import { Icon } from './Icon';
import { useI18n } from '@/hooks/useI18n';

interface Props {
  children?: ReactNode;
  scroll?: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: object;
  background?: string;
}

/**
 * Standard screen wrapper that handles loading and error states for every
 * screen (operating rule 0.4). Empty states are handled per-screen.
 */
export function Screen({
  children,
  scroll = true,
  loading,
  error,
  onRetry,
  edges = ['top'],
  refreshing,
  onRefresh,
  contentStyle,
  background = colors.cream,
}: Props) {
  const { t } = useI18n();

  let body: ReactNode = children;
  if (loading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text variant="caption" color={colors.warmGray} style={{ marginTop: spacing.md }}>
          {t('common.loading')}
        </Text>
      </View>
    );
  } else if (error) {
    body = (
      <View style={styles.center}>
        <View style={styles.errorIcon}>
          <Icon name="alert" size={40} color={colors.warmGray} strokeWidth={1.8} />
        </View>
        <Text variant="title" center>{t('common.errorTitle')}</Text>
        <Text variant="caption" color={colors.warmGray} center style={styles.errorBody}>
          {t('common.errorBody')}
        </Text>
        {onRetry ? (
          <Button title={t('common.retry')} onPress={onRetry} fullWidth={false} variant="outline" />
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={edges}>
      {scroll && !loading && !error ? (
        // KEYBOARD (audit P2): the promo and car-info fields sat under the
        // keyboard with nothing to lift them. The avoiding view shrinks the
        // scroll area by however much of THIS screen the keyboard covers (a
        // footer or tab bar below the screen is subtracted by its own frame),
        // and the platform then scrolls the focused field into view. 'padding'
        // on both platforms: Android is edge-to-edge, so the window no longer
        // resizes for the keyboard on its own. Web: a plain view.
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'web' ? undefined : 'padding'}
        >
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            showsVerticalScrollIndicator={false}
            // A tap on «تطبيق» with the keyboard up applies the code on the
            // first tap, instead of only closing the keyboard.
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
              ) : undefined
            }
          >
            {body}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.flex, (loading || error) && styles.center]}>{body}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errorIcon: { marginBottom: spacing.md },
  errorBody: { marginVertical: spacing.md },
});
