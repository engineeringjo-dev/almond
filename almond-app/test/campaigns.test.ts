import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInstance } from 'i18next';

import { CAMPAIGN_DESTINATIONS, campaignColumns, comboCampaign, homeCampaignEntry } from '@/lib/campaigns';
import { config } from '@/constants/config';

const APP = join(__dirname, '..');
const code = (rel: string) => readFileSync(join(APP, rel), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const locale = (lang: 'ar' | 'en') =>
  JSON.parse(readFileSync(join(APP, 'locales', `${lang}.json`), 'utf8')) as Record<string, Record<string, string>>;

describe('Campaigns show the current points offer, without a poster price', () => {
  it('both languages show the exact owner-approved two-line badge for any active dial', async () => {
    for (const lang of ['ar', 'en'] as const) {
      const resources = locale(lang);
      expect(resources.campaign.comboBadge).toBe('Cash back\n{{points}} points');
      const i18n = createInstance();
      await i18n.init({ lng: lang, resources: { [lang]: { translation: resources } } });
      for (const points of [25, 50, 137]) {
        const campaign = comboCampaign(points)!;
        expect(i18n.t('campaign.comboBadge', { points: campaign.points })).toBe(`Cash back\n${points} points`);
      }
      expect(i18n.t('campaign.comboBadge', { points: comboCampaign(config.COMBO_BONUS_POINTS)!.points }))
        .toBe(`Cash back\n${config.COMBO_BONUS_POINTS} points`);
    }
  });

  it('does not advertise an inactive or invalid reward', () => {
    for (const points of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(comboCampaign(points)).toBeNull();
    }
    expect(code('components/home/CampaignPhoto.tsx')).toMatch(/if \(!campaign\) return null/);
    expect(code('app/campaigns.tsx')).toMatch(/campaign && copy/);
  });

  it('retiring the combo keeps Home access to the five other member offers', () => {
    for (const points of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const entry = homeCampaignEntry(points);
      expect(entry).toEqual({ kind: 'offers', href: '/campaigns', labelKey: 'campaign.moreOffers' });
      expect(comboCampaign(points)).toBeNull();
    }
    for (const points of [25, 50, 137]) {
      expect(homeCampaignEntry(points)).toEqual({ kind: 'combo', href: '/campaigns' });
    }
    const homeEntry = code('components/home/PromoCarousel.tsx');
    expect(homeEntry).toContain('homeCampaignEntry(config.COMBO_BONUS_POINTS)');
    expect(homeEntry).toContain('title={t(entry.labelKey)}');
    expect(homeEntry).toContain('router.push(entry.href)');
    expect(code('app/campaigns.tsx')).toContain('<MemberOffers');
  });

  it('states eligibility, replacement points, once per invoice and no cash credit visibly', () => {
    const page = code('app/campaigns.tsx');
    for (const key of ['comboSummary', 'exampleNote', 'pointsNote']) {
      expect(page).toContain(`t('campaign.${key}'`);
    }
    expect(page).toContain('t(copy.bodyKey, copy.params)');
    expect(page).not.toContain('t(copy.titleKey');
    expect(code('components/home/ComboOfferCard.tsx')).toContain("t('campaign.comboEligibility')");
    const en = locale('en');
    expect(en.campaign.comboSummary).toContain('instead of');
    expect(en.campaign.exampleNote).toContain('eligible menu items');
    expect(en.campaign.pointsNote).toContain('Once per invoice');
    expect(en.campaign.pointsNote).toContain('not cash or wallet credit');
    const ar = locale('ar');
    expect(ar.campaign.comboSummary).toContain('بدل');
    expect(ar.campaign.exampleNote).toContain('الأصناف المؤهلة');
    expect(ar.campaign.pointsNote).toContain('مرة واحدة لكل فاتورة');
    expect(ar.campaign.pointsNote).toContain('ليست مبلغاً نقدياً أو رصيد محفظة');
    for (const lang of ['ar', 'en'] as const) {
      const copy = locale(lang).campaign;
      expect(copy.comboSummary).toContain('{{points}}');
      expect(Object.values(copy).join('\n')).not.toMatch(/\d|\bJOD\b|\bJD\b|د\.أ|دينار/i);
    }
  });
});

describe('Campaign photography is a serving suggestion, never a hidden basket', () => {
  it('has all four clean examples and no product IDs or prices to accidentally add', () => {
    const examples = comboCampaign(25)!.examples;
    expect(examples.map((e) => e.id)).toEqual(['cookie', 'croissant', 'egg-bagel', 'cheese-bagel']);
    for (const example of examples) {
      expect(Object.keys(example).sort()).toEqual(['id', 'photo', 'titleKey']);
    }
    for (const path of ['components/home/ComboOfferCard.tsx', 'app/campaigns.tsx', 'components/home/CafeDiscovery.tsx', 'components/home/CateringEntry.tsx']) {
      expect(code(path), path).not.toMatch(/useCartStore|addItem\(|\/cart['"]|formatJOD|\.price\b/);
    }
  });

  it('hands off to existing menu and contact journeys, without a pretend catering checkout', () => {
    expect(CAMPAIGN_DESTINATIONS).toEqual({ showcase: '/campaigns', menu: '/(tabs)/order', catering: '/profile/help' });
    expect(code('components/home/ComboOfferCard.tsx')).toContain('router.push(CAMPAIGN_DESTINATIONS.showcase)');
    expect(code('app/campaigns.tsx')).toContain('router.push(CAMPAIGN_DESTINATIONS.menu)');
    expect(code('components/home/CafeDiscovery.tsx')).toContain('router.push(CAMPAIGN_DESTINATIONS.menu)');
    expect(code('components/home/CateringEntry.tsx')).toContain('router.push(CAMPAIGN_DESTINATIONS.catering)');
    expect(code('app/_layout.tsx')).toContain('<Stack.Screen name="campaigns"');
    expect(code('app/campaigns.tsx')).toContain('<MemberOffers');
    const offers = code('components/home/MemberOffers.tsx');
    expect(offers).toContain('buildHomeSlides(');
    expect(offers).toContain('router.push(slide.action.href)');
    expect(offers).toContain('setSelected(item)');
    expect(offers).toContain('<ItemModal');
  });

  it('bundles real photos and displays every product whole; phones get one readable badge per row', () => {
    const manifestPath = join(APP, 'components/home/campaignPhotos.ts');
    const manifest = readFileSync(manifestPath, 'utf8');
    const photos = [...manifest.matchAll(/require\('([^']+)'\)/g)];
    expect(photos).toHaveLength(7);
    for (const [, relative] of photos) expect(existsSync(resolve(dirname(manifestPath), relative)), relative).toBe(true);
    expect(code('components/home/CampaignPhoto.tsx')).toContain('resizeMode="contain"');
    expect(code('components/home/CampaignPhoto.tsx')).not.toMatch(/scale\s*:/);
    for (const width of [320, 390, 412]) {
      expect(campaignColumns(width, 1)).toBe(1);
      expect(campaignColumns(width, 2)).toBe(1);
    }
    expect(campaignColumns(1363, 1)).toBe(2);
    expect(campaignColumns(1363, 1.6)).toBe(1);
  });
});

describe('The branded cup stays inside the existing primary Order action', () => {
  it('uses the whole alpha artwork at the same height, while a real basket still opens its review', () => {
    const order = code('components/home/OrderNowButton.tsx');
    expect(order).toContain('artwork={campaignPhotos.cup}');
    expect(order).toContain('plate={72}');
    expect(order).toContain('onPress={() => setOpen(true)}');
    expect(order).toContain('<OrderTypeSheet');
    expect(order).toContain("router.push('/cart')");
    expect(order).toContain('photos={[lead?.imageUrl]}');
    const tile = code('components/home/PhotoTile.tsx');
    expect(tile).toContain('<Image source={artwork} style={styles.artwork} resizeMode="contain"');
    expect(tile).toContain("artworkPlate: { borderRadius: 0, overflow: 'visible'");
  });
});
