import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { EarnQr } from '@/components/pay/EarnQr';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useMaxBrightness } from '@/hooks/useMaxBrightness';
import { formatNumber } from '@/lib/format';
import { useLoyaltyBalance } from '@/hooks/useLoyalty';
import { tiers } from '@/services/seed';
import { tierName } from '@almond/shared/loyalty';
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
 *   - there is ONE code, for earning AND spending (owner, 2026-09-24: «كسب
 *     وصرف النقاط بدي يكون باركود مباشر نفسه»). The pay/earn toggle that used
 *     to sit above the QR is gone: the code is minted with `{}` and the till's
 *     single scan (`POST /v1/pos/scan`) hands back both an earn ticket and a
 *     spend ticket — the member says at the counter whether to use points.
 *
 * Still outstanding, on the till side: Odoo POS has to call `/v1/pos/scan` with
 * the shared POS key. Nothing in this repo can do that half.
 *
 * The code itself — token, refresh, expiry, retry, the success overlay — moved
 * to components/pay/EarnQr.tsx on 2026-10-15, when the same code started to
 * open on launch and from Home's header too (components/pay/EarnQrSheet.tsx).
 */
export default function PayScreen() {
  const { t, lang } = useI18n();
  const userId = useUserId();
  const { width } = useWindowDimensions();
  const { data: balance } = useLoyaltyBalance();

  const qrSize = Math.min(width - spacing.lg * 2 - spacing.xl * 2, 300);

  // Focus drives BOTH the brightness override and the token refresh. A member
  // who opens Pay and walks away must not keep minting a code a minute from
  // their pocket, so `focused` is what EarnQr refreshes on.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useMaxBrightness(focused);

  // The earn rate the member is told IS the rung's name: 1 point = 1 qirsh
  // exactly (10,621 live redemptions), so "2%" and "2 points per JOD" are the
  // same fact in two units.
  // earn-arith-exempt: tier lookup for a display label — no invoice, no grant. §3.5 / §7 T7.
  const tierDef = tiers.find((x) => x.id === balance?.tier) ?? tiers[0];

  const points = balance?.points ?? 0;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text variant="h1">{t('pay.title')}</Text>
      </View>
      <Text variant="body" color={colors.warmGray} center style={styles.instruction}>
        {t('pay.instruction')}
      </Text>

      <EarnQr active={focused} size={qrSize} />

      {/* The account number, and also the fallback: when there is no code, this
          is what the cashier looks the member up by. It is not a credential —
          knowing a member id no longer lets anyone render a working code. */}
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
          {formatNumber(points, lang)}
        </Text>
        <Text variant="caption" color={colors.brown}>
          {t('pay.seeRewards')}
        </Text>
      </Pressable>
      {/* No «سجل النقاط» link under the card any more: it opened the Rewards
          tab, not the history, and sat under the tab bar (730–784 pt). The
          history is a tile on the Rewards tab, which this card opens. */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingTop: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  instruction: { marginBottom: spacing.lg, maxWidth: 300 },
  earnRate: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
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
});
