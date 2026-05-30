import { config } from '../config';
import type {
  SpinConfig,
  SpinPrize,
  SpinCampaign,
  SpinEligibilityConfig,
  PushCampaign,
  GeofenceConfig,
  VisitRewardConfig,
} from '../types';

/**
 * Admin API. Mock store mirrors the loyalty-server /admin endpoints
 * (sections 13.3, 14.4) so the panel runs standalone (section 13.5).
 * Persists to localStorage so edits survive reloads in the demo.
 */

const LS_KEY = 'almond.admin.state';

interface AdminState {
  spin: SpinConfig;
  pushCampaigns: PushCampaign[];
  geofence: GeofenceConfig;
  visitReward: VisitRewardConfig;
}

const defaultState: AdminState = {
  spin: {
    eligibility: { enabled: true, visitsPerSpin: 5, topupAmount: 50, freeSpinDays: [] },
    prizes: [
      { id: 'credit-1', nameAr: 'رصيد 1 دينار', nameEn: '1 JOD credit', type: 'credit', creditValue: 1, weight: 30, enabled: true, expiryDays: 30 },
      { id: 'cookie', nameAr: 'كوكيز', nameEn: 'Cookie', type: 'free-item', weight: 20, enabled: true, expiryDays: 7 },
      { id: 'americano', nameAr: 'أمريكانو', nameEn: 'Americano', type: 'free-item', weight: 18, enabled: true, expiryDays: 7 },
      { id: 'any-drink', nameAr: 'أي مشروب', nameEn: 'Any drink', type: 'free-item', weight: 12, enabled: true, expiryDays: 7 },
      { id: 'omelette-croissant', nameAr: 'كرواسان أومليت', nameEn: 'Omelette croissant', type: 'free-item', weight: 8, enabled: true, expiryDays: 7 },
      { id: 'pasta', nameAr: 'باستا', nameEn: 'Pasta', type: 'free-item', weight: 5, enabled: true, expiryDays: 7 },
      { id: 'pizza', nameAr: 'بيتزا', nameEn: 'Pizza', type: 'free-item', weight: 4, enabled: true, expiryDays: 7 },
      { id: 'credit-5', nameAr: 'رصيد 5 دينار', nameEn: '5 JOD credit', type: 'credit', creditValue: 5, weight: 2, enabled: true, expiryDays: 30 },
      { id: 'cake', nameAr: 'قطعة كيك', nameEn: 'Cake slice', type: 'free-item', weight: 0.8, enabled: true, expiryDays: 7 },
      { id: 'credit-10', nameAr: 'رصيد 10 دينار', nameEn: '10 JOD credit', type: 'credit', creditValue: 10, weight: 0.2, enabled: true, expiryDays: 30 },
    ],
    campaigns: [],
  },
  pushCampaigns: [],
  geofence: { enabled: true, radiusMeters: 1000, dailyCap: 1, quietStart: '08:00', quietEnd: '22:00' },
  visitReward: { enabled: true, type: 'discount', value: 15, windowHours: 3 },
};

function load(): AdminState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as AdminState;
  } catch {
    /* ignore */
  }
  return JSON.parse(JSON.stringify(defaultState));
}

let state = load();

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

const delay = <T>(v: T, ms = 200): Promise<T> =>
  new Promise((r) => setTimeout(() => r(v), ms));

const genId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;

// ---- Live client (section 13.3) — used when DATA_SOURCE === 'live' ----
async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('almond.admin.token') ?? '';
  const res = await fetch(`${config.LOYALTY_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const adminApi = {
  // ----- Spin (section 13.3) -----
  getSpinConfig: (): Promise<SpinConfig> =>
    config.DATA_SOURCE === 'live'
      ? authedFetch('/admin/spin/config')
      : delay(state.spin),

  updateEligibility: (e: SpinEligibilityConfig): Promise<SpinEligibilityConfig> => {
    if (config.DATA_SOURCE === 'live')
      return authedFetch('/admin/spin/eligibility', { method: 'PUT', body: JSON.stringify(e) });
    state.spin.eligibility = e;
    persist();
    return delay(e);
  },

  addPrize: (prize: Omit<SpinPrize, 'id'>): Promise<SpinPrize> => {
    if (config.DATA_SOURCE === 'live')
      return authedFetch('/admin/spin/prizes', { method: 'POST', body: JSON.stringify(prize) });
    const created = { ...prize, id: genId('prize') };
    state.spin.prizes.push(created);
    persist();
    return delay(created);
  },

  updatePrize: (id: string, patch: Partial<SpinPrize>): Promise<SpinPrize> => {
    if (config.DATA_SOURCE === 'live')
      return authedFetch(`/admin/spin/prizes/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
    const idx = state.spin.prizes.findIndex((p) => p.id === id);
    state.spin.prizes[idx] = { ...state.spin.prizes[idx], ...patch };
    persist();
    return delay(state.spin.prizes[idx]);
  },

  deletePrize: (id: string): Promise<void> => {
    if (config.DATA_SOURCE === 'live')
      return authedFetch(`/admin/spin/prizes/${id}`, { method: 'DELETE' });
    state.spin.prizes = state.spin.prizes.filter((p) => p.id !== id);
    persist();
    return delay(undefined);
  },

  reorderPrizes: (ids: string[]): Promise<void> => {
    state.spin.prizes = ids
      .map((id) => state.spin.prizes.find((p) => p.id === id)!)
      .filter(Boolean);
    persist();
    return delay(undefined);
  },

  addCampaign: (c: Omit<SpinCampaign, 'id'>): Promise<SpinCampaign> => {
    if (config.DATA_SOURCE === 'live')
      return authedFetch('/admin/spin/campaigns', { method: 'POST', body: JSON.stringify(c) });
    const created = { ...c, id: genId('camp') };
    state.spin.campaigns.push(created);
    persist();
    return delay(created);
  },

  updateCampaign: (id: string, patch: Partial<SpinCampaign>): Promise<SpinCampaign> => {
    const idx = state.spin.campaigns.findIndex((c) => c.id === id);
    state.spin.campaigns[idx] = { ...state.spin.campaigns[idx], ...patch };
    persist();
    return delay(state.spin.campaigns[idx]);
  },

  deleteCampaign: (id: string): Promise<void> => {
    state.spin.campaigns = state.spin.campaigns.filter((c) => c.id !== id);
    persist();
    return delay(undefined);
  },

  // ----- Notifications / geofence / visit reward (section 14.4) -----
  getPushCampaigns: (): Promise<PushCampaign[]> => delay(state.pushCampaigns),
  addPushCampaign: (c: Omit<PushCampaign, 'id' | 'sent'>): Promise<PushCampaign> => {
    const created = { ...c, id: genId('push'), sent: false };
    state.pushCampaigns.unshift(created);
    persist();
    return delay(created);
  },
  deletePushCampaign: (id: string): Promise<void> => {
    state.pushCampaigns = state.pushCampaigns.filter((c) => c.id !== id);
    persist();
    return delay(undefined);
  },
  markPushSent: (id: string): Promise<void> => {
    const c = state.pushCampaigns.find((x) => x.id === id);
    if (c) c.sent = true;
    persist();
    return delay(undefined);
  },

  getGeofenceConfig: (): Promise<GeofenceConfig> => delay(state.geofence),
  updateGeofenceConfig: (g: GeofenceConfig): Promise<GeofenceConfig> => {
    state.geofence = g;
    persist();
    return delay(g);
  },

  getVisitRewardConfig: (): Promise<VisitRewardConfig> => delay(state.visitReward),
  updateVisitRewardConfig: (v: VisitRewardConfig): Promise<VisitRewardConfig> => {
    state.visitReward = v;
    persist();
    return delay(v);
  },
};

/** Normalized odds (%) for the live preview (section 13.2). */
export function computeOdds(prizes: SpinPrize[]): Record<string, number> {
  const enabled = prizes.filter((p) => p.enabled);
  const total = enabled.reduce((s, p) => s + p.weight, 0) || 1;
  const out: Record<string, number> = {};
  enabled.forEach((p) => {
    out[p.id] = (p.weight / total) * 100;
  });
  return out;
}
