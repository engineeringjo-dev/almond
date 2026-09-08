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
  /** Qualifying spend inside the rolling window — config.TIER_WINDOW_DAYS (90)
   *  Amman days, INCLUSIVE of today. Computed by qualifyingSpend() in
   *  loyalty/window.ts; it was a rolling-12-month figure until W1. */
  windowSpend: number;
  /** Distinct Amman days in that window carrying spend > 0 — the other door to
   *  the second rung (config.TIER2_VISITS_ALTERNATIVE = 4), and the number the
   *  progress copy is written in. */
  visitDays: number;
  /** The rung the member is PAID at: max(the floor they hold, what the live
   *  window qualifies for). It is not `tierFromSpend(windowSpend)` — there is
   *  no demotion, so those two disagree for any member whose window rolled off. */
  tier: TierId;
  multiplier: number;
  /**
   * The rung ABOVE the one the member is paid at, straight off `standing().next`
   * — `null` at the top of the ladder, `undefined` when the producer has no
   * standing to offer (the website, a raw guest figure).
   *
   * It is here because the progress copy is written in VISITS, and only a real
   * standing knows the visits number. `progressToNextTier(windowSpend)` alone
   * would tell a member with 4 visit-days and 12 JOD that they are 2 visits
   * from the 4% rung THEY ALREADY HOLD — the 4-visits door
   * (config.TIER2_VISITS_ALTERNATIVE) and the no-demotion floor are both
   * invisible to a spend-only projection. See almond-app/lib/tierCopy.ts.
   */
  nextTier?: {
    id: TierId;
    jodRemaining: number;
    /** What the member is TOLD: "3 more visits", never "8.4 JOD". */
    visitsRemaining: number;
    /**
     * Is that count a GUARANTEE (the visits door) or a projection at the
     * measured basket? Only a guaranteed count may be stated declaratively —
     * tierCopy.ts hedges the sentence when this is false, and an ABSENT field
     * is read as false, so a producer that has not thought about it cannot
     * accidentally promise a projection.
     */
    visitsGuaranteed?: boolean;
    step: number;
  } | null;
  /**
   * The free-drink cup, when the producer keeps one.
   *
   * OPTIONAL, and it was required until a probe executed the real screens
   * against the real `GET /v1/me/balance` body: the BFF holds no cup state at
   * all and never sends this field, so `data.cup.current` at
   * LoyaltyCard.tsx and app/loyalty.tsx did not render a blank — it THREW,
   * taking out the whole home card and the whole loyalty screen. A required
   * field the only real producer never sends is a promise the type cannot
   * keep; both call sites are now guarded. The app's mock still sends it.
   */
  cup?: CupState;
  /**
   * The NEXT slice of points to die, and how many. `null` when the member holds
   * no live points.
   *
   * NOT one date for the whole balance — there is no such date any more. Every
   * grant carries its own 12-month clock (loyalty/lots.ts), so a member holding
   * 240 points earned across a year has many expiry days and "your points
   * expire on 15/11" is false for 200 of them. `amount` is the sum of EVERY
   * live lot sharing the earliest expiry day, not the first lot's remainder.
   *
   * `on` is an AMMAN DAY KEY ('YYYY-MM-DD'), not an ISO instant, because the
   * enforced day and the displayed day must be the same day. 🔴 Never pass it
   * to `new Date(string)`: `new Date('2026-11-15')` parses as UTC midnight and
   * renders as 14 November west of Greenwich — the app would print a date one
   * day earlier than the server enforces. Use `formatDayKey`.
   *
   * `| null` rather than optional: unlike `cup` there is a real producer on
   * both paths (the BFF route and the app's mock), so an absent field is a
   * producer bug, not a missing feature.
   */
  nextExpiry: { amount: number; on: string } | null;
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
