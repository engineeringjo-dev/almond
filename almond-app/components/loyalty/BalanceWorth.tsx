import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { jodFromPoints } from '@almond/shared/loyalty/earn';
import { balanceBuys } from '@almond/shared/loyalty/balanceBuys';

/**
 * Under a points balance on the black card: what it is worth, and what it buys
 * now in the menu's own terms — «تساوي 12.400 د.أ، وتكفي 3× ايس سبانيش
 * لاتيه» (loyalty/balanceBuys.ts). The rewards and loyalty screens showed the
 * number alone; Home already says what it is worth.
 */
export function BalanceWorth({ points }: { points: number }) {
  const { t, lang } = useI18n();
  const jod = formatJOD(jodFromPoints(points), lang);
  const buys = balanceBuys(points);
  return (
    <Text variant="bodyBold" color={colors.onHeroMuted} center>
      {buys
        ? t('rewards.balanceBuys', { jod, times: buys.times, name: lang === 'ar' ? buys.item.nameAr : buys.item.nameEn })
        : t('home.pointsWorth', { jod })}
    </Text>
  );
}
