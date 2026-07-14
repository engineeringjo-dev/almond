/**
 * Careers + franchise application data (mock layer). Under DATA_SOURCE='odoo'
 * the submit functions would POST to the backend / CRM; for now they resolve so
 * the forms are fully demoable. The seam (async + typed input) is ready.
 */

export interface JobPosition {
  id: string;
  ar: string;
  en: string;
}

export const POSITIONS: JobPosition[] = [
  { id: 'barista', ar: 'باريستا', en: 'Barista' },
  { id: 'shift', ar: 'مشرف وردية', en: 'Shift Supervisor' },
  { id: 'manager', ar: 'مدير فرع', en: 'Store Manager' },
  { id: 'cashier', ar: 'كاشير', en: 'Cashier' },
  { id: 'kitchen', ar: 'طاقم المطبخ', en: 'Kitchen Team' },
];

/** Countries where Almond currently accepts franchise applications. */
export interface Country {
  id: string;
  ar: string;
  en: string;
}

export const ALLOWED_COUNTRIES: Country[] = [
  { id: 'jo', ar: 'الأردن', en: 'Jordan' },
  { id: 'sa', ar: 'السعودية', en: 'Saudi Arabia' },
  { id: 'ae', ar: 'الإمارات', en: 'UAE' },
  { id: 'qa', ar: 'قطر', en: 'Qatar' },
  { id: 'kw', ar: 'الكويت', en: 'Kuwait' },
  { id: 'bh', ar: 'البحرين', en: 'Bahrain' },
  { id: 'om', ar: 'عُمان', en: 'Oman' },
  { id: 'eg', ar: 'مصر', en: 'Egypt' },
];

export interface InvestmentRange {
  id: string;
  ar: string;
  en: string;
}

export const INVESTMENT_RANGES: InvestmentRange[] = [
  { id: 'lt150', ar: 'أقل من 150 ألف د.أ', en: 'Under 150k JOD' },
  { id: '150_300', ar: '150–300 ألف د.أ', en: '150k–300k JOD' },
  { id: 'gt300', ar: 'أكثر من 300 ألف د.أ', en: '300k+ JOD' },
];

export interface JobApplication {
  name: string;
  email: string;
  phone: string;
  position: string;
  cv?: string;
  message?: string;
}

export interface FranchiseApplication {
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  investment: string;
  message?: string;
}

export async function submitJobApplication(input: JobApplication): Promise<void> {
  // mock: pretend to send. odoo: POST to the careers/CRM endpoint.
  if (process.env.NODE_ENV !== 'production') console.info('[mock] job application', input);
}

export async function submitFranchiseApplication(input: FranchiseApplication): Promise<void> {
  if (process.env.NODE_ENV !== 'production') console.info('[mock] franchise application', input);
}
