/** Admin-panel types — mirror the loyalty server / mobile app contracts. */

export type SpinPrizeType = 'credit' | 'free-item' | 'voucher';

export interface SpinPrize {
  id: string;
  nameAr: string;
  nameEn: string;
  type: SpinPrizeType;
  creditValue?: number;
  weight: number;
  enabled: boolean;
  expiryDays: number;
}

export type SpinCondition = 'per-order-min' | 'per-visit' | 'per-topup';

export interface SpinCampaign {
  id: string;
  name: string;
  condition: SpinCondition;
  value: number;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface SpinEligibilityConfig {
  enabled: boolean;
  visitsPerSpin: number;
  topupAmount: number;
  freeSpinDays: number[]; // 0=Sun..6=Sat
}

export interface SpinConfig {
  eligibility: SpinEligibilityConfig;
  prizes: SpinPrize[];
  campaigns: SpinCampaign[];
}

// ---- Notifications / geofence / visit reward (section 14) ----

export type NotifAudience = 'all' | 'tier' | 'inactive';

export interface PushCampaign {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  deepLink: string;
  audience: NotifAudience;
  sendAt: string; // ISO or '' for now
  sent: boolean;
}

export interface GeofenceConfig {
  enabled: boolean;
  radiusMeters: number;
  dailyCap: number;
  quietStart: string; // "08:00"
  quietEnd: string; // "22:00"
}

export type VisitRewardType = 'discount' | 'spin';

export interface VisitRewardConfig {
  enabled: boolean;
  type: VisitRewardType;
  value: number;
  windowHours: number;
}
