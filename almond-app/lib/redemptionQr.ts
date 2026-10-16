import type { RedemptionView } from '@almond/shared/loyalty/redemption';
import { redemptionPresentationDeadline, type RedemptionPresentation } from '@almond/shared/loyalty/redemptionPresentation';
import type { LoyaltyService } from '@/services/loyalty.service';

export interface RedemptionQrState {
  status: 'idle' | 'pending' | 'ready' | 'expired' | 'unavailable' | 'closed';
  presentation: RedemptionPresentation | null;
  reservation: RedemptionView | null;
  deadline: number | null;
  remaining: number;
}
type Service = Pick<LoyaltyService, 'getRedemption' | 'getRedemptionPresentation' | 'cancelRedemption'>;

/** The same presenter drives native UI and outcome tests. Refresh only asks
 * for a credential for this exact reserve; it never invokes redeem/create.
 * Backgrounding invalidates in-flight answers and requires an explicit retry. */
export function createRedemptionQr(service: Service, userId: string, redemptionId: string, now = Date.now) {
  let state: RedemptionQrState = { status: 'idle', presentation: null, reservation: null, deadline: null, remaining: 0 };
  let generation = 0;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<RedemptionQrState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const clear = (status: RedemptionQrState['status'], reservation = state.reservation) =>
    emit({ status, reservation, presentation: null, deadline: null, remaining: 0 });
  const tick = () => {
    if (state.status !== 'ready' || state.deadline === null) return;
    const remaining = Math.max(0, Math.ceil((state.deadline - now()) / 1000));
    if (!remaining) clear('expired');
    else if (remaining !== state.remaining) emit({ remaining });
  };
  const owned = (row: RedemptionView) => {
    if (row.id !== redemptionId) throw new Error('wrong redemption');
    return row;
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    tick,
    pause: () => { generation++; clear(state.status === 'closed' ? 'closed' : 'expired'); },
    refresh: async () => {
      const request = ++generation;
      clear('pending');
      try {
        const reservation = owned(await service.getRedemption(userId, redemptionId));
        if (request !== generation) return;
        if (reservation.status !== 'pending') { clear('closed', reservation); return; }
        const started = now();
        const presentation = await service.getRedemptionPresentation(userId, redemptionId);
        if (request !== generation) return;
        if (presentation.redemptionId !== redemptionId) throw new Error('wrong presentation');
        const deadline = redemptionPresentationDeadline(presentation, started);
        if (now() >= deadline) { clear('expired', reservation); return; }
        emit({ status: 'ready', reservation, presentation, deadline, remaining: Math.ceil((deadline - now()) / 1000) });
      } catch {
        if (request === generation) clear('unavailable');
      }
    },
    poll: async () => {
      if (state.status !== 'ready') return;
      const request = generation;
      try {
        const reservation = owned(await service.getRedemption(userId, redemptionId));
        if (request !== generation) return;
        if (reservation.status !== 'pending') clear('closed', reservation);
        else tick();
      } catch {
        // A transient status-read failure cannot extend a signed credential.
        if (request === generation) tick();
      }
    },
    cancel: async (key: string) => {
      const request = ++generation;
      clear('pending');
      try {
        const reservation = owned(await service.cancelRedemption(userId, redemptionId, key));
        if (request === generation) clear(reservation.status === 'pending' ? 'unavailable' : 'closed', reservation);
      } catch {
        if (request === generation) clear('unavailable');
      }
    },
  };
}
