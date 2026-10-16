import type { ProfileSaveResult } from '@/services/loyalty.service';

/** Presentation for one fresh successful profile-save response.
 *
 * Eligibility, the gross bonus and the balance do not say how many points
 * became available: a credit may repay points owed from an earlier refund.
 * The server reports both amounts; presentation never calculates the net.
 * The fixed-50 illustration is reserved for 50 newly available points with
 * no recovery. Other amounts and recoveries stay native, actual-value text.
 */
export type ProfileBonusReply = Pick<ProfileSaveResult,
  'bonusGranted' | 'bonusAvailablePoints' | 'bonusRecoveredPoints'>;

export type ProfileBonusFeedback =
  | { kind: 'celebrate'; points: 50 }
  | { kind: 'bonus'; points: number }
  | { kind: 'recovered'; points: number; recovered: number }
  | { kind: 'saved' };

/** A response may be delivered to a callback again; never replay its UI.
 * The backend's profileBonusAt stamp, not this presentation guard, prevents a
 * second grant. New responses use their own returned net/recovery amounts. */
export function createProfileBonusFeedback() {
  const handled = new WeakSet<ProfileBonusReply>();
  return (reply: ProfileBonusReply): ProfileBonusFeedback | null => {
    if (handled.has(reply)) return null;
    handled.add(reply);
    const points = reply.bonusAvailablePoints;
    const recovered = reply.bonusRecoveredPoints;
    // An older or malformed wire is not evidence of a newly available grant.
    // Never fall back to gross bonusGranted or a balance difference.
    if (!Number.isSafeInteger(points) || points < 0
      || !Number.isSafeInteger(recovered) || recovered < 0) return { kind: 'saved' };
    if (recovered > 0) return { kind: 'recovered', points, recovered };
    if (points === 0) return { kind: 'saved' };
    return points === 50 ? { kind: 'celebrate', points } : { kind: 'bonus', points };
  };
}
