/**
 * Seed data for the mock layer (shared between app + web).
 * Prices are JOD, Price2 authoritative. Source of truth in production is Odoo 19.
 *
 * The real menu (Talabat export) is the active source for `categories` /
 * `menuItems`; branches + payment methods live here as the single source so the
 * app and the website stay identical by construction.
 */
import type { Branch, PaymentMethod, Category, MenuItem } from '../types';
import { generatedCategories, generatedMenuItems } from './menu.generated';

// Branches (Revision Pack §G). Default hours 07:00–24:00 (mall branches follow
// mall hours). Coordinates are APPROXIMATE per Amman area — TODO: replace with
// exact lat/lng from each Google Maps pin.
export const branches: Branch[] = [
  { id: 'mecca-st', nameAr: 'شارع مكة', nameEn: 'Mecca Street', areaAr: 'شارع مكة', areaEn: 'Mecca Street', lat: 31.9846, lng: 35.8631, hours: { open: '07:00', close: '24:00' } },
  { id: 'drive-thru', nameAr: 'درايف ثرو', nameEn: 'Drive Thru', areaAr: 'خدمة السيارة', areaEn: 'Drive Thru', lat: 31.9950, lng: 35.8200, hours: { open: '07:00', close: '24:00' } },
  { id: '8th-circle', nameAr: 'الدوار الثامن', nameEn: '8th Circle', areaAr: 'الدوار الثامن', areaEn: '8th Circle', lat: 31.9419, lng: 35.8389, hours: { open: '07:00', close: '24:00' } },
  { id: 'rabyeh', nameAr: 'الرابية', nameEn: 'Rabyeh', areaAr: 'الرابية', areaEn: 'Rabyeh', lat: 31.9719, lng: 35.8665, hours: { open: '07:00', close: '24:00' } },
  { id: 'ju', nameAr: 'الجامعة الأردنية', nameEn: 'University of Jordan', areaAr: 'الجامعة الأردنية', areaEn: 'University of Jordan', lat: 32.0136, lng: 35.8714, hours: { open: '07:00', close: '24:00' } },
  { id: 'khalda', nameAr: 'خلدا', nameEn: 'Khalda', areaAr: 'خلدا', areaEn: 'Khalda', lat: 31.9897, lng: 35.8412, hours: { open: '07:00', close: '24:00' } },
  { id: 'city-mall', nameAr: 'سيتي مول', nameEn: 'City Mall', areaAr: 'سيتي مول', areaEn: 'City Mall', lat: 31.9837, lng: 35.8276, hours: { open: '10:00', close: '23:00' } },
  { id: 'shafa-badran', nameAr: 'شفا بدران', nameEn: 'Shafa Badran', areaAr: 'شفا بدران', areaEn: 'Shafa Badran', lat: 32.0556, lng: 35.9039, hours: { open: '07:00', close: '24:00' } },
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

// Real menu (Talabat export) is the active source.
export const categories: Category[] = generatedCategories;
export const menuItems: MenuItem[] = generatedMenuItems;
