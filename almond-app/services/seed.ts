/**
 * Seed data for the mock layer (sections 5 & 7.5). Prices are JOD, Price2
 * authoritative (section 2.5). Source of truth in production is Odoo 19.
 */
import type {
  Category,
  MenuItem,
  Branch,
  PaymentMethod,
  Tier,
  CustomizationGroup,
} from '@/types';
import { generatedCategories, generatedMenuItems } from './menu.generated';

const legacyCategories: Category[] = [
  { id: 'all', nameAr: 'الكل', nameEn: 'All' },
  { id: 'hot-coffee', nameAr: 'القهوة الساخنة', nameEn: 'Hot Coffee' },
  { id: 'cold-drinks', nameAr: 'المشروبات الباردة', nameEn: 'Cold Drinks' },
  { id: 'matcha', nameAr: 'ماتشا', nameEn: 'Matcha' },
  { id: 'chocolate', nameAr: 'الشوكولاتة', nameEn: 'Chocolate' },
  { id: 'pastries', nameAr: 'المعجنات', nameEn: 'Pastries' },
  { id: 'cakes', nameAr: 'الكيك والحلويات', nameEn: 'Cakes & Desserts' },
  { id: 'brunch', nameAr: 'البرانش', nameEn: 'Brunch', isBrunch: true },
  { id: 'addons', nameAr: 'إضافات', nameEn: 'Add-ons' },
];

// Reusable customization groups for drinks.
const milkGroup: CustomizationGroup = {
  id: 'milk',
  nameAr: 'الحليب',
  nameEn: 'Milk',
  multiple: false,
  options: [
    { id: 'full', nameAr: 'كامل الدسم', nameEn: 'Whole', priceDelta: 0 },
    { id: 'skim', nameAr: 'قليل الدسم', nameEn: 'Skim', priceDelta: 0 },
    { id: 'oat', nameAr: 'حليب الشوفان', nameEn: 'Oat', priceDelta: 0.4 },
    { id: 'almond', nameAr: 'حليب اللوز', nameEn: 'Almond', priceDelta: 0.4 },
    { id: 'none', nameAr: 'بدون حليب', nameEn: 'No milk', priceDelta: 0 },
  ],
};

const sugarGroup: CustomizationGroup = {
  id: 'sugar',
  nameAr: 'السكر',
  nameEn: 'Sugar',
  multiple: false,
  options: [
    { id: 'none', nameAr: 'بدون', nameEn: 'None', priceDelta: 0 },
    { id: 'less', nameAr: 'قليل', nameEn: 'Less', priceDelta: 0 },
    { id: 'normal', nameAr: 'عادي', nameEn: 'Normal', priceDelta: 0 },
    { id: 'extra', nameAr: 'زيادة', nameEn: 'Extra', priceDelta: 0 },
  ],
};

const iceGroup: CustomizationGroup = {
  id: 'ice',
  nameAr: 'الثلج',
  nameEn: 'Ice',
  multiple: false,
  options: [
    { id: 'none', nameAr: 'بدون', nameEn: 'None', priceDelta: 0 },
    { id: 'less', nameAr: 'قليل', nameEn: 'Less', priceDelta: 0 },
    { id: 'normal', nameAr: 'عادي', nameEn: 'Normal', priceDelta: 0 },
    { id: 'extra', nameAr: 'زيادة', nameEn: 'Extra', priceDelta: 0 },
  ],
};

const extrasGroup: CustomizationGroup = {
  id: 'extras',
  nameAr: 'إضافات',
  nameEn: 'Extras',
  multiple: true,
  options: [
    { id: 'shot', nameAr: 'جرعة إسبرسو إضافية', nameEn: 'Extra shot', priceDelta: 0.5 },
    { id: 'vanilla', nameAr: 'نكهة الفانيلا', nameEn: 'Vanilla', priceDelta: 0.3 },
    { id: 'caramel', nameAr: 'نكهة الكراميل', nameEn: 'Caramel', priceDelta: 0.3 },
    { id: 'whip', nameAr: 'كريمة مخفوقة', nameEn: 'Whipped cream', priceDelta: 0.3 },
  ],
};

const hotDrinkCusts = [milkGroup, sugarGroup, extrasGroup];
const coldDrinkCusts = [milkGroup, sugarGroup, iceGroup, extrasGroup];

function size(id: 'S' | 'M' | 'L', price: number) {
  const labels = {
    S: { nameAr: 'صغير', nameEn: 'Small' },
    M: { nameAr: 'وسط', nameEn: 'Medium' },
    L: { nameAr: 'كبير', nameEn: 'Large' },
  };
  return { id, ...labels[id], price };
}

// Single-size item helper (cold drinks, food) — uses a neutral "regular" label.
function single(price: number) {
  return [{ id: 'M' as const, nameAr: 'عادي', nameEn: 'Regular', price }];
}

const legacyMenuItems: MenuItem[] = [
  // ---- Hot Coffee ----
  {
    id: 'espresso', categoryId: 'hot-coffee', nameAr: 'إسبرسو', nameEn: 'Espresso',
    descAr: 'جرعة إسبرسو غنية', descEn: 'Rich single shot', emoji: '☕',
    sizes: [size('S', 1.5)], customizations: [sugarGroup, extrasGroup], isDrink: true, prepMinutes: 4, inStock: true,
  },
  {
    id: 'americano', categoryId: 'hot-coffee', nameAr: 'أمريكانو', nameEn: 'Americano',
    descAr: 'إسبرسو مع ماء ساخن', descEn: 'Espresso with hot water', emoji: '☕',
    sizes: [size('S', 1.8), size('M', 2.0), size('L', 2.2)], customizations: [sugarGroup, extrasGroup], isDrink: true, prepMinutes: 5, inStock: true,
  },
  {
    id: 'cappuccino', categoryId: 'hot-coffee', nameAr: 'كابتشينو', nameEn: 'Cappuccino',
    descAr: 'إسبرسو مع رغوة الحليب', descEn: 'Espresso with foamed milk', emoji: '☕',
    sizes: [size('S', 2.0), size('M', 2.5), size('L', 2.8)], customizations: hotDrinkCusts, isDrink: true, prepMinutes: 6, inStock: true,
  },
  {
    id: 'latte', categoryId: 'hot-coffee', nameAr: 'لاتيه', nameEn: 'Latte',
    descAr: 'إسبرسو مع حليب مبخّر', descEn: 'Espresso with steamed milk', emoji: '🥛',
    sizes: [size('S', 2.2), size('M', 2.5), size('L', 2.8)], customizations: hotDrinkCusts, isDrink: true, prepMinutes: 6, inStock: true,
  },
  {
    id: 'flat-white', categoryId: 'hot-coffee', nameAr: 'فلات وايت', nameEn: 'Flat White',
    descAr: 'إسبرسو مزدوج مع حليب مخملي', descEn: 'Double shot with velvety milk', emoji: '☕',
    sizes: [size('S', 2.5), size('M', 2.8)], customizations: hotDrinkCusts, isDrink: true, prepMinutes: 6, inStock: true,
  },
  {
    id: 'cortado', categoryId: 'hot-coffee', nameAr: 'كورتادو', nameEn: 'Cortado',
    descAr: 'إسبرسو مع كمية متساوية من الحليب', descEn: 'Espresso cut with equal milk', emoji: '☕',
    sizes: [size('S', 2.0)], customizations: hotDrinkCusts, isDrink: true, prepMinutes: 5, inStock: true,
  },
  {
    id: 'macchiato', categoryId: 'hot-coffee', nameAr: 'ماكياتو', nameEn: 'Macchiato',
    descAr: 'إسبرسو مع لمسة من الحليب', descEn: 'Espresso marked with milk', emoji: '☕',
    sizes: [size('S', 2.2), size('M', 2.5)], customizations: hotDrinkCusts, isDrink: true, prepMinutes: 5, inStock: true,
  },

  // ---- Cold Drinks ----
  {
    id: 'cold-brew', categoryId: 'cold-drinks', nameAr: 'كولد برو', nameEn: 'Cold Brew',
    descAr: 'قهوة منقوعة على البارد 18 ساعة', descEn: '18-hour slow-steeped coffee', emoji: '🧊',
    sizes: single(3.0), customizations: coldDrinkCusts, isDrink: true, prepMinutes: 4, inStock: true,
  },
  {
    id: 'iced-latte', categoryId: 'cold-drinks', nameAr: 'أيسد لاتيه', nameEn: 'Iced Latte',
    descAr: 'لاتيه مثلج منعش', descEn: 'Refreshing iced latte', emoji: '🧊',
    sizes: single(2.8), customizations: coldDrinkCusts, isDrink: true, prepMinutes: 5, inStock: true,
  },
  {
    id: 'iced-americano', categoryId: 'cold-drinks', nameAr: 'أيسد أمريكانو', nameEn: 'Iced Americano',
    descAr: 'أمريكانو مثلج', descEn: 'Iced americano', emoji: '🧊',
    sizes: single(2.2), customizations: [sugarGroup, iceGroup, extrasGroup], isDrink: true, prepMinutes: 4, inStock: true,
  },
  {
    id: 'frappuccino', categoryId: 'cold-drinks', nameAr: 'فرابتشينو', nameEn: 'Frappuccino',
    descAr: 'مشروب قهوة مخفوق ومثلّج', descEn: 'Blended iced coffee', emoji: '🥤',
    // Demo of availability state (Master Pack Part 3 #2) — cannot be added.
    sizes: single(3.5), customizations: coldDrinkCusts, isDrink: true, prepMinutes: 6, inStock: false,
  },

  // ---- Matcha ----
  {
    id: 'matcha-hot', categoryId: 'matcha', nameAr: 'ماتشا لاتيه (حار)', nameEn: 'Matcha Latte (Hot)',
    descAr: 'ماتشا يابانية مع حليب مبخّر', descEn: 'Japanese matcha with steamed milk', emoji: '🍵',
    sizes: single(3.2), customizations: hotDrinkCusts, isDrink: true, prepMinutes: 6, inStock: true,
  },
  {
    id: 'matcha-iced', categoryId: 'matcha', nameAr: 'ماتشا لاتيه (بارد)', nameEn: 'Matcha Latte (Iced)',
    descAr: 'ماتشا يابانية مثلّجة', descEn: 'Iced Japanese matcha latte', emoji: '🍵',
    sizes: single(3.2), customizations: coldDrinkCusts, isDrink: true, prepMinutes: 6, inStock: true,
  },
  {
    id: 'matcha-espresso', categoryId: 'matcha', nameAr: 'ماتشا إسبرسو', nameEn: 'Matcha Espresso Fusion',
    descAr: 'دمج الماتشا مع الإسبرسو', descEn: 'Matcha fused with espresso', emoji: '🍵',
    sizes: single(3.5), customizations: coldDrinkCusts, isDrink: true, prepMinutes: 6, inStock: true,
  },

  // ---- Chocolate ----
  // DECISION: section 5 lists a chocolate category but no items; seed two
  // sensible drinks with default prices so the category isn't empty. TODO: confirm in Odoo.
  {
    id: 'hot-chocolate', categoryId: 'chocolate', nameAr: 'شوكولاتة ساخنة', nameEn: 'Hot Chocolate',
    descAr: 'شوكولاتة بلجيكية غنية', descEn: 'Rich Belgian chocolate', emoji: '🍫',
    sizes: single(2.8), customizations: [milkGroup, sugarGroup, extrasGroup], isDrink: true, prepMinutes: 6, inStock: true,
  },
  {
    id: 'iced-mocha', categoryId: 'chocolate', nameAr: 'موكا مثلجة', nameEn: 'Iced Mocha',
    descAr: 'إسبرسو وشوكولاتة وحليب مثلج', descEn: 'Espresso, chocolate & iced milk', emoji: '🍫',
    sizes: single(3.2), customizations: coldDrinkCusts, isDrink: true, prepMinutes: 6, inStock: true,
  },

  // ---- Pastries ----
  {
    id: 'butter-croissant', categoryId: 'pastries', nameAr: 'كرواسان بالزبدة', nameEn: 'Butter Croissant',
    descAr: 'كرواسان فرنسي بالزبدة', descEn: 'Flaky French butter croissant', emoji: '🥐',
    sizes: single(1.8), customizations: [], isDrink: false, prepMinutes: 2, inStock: true,
  },
  {
    id: 'cheese-croissant', categoryId: 'pastries', nameAr: 'كرواسان بالجبن', nameEn: 'Cheese Croissant',
    descAr: 'كرواسان محشو بالجبن', descEn: 'Croissant filled with cheese', emoji: '🥐',
    sizes: single(2.2), customizations: [], isDrink: false, prepMinutes: 3, inStock: true,
  },
  {
    id: 'pain-au-chocolat', categoryId: 'pastries', nameAr: 'بان أو شوكولا', nameEn: 'Pain au Chocolat',
    descAr: 'كرواسان بالشوكولاتة', descEn: 'Chocolate-filled pastry', emoji: '🥐',
    sizes: single(2.5), customizations: [], isDrink: false, prepMinutes: 3, inStock: true,
  },
  {
    id: 'almond-croissant', categoryId: 'pastries', nameAr: 'كرواسان باللوز', nameEn: 'Almond Croissant',
    descAr: 'كرواسان محشو بكريمة اللوز', descEn: 'Filled with almond cream', emoji: '🥐',
    sizes: single(2.8), customizations: [], isDrink: false, prepMinutes: 3, inStock: true,
  },

  // ---- Cakes & Desserts ----
  // DECISION: no items given in section 5; seed two defaults. TODO: confirm in Odoo.
  {
    id: 'cheesecake', categoryId: 'cakes', nameAr: 'تشيز كيك', nameEn: 'Cheesecake',
    descAr: 'قطعة تشيز كيك كلاسيكية', descEn: 'Classic slice of cheesecake', emoji: '🍰',
    sizes: single(3.0), customizations: [], isDrink: false, prepMinutes: 2, inStock: true,
  },
  {
    id: 'chocolate-cake', categoryId: 'cakes', nameAr: 'كيك الشوكولاتة', nameEn: 'Chocolate Cake',
    descAr: 'قطعة كيك شوكولاتة غنية', descEn: 'Rich chocolate cake slice', emoji: '🍫',
    sizes: single(3.2), customizations: [], isDrink: false, prepMinutes: 2, inStock: true,
  },

  // ---- Brunch (BR) ----
  {
    id: 'eggs-benedict', categoryId: 'brunch', nameAr: 'بيض بندكت', nameEn: 'Eggs Benedict',
    descAr: 'بيض مسلوق مع صلصة هولانديز', descEn: 'Poached eggs with hollandaise', emoji: '🍳',
    sizes: single(5.5), customizations: [], isBrunch: true, isDrink: false, prepMinutes: 12, inStock: true,
  },
  {
    id: 'avocado-toast', categoryId: 'brunch', nameAr: 'أفوكادو توست', nameEn: 'Avocado Toast',
    descAr: 'توست بالأفوكادو الطازج', descEn: 'Toast with fresh avocado', emoji: '🥑',
    sizes: single(5.0), customizations: [], isBrunch: true, isDrink: false, prepMinutes: 8, inStock: true,
  },
  {
    id: 'shakshuka', categoryId: 'brunch', nameAr: 'شكشوكة', nameEn: 'Shakshuka',
    descAr: 'بيض مطهو بصلصة الطماطم', descEn: 'Eggs poached in tomato sauce', emoji: '🍅',
    sizes: single(4.5), customizations: [], isBrunch: true, isDrink: false, prepMinutes: 12, inStock: true,
  },
  {
    id: 'french-toast', categoryId: 'brunch', nameAr: 'فرنش توست', nameEn: 'French Toast',
    descAr: 'خبز محمّص بالقرفة والعسل', descEn: 'Cinnamon honey toast', emoji: '🍞',
    sizes: single(4.8), customizations: [], isBrunch: true, isDrink: false, prepMinutes: 10, inStock: true,
  },
  {
    id: 'full-english', categoryId: 'brunch', nameAr: 'فطور إنجليزي كامل', nameEn: 'Full English',
    descAr: 'فطور إنجليزي شامل', descEn: 'Complete English breakfast', emoji: '🍳',
    sizes: single(7.5), customizations: [], isBrunch: true, isDrink: false, prepMinutes: 15, inStock: false,
  },

  // ---- Add-ons ----
  {
    id: 'extra-shot', categoryId: 'addons', nameAr: 'جرعة إسبرسو', nameEn: 'Extra Espresso Shot',
    descAr: 'أضف جرعة إسبرسو لأي مشروب', descEn: 'Add a shot to any drink', emoji: '➕',
    sizes: single(0.5), customizations: [], isDrink: false, prepMinutes: 1, inStock: true,
  },
  {
    id: 'oat-milk-side', categoryId: 'addons', nameAr: 'حليب شوفان', nameEn: 'Oat Milk',
    descAr: 'ترقية إلى حليب الشوفان', descEn: 'Oat milk upgrade', emoji: '🥛',
    sizes: single(0.4), customizations: [], isDrink: false, prepMinutes: 1, inStock: true,
  },
];

// Branches (Revision Pack §G — full 10-branch list). Default hours 07:00–24:00
// (mall branches follow mall hours). Coordinates approximate Amman areas.
export const branches: Branch[] = [
  { id: 'mecca-st', nameAr: 'شارع مكة', nameEn: 'Mecca St', areaAr: 'شارع مكة', areaEn: 'Mecca St', lat: 31.9846, lng: 35.8631, hours: { open: '07:00', close: '24:00' } },
  { id: 'rabya', nameAr: 'الرابية', nameEn: 'Al-Rabya', areaAr: 'الرابية', areaEn: 'Al-Rabya', lat: 31.9719, lng: 35.8665, hours: { open: '07:00', close: '24:00' } },
  { id: 'khalda', nameAr: 'خلدا', nameEn: 'Khalda', areaAr: 'خلدا', areaEn: 'Khalda', lat: 31.9897, lng: 35.8412, hours: { open: '07:00', close: '24:00' } },
  { id: '8th-circle', nameAr: 'الدوار الثامن', nameEn: '8th Circle', areaAr: 'الدوار الثامن', areaEn: '8th Circle', lat: 31.9419, lng: 35.8389, hours: { open: '07:00', close: '24:00' } },
  { id: 'city-mall', nameAr: 'سيتي مول', nameEn: 'City Mall', areaAr: 'سيتي مول', areaEn: 'City Mall', lat: 31.9837, lng: 35.8276, hours: { open: '10:00', close: '22:00' } },
  { id: 'university', nameAr: 'الجامعة', nameEn: 'University', areaAr: 'الجامعة الأردنية', areaEn: 'University of Jordan', lat: 32.0136, lng: 35.8714, hours: { open: '07:00', close: '24:00' } },
  { id: 'shafa-badran', nameAr: 'شفا بدران', nameEn: 'Shafa Badran', areaAr: 'شفا بدران', areaEn: 'Shafa Badran', lat: 32.0556, lng: 35.9039, hours: { open: '07:00', close: '24:00' } },
  { id: 'madina-st', nameAr: 'شارع المدينة المنورة', nameEn: 'Madina St', areaAr: 'شارع المدينة المنورة', areaEn: 'Madina St', lat: 31.9690, lng: 35.8730, hours: { open: '07:00', close: '24:00' } },
  { id: 'deir-ghbar', nameAr: 'دير غبار', nameEn: 'Deir Ghbar', areaAr: 'دير غبار', areaEn: 'Deir Ghbar', lat: 31.9490, lng: 35.8720, hours: { open: '07:00', close: '24:00' } },
  { id: 'umm-summaq', nameAr: 'أم السماق', nameEn: 'Umm Al-Summaq', areaAr: 'أم السماق', areaEn: 'Umm Al-Summaq', lat: 31.9760, lng: 35.8480, hours: { open: '07:00', close: '24:00' } },
];

// Ordered by local popularity (UX §2): wallet + CliQ first, then cards, then points.
export const paymentMethods: PaymentMethod[] = [
  { id: 'wallet', nameAr: 'رصيد المحفظة', nameEn: 'Wallet', emoji: '💰' },
  { id: 'cliq', nameAr: 'كليك', nameEn: 'CliQ', emoji: '📱' },
  { id: 'cash', nameAr: 'نقداً', nameEn: 'Cash', emoji: '💵' },
  { id: 'visa', nameAr: 'فيزا', nameEn: 'Visa', emoji: '💳' },
  { id: 'mastercard', nameAr: 'ماستركارد', nameEn: 'Mastercard', emoji: '💳' },
  { id: 'paypal', nameAr: 'باي بال', nameEn: 'PayPal', emoji: '🅿️' },
];

// Tiers (Revision Pack §A): computed from ROLLING 12-MONTH spend (not lifetime).
// Thresholds: Bean(0) → Silver(100) → Gold(300) → Black(750).
export const tiers: Tier[] = [
  { id: 'bean', nameAr: 'بين', nameEn: 'Bean', threshold: 0, multiplier: 1.0, color: '#8C6239' },
  { id: 'silver', nameAr: 'فضي', nameEn: 'Silver', threshold: 100, multiplier: 1.25, color: '#9AA0A6' },
  { id: 'gold', nameAr: 'ذهبي', nameEn: 'Gold', threshold: 300, multiplier: 1.5, color: '#C9A06A' },
  { id: 'black', nameAr: 'أسود', nameEn: 'Black', threshold: 750, multiplier: 2.0, color: '#2B2B2B' },
];

export function tierFromSpend(spend: number): Tier {
  let current = tiers[0];
  for (const tier of tiers) {
    if (spend >= tier.threshold) current = tier;
  }
  return current;
}

export function nextTier(spend: number): Tier | null {
  return tiers.find((t) => t.threshold > spend) ?? null;
}

// Real menu (Talabat export) is the active source; legacy demo arrays kept
// only as a fallback reference.
void legacyCategories;
void legacyMenuItems;
export const categories: Category[] = generatedCategories;
export const menuItems: MenuItem[] = generatedMenuItems;
