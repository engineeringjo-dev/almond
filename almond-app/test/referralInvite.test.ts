import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Linking, Platform } from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import { createInstance } from 'i18next';

import { copyReferralLink, openReferralWhatsApp, referralRewardState, referralWhatsAppUrl } from '@/lib/referralInvite';
import { I18N_OPTIONS } from '@/lib/i18nOptions';

vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));

const originalOS = Platform.OS;
const copyNative = vi.mocked(setStringAsync);
const exactLink = 'https://almondcoffeehouse.com/app?ref=ABC234&source=friend#invite';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => {
  (Platform as { OS: string }).OS = originalOS;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RI1 WhatsApp carries the exact localized message, code and server link', () => {
  for (const lang of ['ar', 'en']) {
    it(`${lang}: encodes text as one WhatsApp draft with no recipient or other channel`, async () => {
      const i18n = createInstance();
      await i18n.init({ ...I18N_OPTIONS, lng: lang });
      const message = i18n.t('referral.shareMessage', { code: 'ABC234', link: exactLink });
      const destination = new URL(referralWhatsAppUrl(message));
      expect(destination.origin).toBe('https://wa.me');
      expect(destination.pathname).toBe('/');
      expect([...destination.searchParams.keys()]).toEqual(['text']);
      expect(destination.searchParams.get('text')).toBe(message);
      expect(destination.searchParams.get('text')).toContain(exactLink);
      expect(destination.searchParams.get('text')).toContain('ABC234');

      const open = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await openReferralWhatsApp(message);
      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith(destination.toString());
    });
  }

  it('propagates a failed launch for visible recovery, without sending a message', async () => {
    vi.spyOn(Linking, 'openURL').mockRejectedValue(new Error('app unavailable'));
    await expect(openReferralWhatsApp('draft')).rejects.toThrow('app unavailable');
  });
});

describe('RI2 Copy link reports the actual clipboard result', () => {
  beforeEach(() => { (Platform as { OS: string }).OS = 'web'; });

  it('writes only the exact server link to the browser clipboard', async () => {
    await copyReferralLink(exactLink);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(exactLink);
    expect(copyNative).not.toHaveBeenCalled();
  });

  it('rejects a denied browser write rather than falling back to a misleading legacy success', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('denied'));
    await expect(copyReferralLink(exactLink)).rejects.toThrow('denied');
    expect(copyNative).not.toHaveBeenCalled();
  });

  it('rejects an unavailable browser clipboard so the selectable link remains the recovery', async () => {
    vi.stubGlobal('navigator', {});
    await expect(copyReferralLink(exactLink)).rejects.toThrow('referral_clipboard_unavailable');
  });

  for (const os of ['ios', 'android']) {
    it(`${os}: uses Expo's native clipboard and rejects false or thrown failures`, async () => {
      (Platform as { OS: string }).OS = os;
      copyNative.mockResolvedValueOnce(true);
      await expect(copyReferralLink(exactLink)).resolves.toBeUndefined();
      expect(copyNative).toHaveBeenLastCalledWith(exactLink);
      copyNative.mockResolvedValueOnce(false);
      await expect(copyReferralLink(exactLink)).rejects.toThrow('referral_link_not_copied');
      copyNative.mockRejectedValueOnce(new Error('native failure'));
      await expect(copyReferralLink(exactLink)).rejects.toThrow('native failure');
    });
  }
});

describe('RI3 both invitation entry points expose the explicit choices', () => {
  const code = (file: string) => readFileSync(join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  it('Home opens the invitation page and neither entry point invokes generic sharing', () => {
    const banner = code('components/home/ChallengeBanner.tsx');
    expect(banner).toContain("router.push('/referral')");
    expect(banner).toContain("router.push('/profile/details')");
    const page = code('app/referral.tsx');
    for (const source of [banner, page]) expect(source).not.toMatch(/\bShare\b|navigator\.share|mailto:|sms:/);
    expect(page).toContain("title={t('referral.whatsapp')}");
    expect(page).toContain("title={t('referral.copyLink')}");
    expect(page).toContain('copyReferralLink(data.link)');
    expect(page).toContain('formatNumber(data.capPoints, lang)');
    expect(page).toContain('formatNumber(data.remainingPoints, lang)');
    for (const source of [banner, page]) expect(source).toContain('referralRewardState(');
  });
});

describe('RI4 reward copy follows the server, including capped or unverified accounts', () => {
  it('offers reward wording only with current eligibility and a positive remaining allowance', () => {
    expect(referralRewardState({ eligibleForRewards: true, remainingPoints: 500 })).toBe('eligible');
    expect(referralRewardState({ eligibleForRewards: false, remainingPoints: 500 })).toBe('ineligible');
    expect(referralRewardState({ eligibleForRewards: true, remainingPoints: 0 })).toBe('limit-reached');
    expect(referralRewardState({ eligibleForRewards: false, remainingPoints: 0 })).toBe('limit-reached');
  });

  it('bounds the nominal reward when the final grant can be smaller than that reward', async () => {
    // The shared engine may pay the final 10 points of a nominal 50 reward.
    // Eligibility still holds; the UI must state a ceiling, not promise 50.
    expect(referralRewardState({ eligibleForRewards: true, remainingPoints: 10 })).toBe('eligible');
    for (const lang of ['ar', 'en']) {
      const i18n = createInstance();
      await i18n.init({ ...I18N_OPTIONS, lng: lang });
      for (const key of ['referral.headline', 'referral.rewardRule', 'challenge.referral', 'profile.referralReward']) {
        expect(i18n.t(key, { points: 50 }), `${lang}: ${key}`)
          .toMatch(lang === 'ar' ? /لغاية 50/ : /\bup to 50\b/i);
      }
    }
  });

  it('says what happened after copying in the owner’s Arabic voice', async () => {
    const i18n = createInstance();
    await i18n.init({ ...I18N_OPTIONS, lng: 'ar' });
    expect(i18n.t('referral.linkCopied')).toBe('نسخنا رابط الدعوة');
  });
});
