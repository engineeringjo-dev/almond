/**
 * Menu category display order — "first things first" for a coffee house:
 * drinks → seasonal → savoury food → bakery/bagels → salads → desserts →
 * beans/merch/gifts last. Ordering is by category (language-independent); the
 * UI shows the AR or EN name per the active language.
 */
const PRIORITY: string[] = [
  'Hot Specialty Coffee Drinks',
  'Iced Specialty Coffee Drinks',
  'Coffee Frappe',
  'Creme Frappe',
  'Hot Chocolate',
  'Tea',
  'Iced Tea And Fresh Juices',
  'Mojito',
  'Spring Seasonal Drinks',
  'Autumn Drinks (NEW)',
  'Croissant',
  'Sandwiches',
  'Chicken Meals & Sandwiches',
  'Manaqeesh',
  'Pizza',
  'Pasta',
  'Bagels',
  'Keto Bagel',
  'Sourdough',
  'Salads',
  'Granola Cup',
  'Healthy Desserts',
  'Cake Pieces & Sweets',
  'Full Cakes',
  "Mother's Day Cake",
  'Mamoul',
  'Cookies And Muffins',
  'Sweet Packs',
  'Coffee Beans',
  'Coffee Tools & Mugs',
  'Gift Box',
];

const rankMap = new Map(PRIORITY.map((n, i) => [n.toLowerCase(), i]));

/** Lower = earlier. Unknown categories fall after the known ones (keep stable). */
export function categoryRank(nameEn: string): number {
  const exact = rankMap.get((nameEn || '').trim().toLowerCase());
  if (exact != null) return exact;
  // keyword fallback so renamed/new sections still slot sensibly
  const n = (nameEn || '').toLowerCase();
  if (/coffee|latte|espresso|mocha|drink/.test(n)) return 5;
  if (/frappe|iced|cold/.test(n)) return 7;
  if (/tea|juice|mojito|lemonade/.test(n)) return 9;
  if (/seasonal|autumn|spring|new|ramadan/.test(n)) return 10;
  if (/croissant|sandwich|manaqeesh|pizza|pasta|meal|hotdog/.test(n)) return 14;
  if (/bagel|sourdough|bread/.test(n)) return 18;
  if (/salad|granola/.test(n)) return 21;
  if (/cake|dessert|sweet|mamoul|cookie|muffin|tart|brownie/.test(n)) return 24;
  if (/bean|mug|tool|gift|merch/.test(n)) return 40;
  return 100;
}
