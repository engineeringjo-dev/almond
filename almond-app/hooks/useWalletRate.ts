import { tierName, walletRateName } from '@almond/shared/loyalty';

import { useI18n } from '@/hooks/useI18n';
import { useLoyaltyBalance } from '@/hooks/useLoyalty';
import { tiers } from '@/services/seed';

/**
 * The member's cashback on a bill paid FROM THE BALANCE, beside what the same
 * rung pays otherwise — «٣٪» and «٢٪» on the entry rung. These are the
 * `{{rate}}` / `{{base}}` params of every wallet line that states the bonus
 * (home.walletHint, profile.walletEarnNote).
 *
 * Owner, 2026-10-15: «لا يوجد بونص شحن، البونص للانفاق فقط» — the wallet's
 * reward is for spending it, so this is what the wallet screens say instead of
 * the deleted reload bonus. Both numbers come off the rung and the dials
 * (walletRateName in @almond/shared), never out of a locale file.
 */
export function useWalletRate(): { rate: string; base: string } {
  const { lang } = useI18n();
  const { data } = useLoyaltyBalance();
  const tier = tiers.find((x) => x.id === data?.tier) ?? tiers[0];
  return { rate: walletRateName(tier, lang), base: tierName(tier, lang) };
}
