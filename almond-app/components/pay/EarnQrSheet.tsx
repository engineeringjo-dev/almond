import { StyleSheet, Pressable, useWindowDimensions } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { EarnQr } from '@/components/pay/EarnQr';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useMaxBrightness } from '@/hooks/useMaxBrightness';
import { useAppStore } from '@/stores/appStore';
import { useEarnSheetStore } from '@/stores/earnSheetStore';

/**
 * «اجمع نقاطك» — the member's till code in a sheet over whatever screen is
 * open. Opened by itself on launch (lib/earnSheet.ts decides) and by the QR
 * button in Home's header; mounted ONCE, in app/_layout.tsx.
 *
 * Owner, 2026-10-15, after Al Ameed's app, which opens "Scan to collect points"
 * on launch and from its header. The code is EarnQr — the same component, the
 * same signed 60-second token and the same rules as the barcode tab — so there
 * is no second way to draw a code. While open it maxes the brightness, like
 * the tab, and it stops refreshing the token the moment it closes.
 */
export function EarnQrSheet() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const visible = useEarnSheetStore((s) => s.visible);
  const auto = useEarnSheetStore((s) => s.auto);
  const close = useEarnSheetStore((s) => s.close);
  const setAutoEarnQr = useAppStore((s) => s.setAutoEarnQr);
  useMaxBrightness(visible);

  const size = Math.min(width - spacing.lg * 4 - spacing.xl * 2, 260);

  return (
    <BottomSheet visible={visible} onClose={close} title={t('earnSheet.title')}>
      <Text variant="body" color={colors.warmGray} center style={styles.body}>
        {t('earnSheet.body')}
      </Text>
      {visible ? <EarnQr active={visible} size={size} /> : null}
      {/* Offered only when the sheet opened by itself: the member who did not
          ask for it is the one who may not want it next time. The same switch
          is in Notifications › settings. */}
      {auto ? (
        <Pressable
          onPress={() => {
            setAutoEarnQr(false);
            close();
          }}
          style={styles.optOut}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text variant="caption" color={colors.brown} center>
            {t('earnSheet.dontAutoOpen')}
          </Text>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { marginBottom: spacing.lg },
  optOut: { marginTop: spacing.lg, paddingVertical: spacing.sm },
});
