/** Shared domain types for Almond Coffee House. */

export type Lang = 'ar' | 'en';

export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  /** Brunch category uses the 'BR' marker for combo logic. */
  isBrunch?: boolean;
}

/** Modifier group id — free-form (real Odoo/Talabat modifier ids). */
export type CustomizationGroupId = string;

export interface CustomizationOption {
  id: string;
  nameAr: string;
  nameEn: string;
  priceDelta: number; // JOD added to the line total
}

export interface CustomizationGroup {
  id: CustomizationGroupId;
  nameAr: string;
  nameEn: string;
  /** Single-choice (radio) vs multi-choice (checkbox, e.g. extras). */
  multiple: boolean;
  options: CustomizationOption[];
}

export interface ItemSize {
  id: 'S' | 'M' | 'L';
  nameAr: string;
  nameEn: string;
  price: number; // JOD — Price2 authoritative (section 2.5)
}

export interface MenuItem {
  id: string;
  categoryId: string;
  nameAr: string;
  nameEn: string;
  descAr?: string;
  descEn?: string;
  emoji: string; // legacy placeholder (kept for data; UI uses the icon set, §M)
  /** Real product photo when available; falls back to the category icon (§M). */
  imageUrl?: string;
  sizes: ItemSize[];
  customizations: CustomizationGroup[];
  isBrunch?: boolean;
  /** True if it counts as a "drink" for brunch combo pairing. */
  isDrink?: boolean;
  prepMinutes?: number;
  inStock?: boolean;
}

export interface CartCustomization {
  groupId: CustomizationGroupId;
  optionId: string;
  nameAr: string;
  nameEn: string;
  priceDelta: number;
}

export interface CartItem {
  /** Unique per configured line (item + size + customizations). */
  lineId: string;
  itemId: string;
  nameAr: string;
  nameEn: string;
  emoji: string;
  sizeId: ItemSize['id'];
  sizeNameAr: string;
  sizeNameEn: string;
  unitBasePrice: number;
  customizations: CartCustomization[];
  qty: number;
  isBrunch?: boolean;
  isDrink?: boolean;
  prepMinutes?: number;
}

export type OrderType = 'pickup' | 'dinein' | 'delivery';

export type PaymentMethodId =
  | 'cash'
  | 'cliq'
  | 'visa'
  | 'mastercard'
  | 'paypal'
  | 'wallet';

export interface PaymentMethod {
  id: PaymentMethodId;
  nameAr: string;
  nameEn: string;
  emoji: string;
}

export interface BranchHours {
  open: string; // "07:00"
  close: string; // "24:00"
}

export interface Branch {
  id: string;
  nameAr: string;
  nameEn: string;
  areaAr: string;
  areaEn: string;
  lat: number;
  lng: number;
  hours: BranchHours;
  /** Distance in km, computed at runtime via haversine. */
  distanceKm?: number;
  isOpen?: boolean;
}

export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'; // cancelled within the 30s grace window (Master Pack Part 3)

export interface Order {
  id: string;
  userId: string;
  type: OrderType;
  branchId: string;
  branchNameAr: string;
  branchNameEn: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethodId;
  paidFromBalance: boolean;
  status: OrderStatus;
  createdAt: string; // ISO
  targetReadyAt: string; // ISO — KDS times to arrival (section 7.3)
  prepMinutes: number;
  promoCode?: string;
  /** Curbside pickup + the car details to find the customer. */
  curbside?: boolean;
  carInfo?: string;
  /** Delivery address (Ishbek → Careem/Talabat last-mile). */
  deliveryAddress?: string;
}

// ---------- Loyalty ----------

/** The three rungs of the 2% → 4% → 6% ladder. The ids are semantic so code
 *  stays readable; the member never sees them — `nameAr`/`nameEn` carry the
 *  rate, which is the name. See loyalty/constants.ts. */
export type TierId = 'base' | 'plus' | 'top';

export interface Tier {
  id: TierId;
  /** Display name = the rate itself ("٢٪" / "٤٪" / "٦٪"). */
  nameAr: string;
  nameEn: string;
  /** Qualifying spend in JOD over config.TIER_WINDOW_DAYS (90). */
  threshold: number;
  /** Ramp against config.POINTS_PER_JOD: 1.0 / 2.0 / 3.0 → 2 / 4 / 6 pts/JOD. */
  multiplier: number;
  color: string;
}

export interface CupState {
  current: number;
  target: number;
}

export interface LoyaltyBalance {
  userId: string;
  points: number;
  /** Qualifying spend within the rolling 12-month window (Revision Pack §A). */
  windowSpend: number;
  tier: TierId;
  multiplier: number;
  cup: CupState;
  /** When the current beans expire (null = never, for Gold/Black). */
  beansExpireAt?: string | null;
}

/** "Almond Club" monthly subscription state (shared by app, web, BFF). */
export interface Subscription {
  active: boolean;
  renewsAt: string | null;
  drinksPerDay: number;
  redeemedToday: number;
  remainingToday: number;
}

export type VoucherType = 'credit' | 'free-item' | 'discount';

export interface Voucher {
  id: string;
  titleAr: string;
  titleEn: string;
  type: VoucherType;
  value?: number;
  expiresAt: string; // ISO
  used?: boolean;
}

export interface PointsLogEntry {
  id: string;
  deltaPoints: number;
  reasonAr: string;
  reasonEn: string;
  createdAt: string;
}

export interface EarnResult {
  pointsEarned: number;
  cup: CupState;
  freeDrinkIssued: boolean;
}

// ---------- Spin Wheel (admin-configurable, section 13) ----------

export type SpinPrizeType = 'credit' | 'free-item' | 'voucher';

export interface SpinPrize {
  id: string;
  nameAr: string;
  nameEn: string;
  type: SpinPrizeType;
  creditValue?: number; // JOD if type === 'credit'
  weight: number; // probability weight
  enabled: boolean;
  expiryDays: number;
  color?: string;
}

export type SpinCondition = 'per-order-min' | 'per-visit' | 'per-topup';

export interface SpinCampaign {
  id: string;
  name: string;
  condition: SpinCondition;
  value: number;
  startDate: string; // ISO date
  endDate: string;
  active: boolean;
}

export interface SpinEligibilityConfig {
  enabled: boolean;
  visitsPerSpin: number;
  topupAmount: number; // JOD
  freeSpinDays: number[]; // 0=Sun..6=Sat
}

export interface SpinConfig {
  eligibility: SpinEligibilityConfig;
  prizes: SpinPrize[];
  campaigns: SpinCampaign[];
}

export interface SpinEligibility {
  canSpin: boolean;
  spinsAvailable: number;
}

export interface SpinResult {
  prize: SpinPrize;
  prizeIndex: number; // index in the enabled prizes array (for wheel landing)
}

// ---------- Referral & rating (section 2.4.1) ----------

export interface ReferralInfo {
  code: string;
  alreadyRewarded: boolean;
}

// ---------- Notifications & geofence (section 14) ----------

export type NotifCategory = 'order' | 'promo' | 'points' | 'location' | 'new-item';

export interface AppNotification {
  id: string;
  category: NotifCategory;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  read: boolean;
  createdAt: string;
  deepLink?: string;
}

export interface NotifSettings {
  promos: boolean;
  order: boolean;
  location: boolean; // requires explicit opt-in
}

export type VisitRewardType = 'discount' | 'spin';

export interface VisitReward {
  id: string;
  type: VisitRewardType;
  value: number; // % for discount
  expiresAt: string;
  redeemed?: boolean;
}

// ---------- Gift cards (eGifts) ----------

export type GiftOccasion =
  | 'anytime'
  | 'birthday'
  | 'thankyou'
  | 'congrats'
  | 'celebration'
  | 'loveyou'
  | 'eid'
  | 'ramadan'
  | 'graduation'
  | 'wedding'
  | 'newbaby'
  | 'getwell'
  | 'friday'
  | 'fun';

export interface GiftCard {
  id: string;
  code: string;
  designId: string;
  amount: number;
  recipientName: string;
  recipientPhone?: string;
  message?: string;
  senderId: string;
  createdAt: string;
  redeemed?: boolean;
}

// ---------- Auth / user ----------

export interface User {
  id: string;
  phone: string;
  name: string;
  isGuest: boolean;
}
