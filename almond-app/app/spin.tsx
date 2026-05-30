import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router, Stack } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Wheel, type WheelHandle } from '@/components/loyalty/Wheel';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useSpinConfig, useSpinEligibility, useInvalidateLoyalty } from '@/hooks/useLoyalty';
import { loyaltyService } from '@/services/loyalty.service';
import { useUserId } from '@/stores/authStore';
import { formatJOD } from '@/lib/format';
import type { SpinPrize } from '@/types';

export default function SpinScreen() {
  const { t, lang } = useI18n();
  const userId = useUserId();
  const configQ = useSpinConfig();
  const eligibilityQ = useSpinEligibility();
  const invalidate = useInvalidateLoyalty();
  const wheelRef = useRef<WheelHandle>(null);

  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinPrize | null>(null);

  // Refetch live config + eligibility when the wheel opens (section 13.4).
  useEffect(() => {
    configQ.refetch();
    eligibilityQ.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enabledPrizes = useMemo(
    () => (configQ.data?.prizes ?? []).filter((p: SpinPrize) => p.enabled),
    [configQ.data],
  );

  const masterOff = configQ.data && !configQ.data.eligibility.enabled;
  const canSpin = !!eligibilityQ.data?.canSpin && !masterOff;
  const spinsAvailable = eligibilityQ.data?.spinsAvailable ?? 0;
  const visitsPerSpin = configQ.data?.eligibility.visitsPerSpin ?? 5;

  const onSpin = async () => {
    if (!canSpin || spinning) return;
    setSpinning(true);
    setResult(null);
    try {
      // Prize is decided server-side (anti-cheat, section 13.4); client only animates.
      const { prize, prizeIndex } = await loyaltyService.spin(userId);
      await wheelRef.current?.spinTo(prizeIndex);
      setResult(prize);
      invalidate();
      eligibilityQ.refetch();
    } catch {
      // No spins / error — re-enable button.
    } finally {
      setSpinning(false);
    }
  };

  const loading = configQ.isLoading || eligibilityQ.isLoading;
  if (loading || configQ.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t('spin.title') }} />
        <Screen loading={loading} error={configQ.isError} onRetry={configQ.refetch} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('spin.title') }} />
      <Screen scroll={false}>
        <View style={styles.container}>
          {masterOff ? (
            <View style={styles.disabled}>
              <Text style={styles.bigEmoji}>🎡</Text>
              <Text variant="h2" center>
                {t('spin.disabled')}
              </Text>
            </View>
          ) : (
            <>
              {/* Header: prominent "win for free" */}
              <View style={styles.header}>
                <Text variant="h1" center color={colors.gold}>
                  {t('loyalty.winFree')}
                </Text>
              </View>

              {/* Wheel centered */}
              <View style={styles.wheelArea}>
                <View style={styles.pointer} />
                <Wheel ref={wheelRef} prizes={enabledPrizes} size={296} lang={lang} />
              </View>

              {/* Footer: spins info + spin button clearly below the wheel */}
              <View style={styles.footer}>
                <View style={styles.info}>
                  {canSpin ? (
                    <Text variant="title" center color={colors.primary}>
                      {t('spin.spinsLeft', { count: spinsAvailable })}
                    </Text>
                  ) : (
                    <>
                      <Text variant="title" center>
                        {t('spin.noSpins')}
                      </Text>
                      <Text variant="caption" center color={colors.warmGray}>
                        {t('spin.noSpinsHint', { visits: visitsPerSpin })}
                      </Text>
                    </>
                  )}
                </View>

                <Button
                  title={spinning ? t('spin.spinning') : t('spin.spinNow')}
                  onPress={onSpin}
                  disabled={!canSpin || spinning}
                  loading={spinning}
                  leadingEmoji="🎡"
                />
              </View>
            </>
          )}
        </View>
      </Screen>

      <BottomSheet
        visible={!!result}
        onClose={() => setResult(null)}
        footer={<Button title={t('spin.collect')} onPress={() => { setResult(null); router.push('/loyalty'); }} />}
      >
        {result ? (
          <View style={styles.resultWrap}>
            <Text style={styles.bigEmoji}>{result.type === 'credit' ? '💰' : '🎁'}</Text>
            <Text variant="caption" color={colors.warmGray}>
              {t('spin.won')}
            </Text>
            <Text variant="h1" center color={colors.gold}>
              {lang === 'ar' ? result.nameAr : result.nameEn}
            </Text>
            {result.type === 'credit' && result.creditValue ? (
              <Text variant="body" color={colors.green}>
                + {formatJOD(result.creditValue, lang)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  // Consistent screen padding + deliberate vertical rhythm.
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: { marginBottom: spacing.lg },
  // Wheel takes the centered middle space.
  wheelArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pointer: {
    position: 'absolute',
    top: -4,
    zIndex: 10,
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderTopWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.dark, // theme primaryDark — contrasts on green + gold
  },
  footer: { alignSelf: 'stretch', gap: spacing.lg, paddingTop: spacing.lg },
  info: { gap: spacing.xs, alignItems: 'center' },
  disabled: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  bigEmoji: { fontSize: 72 },
  resultWrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
});
