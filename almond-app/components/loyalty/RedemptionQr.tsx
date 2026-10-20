import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useInvalidateLoyalty } from '@/hooks/useLoyalty';
import { useUserId } from '@/stores/authStore';
import { loyaltyService } from '@/services/loyalty.service';
import { createRedemptionQr } from '@/lib/redemptionQr';
import { newIdempotencyKey } from '@/lib/apiClient';

/** A points-discount QR, not the membership QR and never a Voucher id. */
export function RedemptionQr({ redemptionId }: { redemptionId: string }) {
  const { t } = useI18n();
  const userId = useUserId();
  const focused = useIsFocused();
  const { width } = useWindowDimensions();
  const presenter = useMemo(() => createRedemptionQr(loyaltyService, userId, redemptionId), [userId, redemptionId]);
  const state = useSyncExternalStore(presenter.subscribe, presenter.getSnapshot, presenter.getSnapshot);
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const cancelKey = useRef<string | null>(null);
  const invalidate = useInvalidateLoyalty();
  const invalidateRef = useRef(invalidate);
  invalidateRef.current = invalidate;
  const closedId = useRef<string | null>(null);
  const size = Math.max(120, Math.min(288, width - spacing.md * 4));
  // DENSO requires four clear modules per side. Version1 is the smallest
  // possible QR (21 modules); this conservative margin covers every version.
  // The installed SVG library includes quietZone INSIDE its fixed-size viewBox.
  const quietZone = size * 4 / 21;

  useEffect(() => {
    if (focused) void presenter.refresh();
    return () => presenter.pause();
  }, [focused, presenter]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      setActive(next === 'active');
      if (next !== 'active') presenter.pause();
      else presenter.tick();
    });
    return () => subscription.remove();
  }, [presenter]);
  useEffect(() => {
    if (!focused || !active || state.status !== 'ready') return;
    const timer = setInterval(presenter.tick, 1000);
    const expiry = setTimeout(presenter.tick, Math.max(0, (state.deadline ?? 0) - Date.now()));
    const status = setInterval(() => { void presenter.poll(); }, 5000);
    return () => { clearInterval(timer); clearTimeout(expiry); clearInterval(status); };
  }, [focused, active, presenter, state.status, state.deadline]);
  useEffect(() => {
    // Poll/refresh may close an expired reserve and return its original lots.
    // Refresh balances once per closure, not once per query-driven rerender.
    if (state.status !== 'closed' || closedId.current === redemptionId) return;
    closedId.current = redemptionId;
    invalidateRef.current();
  }, [state.status, redemptionId]);

  const ready = focused && active && state.status === 'ready' && state.presentation;
  const pending = state.status === 'idle' || state.status === 'pending';
  return (
    <View style={styles.wrap} testID="redemption-barcode">
      {ready ? (
        <>
          <Text variant="bodyBold" center>{t('loyalty.redemptionShowAtTill')}</Text>
          <View style={styles.qr} accessible accessibilityRole="image" accessibilityLabel={t('loyalty.redemptionBarcodeLabel')}>
            {/* Scanner contrast is fixed black/white in both schemes. */}
            <QRCode value={ready.token} size={size} quietZone={quietZone} color="#000000" backgroundColor="#FFFFFF" />
          </View>
          <Text variant="bodyBold" center>{t('loyalty.redemptionCountdown', { count: state.remaining, seconds: state.remaining })}</Text>
          {ready.demo ? <Text variant="caption" center selectable>{t('loyalty.redemptionDemo')}</Text> : null}
        </>
      ) : state.status === 'closed' ? (
        <Text variant="body" accessibilityRole="alert" center selectable>{t(state.reservation?.status === 'settled' ? 'loyalty.redemptionUsed' : 'loyalty.redemptionEnded')}</Text>
      ) : (
        <>
          <Text variant="bodyBold" accessibilityRole={pending ? undefined : 'alert'} center>
            {t(pending ? 'loyalty.redemptionLoading' : state.status === 'expired' ? 'loyalty.redemptionExpired' : 'loyalty.redemptionUnavailable')}
          </Text>
          {!pending ? <Button title={t('loyalty.redemptionRefresh')} onPress={() => { void presenter.refresh(); }} disabled={!focused || !active} /> : null}
        </>
      )}
      {state.status !== 'closed' ? (
        <>
          <Text variant="caption" center selectable>{t('loyalty.redemptionReservationNote')}</Text>
          <Button title={t('loyalty.redemptionCancel')} variant="ghost" disabled={pending} onPress={() => {
            cancelKey.current ??= newIdempotencyKey();
            void presenter.cancel(cancelKey.current).then(invalidate);
          }} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'stretch', gap: spacing.md, marginTop: spacing.md },
  qr: { alignSelf: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderCurve: 'continuous' },
});
