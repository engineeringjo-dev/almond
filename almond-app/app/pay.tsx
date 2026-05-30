import { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as Brightness from 'expo-brightness';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';
import { config } from '@/constants/config';
import { useLoyaltyBalance, useRedeem } from '@/hooks/useLoyalty';
import { useUserId } from '@/stores/authStore';

/**
 * Pay & earn screen (Master Pack / Starbucks barcode pattern). The QR is the
 * hero: a personal code tied to the account, large, black-on-white for clean
 * high-contrast scanning. Secondary actions (redeem, history) sit below without
 * crowding the code. Screen brightness is maxed while open and restored on exit.
 *
 * TODO: link this code to the Odoo POS — the cashier scans it to attach the
 * loyalty account to the invoice (earn/redeem at the till). Encode whatever
 * identifier the POS expects; we currently encode a stable member token.
 */
export default function PayScreen() {
  const { t, lang } = useI18n();
  const userId = useUserId();
  const { width } = useWindowDimensions();
  const { data: balance } = useLoyaltyBalance();
  const redeem = useRedeem();

  // Personal member token encoded in the QR (TODO: replace with Odoo POS token).
  const qrValue = `ALMOND|MEMBER|${userId}`;
  const qrSize = Math.min(width - spacing.lg * 2 - spacing.xl * 2, 300);

  // Max out brightness while the code is shown; restore on exit.
  useEffect(() => {
    let previous: number | null = null;
    let active = true;
    if (Platform.OS !== 'web') {
      (async () => {
        try {
          previous = await Brightness.getBrightnessAsync();
          if (active) await Brightness.setBrightnessAsync(1);
        } catch {
          // brightness unavailable — ignore
        }
      })();
    }
    return () => {
      active = false;
      if (Platform.OS !== 'web' && previous != null) {
        Brightness.setBrightnessAsync(previous).catch(() => {});
      }
    };
  }, []);

  // "Ready to scan" pulse — a clear active signifier.
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
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  // Success feedback scaffold — set true when the POS confirms a scan.
  // TODO: flip via the Odoo POS / loyalty-server scan webhook.
  const [scanned] = useState(false);

  const points = balance?.points ?? 0;
  const redeemable = Math.floor(points / 100) * 100;
  const worth = (points / config.POINTS_PER_JOD_REDEEM).toFixed(3);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('pay.title') }} />
      <Screen contentStyle={styles.content}>
        <Text variant="body" color={colors.warmGray} center style={styles.instruction}>
          {t('pay.instruction')}
        </Text>

        {/* Hero: personal QR, black on white */}
        <Animated.View style={[styles.qrCard, { transform: [{ scale: pulseScale }] }]}>
          <QRCode value={qrValue} size={qrSize} color="#000000" backgroundColor="#FFFFFF" />
          {scanned ? (
            <View style={styles.successOverlay}>
              <View style={styles.successBadge}>
                <Icon name="navigation" size={40} color={colors.white} />
              </View>
            </View>
          ) : null}
        </Animated.View>

        <View style={styles.readyRow}>
          <View style={styles.readyDot} />
          <Text variant="caption" color={colors.primary}>
            {scanned ? t('pay.scanned') : t('pay.scanReady')}
          </Text>
        </View>

        <Text variant="caption" color={colors.warmGray} center style={styles.memberId}>
          {t('pay.memberId')}: {userId.slice(-8).toUpperCase()}
        </Text>

        {/* Points + redeem */}
        <View style={styles.pointsCard}>
          <Text variant="caption" color={colors.warmGray}>
            {t('pay.yourPoints')}
          </Text>
          <Text variant="display" color={colors.primary}>
            {formatNumber(points, lang)}
          </Text>
          <Text variant="caption" color={colors.warmGray}>
            {t('pay.worth', { jod: worth })}
          </Text>

          <Button
            title={`${t('pay.redeem')} · ${t('pay.redeemHint')}`}
            onPress={() => redeemable >= 100 && redeem.mutate(redeemable)}
            disabled={redeemable < 100}
            loading={redeem.isPending}
            style={styles.redeemBtn}
          />
        </View>

        {/* Secondary, uncluttered */}
        <Pressable style={styles.historyLink} onPress={() => router.push('/loyalty')} hitSlop={8}>
          <Icon name="history" size={18} color={colors.brown} />
          <Text variant="bodyBold" color={colors.brown}>
            {t('pay.history')}
          </Text>
        </Pressable>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingTop: spacing.md },
  instruction: { marginBottom: spacing.lg, maxWidth: 300 },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.raised,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,106,79,0.92)',
    borderRadius: radius.lg,
  },
  successBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  readyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  memberId: { marginTop: spacing.xs },
  pointsCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    ...shadow.card,
  },
  redeemBtn: { alignSelf: 'stretch', marginTop: spacing.md },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
});
