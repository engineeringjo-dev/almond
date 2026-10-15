/**
 * THE MENU AS AN ARABIC READER SEES IT — one pass, for the app, the website,
 * the feed and the server alike.
 *
 * Odoo is the source of the menu and stays read-only (menu.generated.ts is its
 * daily pull, untouched). This pass corrects two things on the way to a screen,
 * and nothing else:
 *
 *  1. LATIN DIGITS. Owner, 2026-10-15: «استخدم الارقام اللاتينية فقط». Fourteen
 *     product names arrive from Odoo with Arabic-Indic digits — «بايغل مع أومليت
 *     و ٣ أنواع جبن», «اسبريسو بليند ٢٥٠ جم» — printed beside Latin prices on the
 *     same card. Every Arabic name and description is normalised here.
 *
 *  2. MODIFIERS WITH NO ARABIC NAME. Odoo holds 28 add-on options and 6 groups
 *     in English only — «Full Fat Milk» sat between «حليب بقري طازج» and «حليب
 *     خالي الدسم» on the latte sheet. Where Odoo has no Arabic, the name below is
 *     used; where Odoo has one, Odoo's wins, exactly like CATEGORY_AR in
 *     scripts/odoo-menu-pull.ts. The real fix is the translation in Odoo, and
 *     once it is there the entry here is simply never reached.
 *
 * Keyed on Odoo's ENGLISH name, which is what the untranslated Arabic field
 * holds; an option not listed stays as Odoo has it.
 */
import type { Category, MenuItem } from '../types';
import { toWesternDigits } from '../lib/phone';

const hasArabic = (s: string | undefined): boolean => /[؀-ۿ]/.test(s ?? '');

/** Add-on options Odoo names in English only (measured on the 2026-09-25 pull). */
export const OPTION_AR: Readonly<Record<string, string>> = {
  'Extra Sundried Tomato': 'طماطم مجففة إضافية',
  'Extra Strawberry': 'فراولة إضافية',
  'Extra Nutella': 'نوتيلا إضافية',
  'Extra Pistachio': 'فستق حلبي إضافي',
  'Ice Cream': 'آيس كريم',
  'Full Fat Milk': 'حليب كامل الدسم',
  'Extra Lettuce': 'خس إضافي',
  'Extra Shot': 'شوت إسبريسو إضافي',
  'Decaf': 'منزوع الكافيين',
  'Extra Nuts': 'مكسرات إضافية',
  'Extra Chedder Cheese': 'جبنة شيدر إضافية',
  'Extra Guacamole': 'غواكامولي إضافي',
  'Extra Avocado': 'أفوكادو إضافي',
  'Extra Whipped Cream': 'كريمة مخفوقة إضافية',
  'No Whipped Cream': 'بدون كريمة مخفوقة',
  'Extra Cream': 'كريمة إضافية',
  'Extra Green Olive': 'زيتون أخضر إضافي',
  'Plain': 'سادة',
  'Strawberry': 'فراولة',
  'Caramel': 'كراميل',
  'Chocolate': 'شوكولاتة',
  'Rosa Tea': 'شاي روزا',
  'Extra Whipped Cream Only': 'كريمة مخفوقة إضافية فقط',
  'Extra Nuts Only': 'مكسرات إضافية فقط',
  'Extra Whipped Cream & Nuts': 'كريمة مخفوقة ومكسرات إضافية',
  'No Topping': 'بدون إضافات',
  'Sparkling water': 'مياه غازية',
  'soft drink': 'مشروب غازي',
};

/** Option groups Odoo names in English only. */
export const GROUP_AR: Readonly<Record<string, string>> = {
  'Extra For Frappe': 'إضافات الفرابيه',
  'Extra Sweet': 'إضافات الحلويات',
  'EXTRA Drink': 'إضافات المشروب',
  'Frozen Type': 'نوع الفروزن',
  'Extra Almond Latte': 'إضافات ألموند لاتيه',
  'Type': 'النوع',
};

/** Odoo's Arabic when it exists, else the fallback for the English name, else
 *  Odoo's text as it is — in Latin digits whichever it is. */
function arabicName(nameAr: string, nameEn: string, fallback: Readonly<Record<string, string>>): string {
  const name = hasArabic(nameAr) ? nameAr : (fallback[nameEn] ?? fallback[nameAr] ?? nameAr);
  return toWesternDigits(name);
}

export function localizeMenuItems(items: readonly MenuItem[]): MenuItem[] {
  return items.map((item) => ({
    ...item,
    nameAr: toWesternDigits(item.nameAr),
    ...(item.descAr !== undefined ? { descAr: toWesternDigits(item.descAr) } : {}),
    sizes: item.sizes.map((s) => ({ ...s, nameAr: toWesternDigits(s.nameAr) })),
    customizations: item.customizations.map((g) => ({
      ...g,
      nameAr: arabicName(g.nameAr, g.nameEn, GROUP_AR),
      options: g.options.map((o) => ({ ...o, nameAr: arabicName(o.nameAr, o.nameEn, OPTION_AR) })),
    })),
  }));
}

export function localizeCategories(cats: readonly Category[]): Category[] {
  return cats.map((c) => ({ ...c, nameAr: toWesternDigits(c.nameAr) }));
}
