import { useEffect, useReducer, useRef } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { posQrExpiresAt, posQrMsUntilExpiry, posQrStatus } from '@/lib/posQr';
import { usePosToken, useScanStatus } from '@/hooks/useLoyalty';

/**
 * THE MEMBER'S TILL CODE — one component, two places: the barcode tab and the
 * «اجمع نقاطك» sheet that opens on launch and from Home's header (owner,
 * 2026-10-15, after Al Ameed). Both must show the SAME code with the same
 * rules, so the rules live here and nowhere else.
 *
 * 🔴 THE CODE IS MINTED BY THE SERVER AND THIS COMPONENT CANNOT BUILD ONE.
 * It is whatever `POST /v1/pos/token` returns: HMAC-signed, valid for
 * config.POS_TOKEN_TTL_SECONDS (60s), burned by the till on first scan. So:
 *
 *   - it REFRESHES while `active` (usePosToken, at half the lifetime the server
 *     reported) and stops the moment it is not — a member who walks away must
 *     not keep minting a code from their pocket;
 *   - there is NO fallback. If the code cannot be fetched, the QR comes down
 *     and the member gets a retry; rendering a locally-built code instead would
 *     restore the hole the signed token replaced;
 *   - there is ONE code for earning and spending (owner, 2026-09-24).
 *
 * See the barcode tab (app/(tabs)/pay.tsx) for the history of each rule.
 */
export function EarnQr({ active, size }: { active: boolean; size: number }) {
  const { t } = useI18n();

  const { data: posToken, dataUpdatedAt, isFetching, isPending, refetch } = usePosToken({ focused: active });
  // `expiresIn` is relative to the RESPONSE, so the clock starts at
  // dataUpdatedAt — not at render, which would extend a token's life on every
  // re-render and eventually show a dead code as live.
  const expiresAt = posToken ? posQrExpiresAt(posToken, dataUpdatedAt) : null;

  // One timer, fired at the instant the displayed code dies.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!active || expiresAt === null) return;
    const timer = setTimeout(tick, posQrMsUntilExpiry(expiresAt, Date.now()) + 250);
    return () => clearTimeout(timer);
  }, [active, expiresAt]);

  const qrStatus = posQrStatus({
    token: posToken?.token ?? null,
    expiresAt,
    now: Date.now(),
    fetching: isFetching,
    // react-query's "no answer yet" — true on the first render of every open,
    // before the query is enabled. Without it the offline panel flashes first.
    settled: !isPending,
  });

  // "Ready to scan" pulse — a clear active signifier; still under Reduce Motion.
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || reduced) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse, reduced]);
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  // Success feedback — driven by the POS scan-status poll once Odoo is wired
  // (constants/integration.ts). Stays false under mock (poll disabled).
  const scanStatus = useScanStatus();
  const scanned = scanStatus.data?.scanned ?? false;

  return (
    <View style={styles.wrap}>
      {qrStatus === 'ready' && posToken ? (
        <Animated.View style={[styles.qrCard, { transform: [{ scale: pulseScale }] }]}>
          <QRCode value={posToken.token} size={size} color="#000000" backgroundColor="#FFFFFF" />
          {scanned ? (
            <View style={styles.successOverlay}>
              <View style={styles.successBadge}>
                <Icon name="navigation" size={40} color={colors.onInk} />
              </View>
            </View>
          ) : null}
        </Animated.View>
      ) : (
        <View style={[styles.qrCard, styles.qrFallback, { width: size + spacing.xl * 2, minHeight: size + spacing.xl * 2 }]}>
          {qrStatus === 'pending' ? (
            <Text variant="body" color={colors.warmGray} center>
              {t('pay.codeLoading')}
            </Text>
          ) : (
            <>
              <Icon
                name={qrStatus === 'expired' ? 'reorder' : 'alert'}
                size={28}
                color={colors.brown}
                strokeWidth={2}
              />
              <Text variant="bodyBold" center>
                {qrStatus === 'expired' ? t('pay.codeExpiredTitle') : t('pay.codeUnavailableTitle')}
              </Text>
              <Text variant="caption" color={colors.warmGray} center>
                {qrStatus === 'expired' ? t('pay.codeExpiredBody') : t('pay.codeUnavailableBody')}
              </Text>
              {/* The one action that can fix it, where it failed. */}
              <Pressable style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button">
                <Text variant="bodyBold" color={colors.onInk}>
                  {t('pay.codeRetry')}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {qrStatus === 'ready' ? (
        <>
          <View style={styles.readyRow}>
            <View style={styles.readyDot} />
            <Text variant="caption" color={colors.primary}>
              {scanned ? t('pay.scanned') : t('pay.scanReady')}
            </Text>
          </View>
          {/* Says out loud that the square changes on its own, so a member who
              watches it redraw does not think the app is broken. */}
          <Text variant="caption" color={colors.warmGray} center style={styles.refreshes}>
            {t('pay.codeRefreshes')}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  // The code itself is printed dark on WHITE in both schemes — a scanner wants
  // a dark code on a light ground, and a dark-mode QR is a code some tills
  // cannot read. The message that stands in for it sits on the scheme's card.
  qrCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    padding: spacing.xl,
  },
  qrFallback: {
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,17,17,0.92)',
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
  refreshes: { marginTop: spacing.xs },
});
