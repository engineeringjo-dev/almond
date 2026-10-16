import { physicalSlide } from './campaignSlides';

export const CAMPAIGN_PEEK = 20;
export const CAMPAIGN_GAP = 8;

/** Centre a real card, leaving a gap and 20px of its neighbours on both sides. */
export function campaignGeometry(viewport: number) {
  const inset = CAMPAIGN_PEEK + CAMPAIGN_GAP;
  const card = Math.max(1, viewport - 2 * inset);
  return { card, inset, step: card + CAMPAIGN_GAP };
}

export function wrapCampaign(index: number, count: number): number {
  return count > 0 ? ((index % count) + count) % count : 0;
}

/** The two end copies are visual only. Original positions are always 1..N. */
export function campaignPages(count: number, rtl: boolean) {
  if (count < 1) return [];
  return Array.from({ length: count + 2 }, (_, slot) => ({
    slot,
    logical: physicalSlide(wrapCampaign(slot - 1, count), count, rtl),
    clone: slot === 0 || slot === count + 1,
  }));
}

export function campaignOffset(index: number, step: number, count: number, rtl: boolean): number {
  return (physicalSlide(index, count, rtl) + 1) * step;
}

export function settledCampaign(offset: number, step: number, count: number, rtl: boolean) {
  const slot = step > 0 ? Math.max(0, Math.min(count + 1, Math.round(offset / step))) : 1;
  const logical = physicalSlide(wrapCampaign(slot - 1, count), count, rtl);
  return { logical, offset: campaignOffset(logical, step, count, rtl), clone: slot === 0 || slot === count + 1 };
}

/** One sample per genuine focus entry. Repeated focused effects (including
 * StrictMode setup) never sample again; blur arms the next visit. */
export function createCampaignVisitPicker(random: () => number = () => Math.random()) {
  let entered = false;
  return (focused: boolean, count: number): number | undefined => {
    if (!focused) { entered = false; return undefined; }
    if (entered || count < 1) return undefined;
    entered = true;
    const sample = random();
    return Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, Number.isFinite(sample) ? sample : 0)) * count);
  };
}
