import { Text } from '@/components/ui/Text';
import { colors, fontSize } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJODHeld } from '@/lib/format';
import { jodFromPoints } from '@almond/shared/loyalty/earn';

/**
 * The points' money value, with no purchasing example or product threshold.
 * Redemption remains the separate, real balance-to-voucher workflow.
 *
 * `tone="page"` for the points history's summary, which sits on the page's
 * resting fill: the black card's muted caption colour is near-invisible there.
 */
export function BalanceWorth({ points, tone = 'hero' }: { points: number; tone?: 'hero' | 'page' }) {
  const { t, lang } = useI18n();
  const jod = formatJODHeld(jodFromPoints(points), lang);
  return (
    <Text
      variant="bodyBold"
      color={tone === 'hero' ? colors.onHeroReward : colors.warmGray}
      center
      style={tone === 'hero' ? { fontSize: fontSize.sm, lineHeight: 20 } : undefined}
    >
      {t('home.pointsWorth', { jod })}
    </Text>
  );
}
