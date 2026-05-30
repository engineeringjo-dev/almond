import { ReactNode } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { Text } from './Text';
import { Button } from './Button';
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
        <Text style={styles.errorEmoji}>⚠️</Text>
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
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
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
  errorEmoji: { fontSize: 44, marginBottom: spacing.md },
  errorBody: { marginVertical: spacing.md },
});
