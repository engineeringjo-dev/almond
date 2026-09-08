import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as Brightness from 'expo-brightness';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber } from '@/lib/format';
import { posQrExpiresAt, posQrMsUntilExpiry, posQrStatus } from '@/lib/posQr';
import { useLoyaltyBalance, usePosToken, useScanStatus } from '@/hooks/useLoyalty';
import { tiers } from '@/services/seed';
import { tierName } from '@almond/shared/loyalty';
import type { PosMode } from '@almond/shared/pos/tokenWire';
import { useUserId } from '@/stores/authStore';

/**
 * Pay & earn barcode tab (Order Spec §1 — the raised center tab). The QR is the
 * hero: large, black-on-white for clean high-contrast scanning, with screen
 * brightness maxed while the tab is focused and restored on blur (§4.3).
 *
 * 🔴 THE CODE IS MINTED BY THE SERVER AND THIS SCREEN CANNOT BUILD ONE.
 *
 * It used to. The value handed to <QRCode> was a string this file assembled:
 * the member id — which is printed under the QR — plus the toggle's state.
 * That is a bearer credential rendered from public data: anyone who learned a
 * member id could render the same barcode, it never expired, and a photograph
 * of a member's screen kept earning on their account forever.
 *
 * Now the barcode is whatever `POST /v1/pos/token` returns: HMAC-signed with a
 * secret only the BFF holds, valid for config.POS_TOKEN_TTL_SECONDS (60s), and
 * burned by the till on first scan. Three consequences are visible in the code
 * below and each one is deliberate:
 *
 *   - it REFRESHES while you look at it (usePosToken, at half the lifetime the
 *     server reported), and stops the moment the tab loses focus;
 *   - there is NO fallback. If the code cannot be fetched, the QR comes down
 *     and the member gets something they can act on — a retry, and the account
 *     number the cashier can look them up by. Rendering a locally-built code
 *     instead would restore the exact hole this replaced;
 *   - the PAY/EARN mode is part of the REQUEST, not part of the barcode. The
 *     server signs it into the token and hands it to the till with the member
 *     id (`POST /v1/pos/scan` → `{memberId, mode}`), which is the only channel
 *     between this screen and the counter that cannot be tampered with.
 *
 * Still outstanding, on the till side: Odoo POS has to call `/v1/pos/scan` with
 * the shared POS key. Nothing in this repo can do that half.
 */
export default function PayScreen() {
  const { t, lang } = useI18n();
  const userId = useUserId();
  const { width } = useWindowDimensions();
  const { data: balance } = useLoyaltyBalance();

  // Scan & Pay (earn + pay) vs Scan only (earn without paying). The mode is
  // sent with the token request and signed into the token; it is not written
  // into the barcode by this screen, and switching it asks for a new code
  // (the mode is part of the query key) so the QR can never disagree with the
  // toggle sitting above it.
  const [mode, setMode] = useState<PosMode>('pay');
  const qrSize = Math.min(width - spacing.lg * 2 - spacing.xl * 2, 300);

  // Focus drives BOTH the brightness override and the token refresh. A member
  // who opens Pay and walks away must not keep minting a code a minute from
  // their pocket, so `focused` is the enable switch on the query below.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const { data: posToken, dataUpdatedAt, isFetching, isPending, refetch } = usePosToken({ mode, focused });
  // `expiresIn` is relative to the RESPONSE, so the clock starts at
  // dataUpdatedAt — not at render, which would extend a token's life on every
  // re-render and eventually show a dead code as live.
  const expiresAt = posToken ? posQrExpiresAt(posToken, dataUpdatedAt) : null;

  // One timer, fired at the exact instant the displayed code dies, rather than
  // a per-second countdown: the only thing that changes at expiry is which
  // panel is on screen. In the normal case the refresh has already swapped the
  // token underneath and this never fires with a stale code (see lib/posQr.ts).
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!focused || expiresAt === null) return;
    const timer = setTimeout(tick, posQrMsUntilExpiry(expiresAt, Date.now()) + 250);
    return () => clearTimeout(timer);
  }, [focused, expiresAt]);

  const qrStatus = posQrStatus({
    token: posToken?.token ?? null,
    expiresAt,
    now: Date.now(),
    fetching: isFetching,
    // `isPending` is react-query's "no data and no error yet" — which is
    // precisely "we have not been given an answer". It is TRUE on the first
    // render of every open of this tab, because `focused` starts false and
    // useFocusEffect only flips it in a passive effect, so the query is still
    // disabled. Without this the member was shown the offline panel ("give the
    // cashier your member ID") before the app had made one request.
    settled: !isPending,
  });

  // The earn rate the member is told IS the rung's name: 1 point = 1 qirsh
  // exactly (10,621 live redemptions), so "2%" and "2 points per JOD" are the
  // same fact in two units. This used to compute POINTS_PER_JOD × multiplier and
  // print "Earn 4 points per 1 JOD" next to a 4% badge; now there is one number
  // and it comes from the ramp, so it cannot drift from what is paid.
  // earn-arith-exempt: tier lookup for a display label — no invoice, no grant. §3.5 / §7 T7.
  const tierDef = tiers.find((x) => x.id === balance?.tier) ?? tiers[0];

  // Max out brightness while the tab is focused; restore on blur/exit (§4.3).
  useFocusEffect(
    useCallback(() => {
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
    }, []),
  );

  // "Ready to scan" pulse — a clear active signifier.
  const pulse = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }, [pulse]),
  );
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  // Success feedback — driven by the POS scan-status poll once Odoo is wired
  // (constants/integration.ts). Stays false under mock (poll disabled).
  const scanStatus = useScanStatus();
  const scanned = scanStatus.data?.scanned ?? false;

  const points = balance?.points ?? 0;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.titleRow}>
        <Logo variant="badge" tone="dark" size={26} />
        <Text variant="h1">{t('pay.title')}</Text>
      </View>
      <Text variant="body" color={colors.warmGray} center style={styles.instruction}>
        {t('pay.instruction')}
      </Text>

      {/* Scan & Pay vs Scan only */}
      <View style={styles.modeRow}>
        {(['pay', 'earn'] as const).map((m) => {
          const active = mode === m;
          return (
            <Pressable
              key={m}
              style={[styles.modeChip, active && styles.modeActive]}
              onPress={() => setMode(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text variant="bodyBold" color={active ? colors.white : colors.warmGray}>
                {m === 'pay' ? t('pay.scanAndPay') : t('pay.scanOnly')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Hero: the server-minted code, black on white. The `value` prop reads
          the fetched token and nothing else — there is no locally-assembled
          string to fall back to, in any state. */}
      {qrStatus === 'ready' && posToken ? (
        <Animated.View style={[styles.qrCard, { transform: [{ scale: pulseScale }] }]}>
          <QRCode value={posToken.token} size={qrSize} color="#000000" backgroundColor="#FFFFFF" />
          {scanned ? (
            <View style={styles.successOverlay}>
              <View style={styles.successBadge}>
                <Icon name="navigation" size={40} color={colors.white} />
              </View>
            </View>
          ) : null}
        </Animated.View>
      ) : (
        <View style={[styles.qrCard, styles.qrFallback, { width: qrSize, height: qrSize }]}>
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
              {/* The one action that can fix it, on the screen that failed. */}
              <Pressable style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button">
                <Text variant="bodyBold" color={colors.white}>
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
          {/* Says out loud that the square changes on its own. Without it, a
              member watching the QR redraw every 30 seconds has every reason to
              think the app is broken — and a member who has seen it change is
              also a member who will not screenshot it for later. */}
          <Text variant="caption" color={colors.warmGray} center style={styles.memberId}>
            {t('pay.codeRefreshes')}
          </Text>
        </>
      ) : null}

      {/* The account number, and now also the fallback: when there is no code,
          this is what the cashier looks the member up by. It is not a
          credential — since the barcode became a signed token, knowing a member
          id no longer lets anyone render a working one. */}
      <Text variant="caption" color={colors.warmGray} center style={styles.memberId}>
        {t('pay.memberId')}: {userId.slice(-8).toUpperCase()}
      </Text>
      <View style={styles.earnRate}>
        <Icon name="bean" size={14} color={colors.primary} strokeWidth={2} />
        <Text variant="caption" color={colors.primary}>
          {t('pay.earnRate', { rate: tierName(tierDef, lang) })}
        </Text>
      </View>

      {/* Beans balance — redemption happens in the Rewards screen (no cash) */}
      <Pressable style={styles.pointsCard} onPress={() => router.push('/(tabs)/rewards')}>
        <Text variant="caption" color={colors.warmGray}>
          {t('pay.yourPoints')}
        </Text>
        <Text variant="display" color={colors.primary}>
          {formatNumber(points, lang)} ☕
        </Text>
        <Text variant="caption" color={colors.brown}>
          {t('pay.seeRewards')}
        </Text>
      </Pressable>

      {/* Secondary, uncluttered */}
      <Pressable
        style={styles.historyLink}
        onPress={() => router.push('/(tabs)/rewards')}
        hitSlop={8}
      >
        <Icon name="history" size={18} color={colors.brown} />
        <Text variant="bodyBold" color={colors.brown}>
          {t('pay.history')}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingTop: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  instruction: { marginBottom: spacing.md, maxWidth: 300 },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.lg,
  },
  modeChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  modeActive: { backgroundColor: colors.primary },
  earnRate: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.raised,
  },
  qrFallback: {
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
    backgroundColor: 'rgba(46,37,82,0.92)',
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
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
});
