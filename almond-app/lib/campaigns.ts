/** Campaign presentation only. Eligibility and earning stay in @almond/shared. */
export const CAMPAIGN_DESTINATIONS = {
  showcase: '/campaigns',
  menu: '/(tabs)/order',
  catering: '/profile/help',
} as const;

export const COMBO_CAMPAIGN_EXAMPLES = [
  { id: 'cookie', photo: 'americanoCookie', titleKey: 'campaign.comboCookie' },
  { id: 'croissant', photo: 'americanoCroissant', titleKey: 'campaign.comboCroissant' },
  { id: 'egg-bagel', photo: 'americanoEggBagel', titleKey: 'campaign.comboEggBagel' },
  { id: 'cheese-bagel', photo: 'americanoCheeseBagel', titleKey: 'campaign.comboCheeseBagel' },
] as const;

export type ComboCampaignPhoto = typeof COMBO_CAMPAIGN_EXAMPLES[number]['photo'];

/** One dial, including the off state. Photos are examples, never order lines. */
export function comboCampaign(points: number) {
  if (!Number.isFinite(points) || points < 1) return null;
  return { points, examples: COMBO_CAMPAIGN_EXAMPLES };
}

/** The discovery page also owns unrelated member services. Retiring the
 *  combo must hide its promise, never Home's door to those services. */
export function homeCampaignEntry(points: number) {
  return comboCampaign(points)
    ? { kind: 'combo' as const, href: CAMPAIGN_DESTINATIONS.showcase }
    : { kind: 'offers' as const, href: CAMPAIGN_DESTINATIONS.showcase, labelKey: 'campaign.moreOffers' as const };
}

/** One readable photograph/badge per row on phones, including large text. */
export function campaignColumns(width: number, fontScale: number): 1 | 2 {
  return width >= 700 && fontScale <= 1.2 ? 2 : 1;
}
