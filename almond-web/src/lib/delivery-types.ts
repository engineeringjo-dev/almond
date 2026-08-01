/**
 * Delivery DTOs shared between the browser (`data/delivery.ts`) and the server
 * (`server/ishbek.ts`). Pure types only — no secrets, no runtime — so either
 * side can import them safely.
 */

export type Fleet = 'careem' | 'talabat';

export type DispatchStatus =
  | 'assigned'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export interface DeliveryQuote {
  fee: number; // JOD
  etaMinutes: number;
}

export interface DeliveryDispatch {
  id: string;
  fleet: Fleet;
  status: DispatchStatus;
  etaMinutes: number;
}

export interface QuoteParams {
  branchId?: string;
  address?: string;
}

export interface CancelParams {
  dispatchId: string;
  orderId: string;
  reason?: string;
}

/** Inbound Ishbek status webhook (Ishbek → Almond). */
export interface DeliveryStatusEvent {
  orderId: string;
  dispatchId: string;
  fleet: Fleet;
  status: DispatchStatus;
  occurredAt: string; // ISO-8601 with +03:00 — offset-less stamps are rejected
}
