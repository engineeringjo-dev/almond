import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createProfileBonusFeedback, type ProfileBonusReply } from '@/lib/profileBonusFeedback';

const reply = (points: number): ProfileBonusReply => ({
  bonusGranted: points, bonusAvailablePoints: points, bonusRecoveredPoints: 0,
});

describe('PB1 the successful reply, not eligibility or balance, chooses the reward moment', () => {
  it('shows the fixed 50-point artwork only for 50 newly available points', () => {
    const feedback = createProfileBonusFeedback();
    expect(feedback(reply(50))).toEqual({ kind: 'celebrate', points: 50 });
  });

  it.each([1, 25, 49, 51, 137])('keeps a %s-point grant as its actual native amount', (points) => {
    const feedback = createProfileBonusFeedback();
    expect(feedback(reply(points))).toEqual({ kind: 'bonus', points });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0.5])(
    'keeps zero, negative and invalid grants on the ordinary saved path (%s)',
    (bonusGranted) => {
      const feedback = createProfileBonusFeedback();
      expect(feedback(reply(bonusGranted))).toEqual({ kind: 'saved' });
    },
  );

  it('reports a gross 50-point bonus that repays 40 as 10 available and 40 recovered, never a 50 celebration', () => {
    const feedback = createProfileBonusFeedback();
    const response = { bonusGranted: 50, bonusAvailablePoints: 10, bonusRecoveredPoints: 40 };
    expect(feedback(response)).toEqual({ kind: 'recovered', points: 10, recovered: 40 });
    expect(feedback(response)).toBeNull();
    // Re-saving an already completed profile has no new credit or recovery.
    expect(feedback(reply(0))).toEqual({ kind: 'saved' });
  });

  it('explains full recovery without claiming points became available', () => {
    const feedback = createProfileBonusFeedback();
    expect(feedback({ bonusGranted: 50, bonusAvailablePoints: 0, bonusRecoveredPoints: 50 }))
      .toEqual({ kind: 'recovered', points: 0, recovered: 50 });
  });

  it('keeps recovery visible even if a future larger bonus leaves exactly 50 available', () => {
    const feedback = createProfileBonusFeedback();
    expect(feedback({ bonusGranted: 90, bonusAvailablePoints: 50, bonusRecoveredPoints: 40 }))
      .toEqual({ kind: 'recovered', points: 50, recovered: 40 });
  });

  it('never reconstructs a missing net amount from a gross bonus or infers recovery', () => {
    const feedback = createProfileBonusFeedback();
    expect(feedback({ bonusGranted: 50 } as ProfileBonusReply)).toEqual({ kind: 'saved' });
    expect(feedback({ bonusGranted: 50, bonusAvailablePoints: 10 } as ProfileBonusReply)).toEqual({ kind: 'saved' });
    expect(feedback({ bonusGranted: 50, bonusAvailablePoints: 0, bonusRecoveredPoints: 0 }))
      .toEqual({ kind: 'saved' });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0.5])(
    'does not announce an invalid recovered amount (%s)', (bonusRecoveredPoints) => {
      const feedback = createProfileBonusFeedback();
      expect(feedback({ bonusGranted: 50, bonusAvailablePoints: 50, bonusRecoveredPoints }))
        .toEqual({ kind: 'saved' });
    },
  );

  it('cannot replay feedback for the same successful response', () => {
    const feedback = createProfileBonusFeedback();
    const response = reply(50);
    expect(feedback(response)).toEqual({ kind: 'celebrate', points: 50 });
    expect(feedback(response)).toBeNull();
    // A later save is a new response. The server owns its once-only grant;
    // an ordinary save must still finish normally after the reward was shown.
    expect(feedback(reply(0))).toEqual({ kind: 'saved' });
  });

  it('also consumes ordinary-save feedback once and evaluates a new reply independently', () => {
    const feedback = createProfileBonusFeedback();
    const saved = reply(0);
    expect(feedback(saved)).toEqual({ kind: 'saved' });
    expect(feedback(saved)).toBeNull();
    expect(feedback(reply(25))).toEqual({ kind: 'bonus', points: 25 });
  });
});

describe('PB2 the profile-save route preserves completion and accessible actual-value feedback', () => {
  const source = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

  it('opens the illustration only from a consumed successful save reply', () => {
    const details = source('app/profile/details.tsx');
    const success = details.slice(details.indexOf('onSuccess: (res)'), details.indexOf('onError:'));
    expect(success).toContain('const feedback = feedbackForReply(res);');
    expect(success).toContain('if (!feedback) return;');
    expect(success).toMatch(/if \(feedback\.kind === 'celebrate'\) \{\s*setBonusPoints\(feedback\.points\);\s*return;/);
    expect(details.match(/setBonusPoints\(feedback\.points\)/g)).toHaveLength(1);
    expect(details).toMatch(/if \(savePending\.current \|\| bonusPoints !== null\) return;/);
    expect(success).toContain("t('details.savedBonus', { points: formatNumber(feedback.points, lang) })");
    expect(success).toContain("feedback.kind === 'recovered'");
    expect(success).toContain("feedback.points > 0 ? 'details.savedBonusRecovered' : 'details.savedBonusRecoveredAll'");
    expect(success).toContain('recovered: formatNumber(feedback.recovered, lang)');
    expect(success).toContain("t('details.savedBody')");
    expect(success).toContain('router.back();');
    expect(details).toMatch(/<ProfileBonusCelebration[\s\S]*?onComplete=\{\(\) => \{\s*setBonusPoints\(null\);\s*router\.back\(\);/);
  });

  it('keeps a native amount and close control alongside art on opaque paper', () => {
    const celebration = source('components/loyalty/ProfileBonusCelebration.tsx');
    expect(celebration).toContain("points: 50;");
    expect(celebration).toContain("require('../../assets/rewards/profile-bonus-50.png')");
    expect(celebration).toContain('resizeMode="contain"');
    expect(celebration).toContain('backgroundColor: colors.white');
    expect(celebration).toContain("t('details.bonusCelebrationBody', { points: formatNumber(points, lang) })");
    expect(celebration).toContain("title={t('details.bonusCelebrationClose')} onPress={close}");
    // Navigation waits for the outgoing Modal focus trap on web/iOS. Android
    // has no onDismiss callback, so its existing immediate-close path remains.
    expect(celebration).toContain('onDismiss={finish}');
    expect(celebration).toContain("if (Platform.OS === 'android') finish();");
    expect(celebration).toContain('if (!closing.current || completed.current) return;');
  });
});
