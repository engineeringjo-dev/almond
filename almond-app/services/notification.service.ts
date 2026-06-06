import type {
  AppNotification,
  NotifSettings,
  VisitReward,
  VisitRewardType,
} from '@/types';
import { config } from '@/constants/config';
import { delay, genId } from './util';

export interface NotificationService {
  registerToken(userId: string, token: string, platform: string): Promise<void>;
  getInbox(userId: string): Promise<AppNotification[]>;
  markRead(id: string): Promise<void>;
  getSettings(userId: string): Promise<NotifSettings>;
  updateSettings(userId: string, settings: NotifSettings): Promise<NotifSettings>;

  // Geofence (section 14.2)
  geofenceEligibility(userId: string): Promise<{ canNotifyToday: boolean }>;
  geofenceTriggered(userId: string, branchId: string): Promise<{ sent: boolean }>;

  // Visit reward (section 14.3)
  issueVisitReward(userId: string, type: VisitRewardType, value: number, windowHours: number): Promise<VisitReward>;
  getActiveVisitReward(userId: string): Promise<VisitReward | null>;
  redeemVisitReward(userId: string, rewardId: string): Promise<void>;
}

// ---- Mock state ----
const inbox = new Map<string, AppNotification[]>();
const settings = new Map<string, NotifSettings>();
const lastGeofence = new Map<string, string>(); // userId → ISO date (daily cap)
const visitRewards = new Map<string, VisitReward>(); // userId → active reward

function seedInbox(userId: string): AppNotification[] {
  let list = inbox.get(userId);
  if (!list) {
    list = [
      { id: genId('ntf'), category: 'promo', titleAr: 'عرض البرانش', titleEn: 'Brunch offer', bodyAr: 'أضف مشروباً مع أي طبق برانش ووفّر 1.000 د.أ', bodyEn: 'Add a drink to any brunch and save 1.000 JOD', read: false, createdAt: new Date(Date.now() - 3600000).toISOString(), deepLink: '/(tabs)/order' },
      { id: genId('ntf'), category: 'points', titleAr: 'ربحت نقاط!', titleEn: 'You earned points!', bodyAr: 'حصلت على 15 نقطة من طلبك الأخير', bodyEn: 'You earned 15 points on your last order', read: true, createdAt: new Date(Date.now() - 86400000).toISOString(), deepLink: '/(tabs)/rewards' },
    ];
    inbox.set(userId, list);
  }
  return list;
}

const mockNotificationService: NotificationService = {
  registerToken: () => delay(undefined),
  getInbox: (userId) => delay([...seedInbox(userId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
  markRead: (id) => {
    inbox.forEach((list) => {
      const n = list.find((x) => x.id === id);
      if (n) n.read = true;
    });
    return delay(undefined);
  },
  getSettings: (userId) =>
    delay(settings.get(userId) ?? { promos: true, order: true, location: false }),
  updateSettings: (userId, s) => {
    settings.set(userId, s);
    return delay(s);
  },

  geofenceEligibility: (userId) => {
    const today = new Date().toISOString().slice(0, 10);
    return delay({ canNotifyToday: lastGeofence.get(userId) !== today });
  },
  geofenceTriggered: (userId, _branchId) => {
    const today = new Date().toISOString().slice(0, 10);
    if (lastGeofence.get(userId) === today) return delay({ sent: false }); // daily cap
    lastGeofence.set(userId, today);
    // Push the balance nudge into the inbox (section 14.2 message).
    const list = seedInbox(userId);
    list.unshift({
      id: genId('ntf'), category: 'location',
      titleAr: 'فرع ألموند قريب منك ☕', titleEn: 'An Almond branch is near you ☕',
      bodyAr: 'مرّ علينا واستخدم نقاطك 🎁', bodyEn: 'Drop by and use your points 🎁',
      read: false, createdAt: new Date().toISOString(), deepLink: '/(tabs)/rewards',
    });
    return delay({ sent: true });
  },

  issueVisitReward: (userId, type, value, windowHours) => {
    const reward: VisitReward = {
      id: genId('vrw'), type, value,
      expiresAt: new Date(Date.now() + windowHours * 3600000).toISOString(),
    };
    visitRewards.set(userId, reward); // one active per user (section 14.3)
    return delay(reward);
  },
  getActiveVisitReward: (userId) => {
    const r = visitRewards.get(userId);
    if (!r || r.redeemed || new Date(r.expiresAt) < new Date()) return delay(null);
    return delay(r);
  },
  redeemVisitReward: (userId, rewardId) => {
    const r = visitRewards.get(userId);
    if (r && r.id === rewardId) r.redeemed = true;
    return delay(undefined);
  },
};

// Live client → loyalty/notification server (section 14.4).
async function lget<T>(path: string): Promise<T> {
  const res = await fetch(`${config.LOYALTY_BASE_URL}${path}`);
  return res.json() as Promise<T>;
}
async function lpost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${config.LOYALTY_BASE_URL}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

const liveNotificationService: NotificationService = {
  registerToken: (userId, expoPushToken, platform) =>
    lpost<void>(`/notifications/register-token`, { userId, expoPushToken, platform }),
  getInbox: (userId) => lget<AppNotification[]>(`/notifications/inbox/${userId}`),
  markRead: (id) => lpost<void>(`/notifications/read/${id}`, {}),
  getSettings: (userId) => lget<NotifSettings>(`/notifications/settings/${userId}`),
  updateSettings: (userId, settings) => lpost<NotifSettings>(`/notifications/settings/${userId}`, settings),
  geofenceEligibility: (userId) => lget<{ canNotifyToday: boolean }>(`/notifications/geofence/eligibility/${userId}`),
  geofenceTriggered: (userId, branchId) => lpost<{ sent: boolean }>(`/notifications/geofence/triggered`, { userId, branchId }),
  issueVisitReward: (userId, type, value, windowHours) =>
    lpost<VisitReward>(`/rewards/visit/issue`, { userId, type, value, windowHours }),
  getActiveVisitReward: (userId) => lget<VisitReward | null>(`/rewards/visit/active/${userId}`),
  redeemVisitReward: (userId, rewardId) => lpost<void>(`/rewards/visit/redeem`, { userId, rewardId }),
};

export const notificationService: NotificationService =
  config.DATA_SOURCE === 'odoo' ? liveNotificationService : mockNotificationService;
