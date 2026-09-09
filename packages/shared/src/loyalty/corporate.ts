import { normalizeJordanPhone } from '../lib/phone';

/**
 * CORPORATE DISCOUNTS — a standing percentage off, for the people on a named
 * company's roster.
 *
 * Owner, 2026-09-08: «الاهم بدي القدرة على اني ارفع على الباك اوفس تاع التطبيق
 * والموقع الالكتروني قائمة الشركات وخصوماتها — مثلا موظفين الموند ٥٠٪ على كل
 * شيء، شركة save the children ٢٠٪، ويكون في ارقام هواتفهم حتى يقدرو يعملو
 * redeem للكود».
 *
 * 🔴 THE RULE THAT OUTRANKS EVERY OTHER LINE IN THIS FILE. Asked whether a
 * discounted invoice also earns cashback, the owner answered: «من يستحق خصم
 * دائم لا يأخذ نقاط ابدا» — someone entitled to a standing discount NEVER takes
 * points. Not "not on the discounted part", not "not on this invoice": never.
 *
 * That is why `corporateEarnsPoints` is a function that returns a constant
 * rather than a config dial. An Almond employee at 50% who also earned the top
 * rung's 9% would be handed 55% of the menu price, and the two mechanisms would
 * compound every time anyone tuned either one. The discount IS the reward.
 *
 * WHAT THIS MODULE IS NOT. It does not price a basket and it does not decide
 * who is signed in. It answers one question — "does this phone hold a standing
 * discount, and how much" — from data an administrator uploaded, and it states
 * the earning consequence. Pricing and identity live where they already live.
 */

/** A company with a standing arrangement. `percentOff` is a PERCENTAGE (50 for
 *  half price), not a fraction, because that is what an administrator types. */
export interface CompanyDiscount {
  id: string;
  nameAr: string;
  nameEn: string;
  /** 1-100. Validated on upload; see `parseRoster`. */
  percentOff: number;
  /** Switched off without deleting, so the roster and its history survive a
   *  contract that lapses and is later renewed. */
  active: boolean;
}

/** One person on one company's roster. The phone is the identity — it is what
 *  OTP sign-in already proves — so there is no separate credential to issue,
 *  leak, or forget. */
export interface CorporateMemberEntry {
  /** Canonical `+9627XXXXXXXX`. */
  phone: string;
  companyId: string;
  /** For the back-office list and the staff-drinks report. Optional: a roster
   *  of bare numbers is still a usable roster. */
  name?: string;
}

/** What a member is entitled to, resolved. */
export interface CorporateEntitlement {
  company: CompanyDiscount;
  percentOff: number;
}

/**
 * 🔴 A STANDING-DISCOUNT HOLDER EARNS NOTHING, EVER.
 *
 * A function and not a boolean constant so that every call site reads as a
 * question with one answer, and so the reason travels with it. If this ever
 * becomes configurable, the config must be read HERE and nowhere else.
 */
export function corporateEarnsPoints(): boolean {
  return false;
}

/** Index a roster by phone. Later entries win, so re-uploading a company's list
 *  moves a person who changed employer rather than leaving them in both. */
export function buildRosterIndex(entries: CorporateMemberEntry[]): Map<string, CorporateMemberEntry> {
  const byPhone = new Map<string, CorporateMemberEntry>();
  for (const e of entries) {
    const phone = normalizeJordanPhone(e.phone);
    if (phone) byPhone.set(phone, { ...e, phone });
  }
  return byPhone;
}

/**
 * The entitlement for a phone, or `null`.
 *
 * `null` for: not on any roster, on the roster of a company that is switched
 * off, or on the roster of a company that no longer exists. An administrator
 * who deletes a company must not leave its people holding a discount that
 * nothing describes.
 */
export function entitlementFor(
  phone: string | null | undefined,
  companies: CompanyDiscount[],
  roster: Map<string, CorporateMemberEntry>,
): CorporateEntitlement | null {
  const p = normalizeJordanPhone(phone);
  if (!p) return null;
  const entry = roster.get(p);
  if (!entry) return null;
  const company = companies.find((c) => c.id === entry.companyId);
  if (!company || !company.active) return null;
  return { company, percentOff: company.percentOff };
}

/**
 * What comes off a subtotal, rounded to fils (3 dp) the way every other money
 * figure in this repo is.
 *
 * Clamped to the subtotal so a mistyped 150% cannot produce a NEGATIVE bill
 * that the till would owe the customer. `parseRoster` already refuses >100, so
 * this is the second of two guards on the same mistake — deliberately, because
 * the first one only covers the upload path and settings can be edited.
 */
export function corporateDiscountAmount(subtotal: number, percentOff: number): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  if (!Number.isFinite(percentOff) || percentOff <= 0) return 0;
  const pct = Math.min(100, percentOff);
  return Math.round(Math.min(subtotal, (subtotal * pct) / 100) * 1000) / 1000;
}

/** One parsed roster row, or the reason it could not be used. */
export interface RosterParseResult {
  entries: CorporateMemberEntry[];
  /** 1-based line numbers with a human-readable reason, for the upload screen.
   *  A bulk upload that silently drops rows is how a company of 200 becomes a
   *  company of 180 with nobody the wiser. */
  errors: { line: number; value: string; reason: string }[];
}

/**
 * Parse a pasted or uploaded roster: one member per line, `phone` or
 * `phone,name`. Tolerates a header row, blank lines, quotes and BOM, because
 * this is fed by whatever HR exported.
 *
 * Duplicates within one upload are kept as a single entry (last wins) rather
 * than reported: the same person listed twice is not an error worth blocking a
 * 200-row upload for.
 */
export function parseRoster(text: string, companyId: string): RosterParseResult {
  const entries: CorporateMemberEntry[] = [];
  const errors: RosterParseResult['errors'] = [];
  const seen = new Set<string>();

  const lines = (text ?? '').replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    const phone = normalizeJordanPhone(cells[0]);
    if (!phone) {
      // A header row is the one invalid first line we expect, so it is skipped
      // quietly rather than reported as the user's mistake.
      const looksLikeHeader = i === 0 && /phone|هاتف|رقم|mobile/i.test(cells[0] ?? '');
      if (!looksLikeHeader) {
        errors.push({ line: i + 1, value: cells[0] ?? '', reason: 'not a Jordanian mobile number' });
      }
      return;
    }
    if (seen.has(phone)) {
      entries[entries.findIndex((e) => e.phone === phone)] = {
        phone, companyId, ...(cells[1] ? { name: cells[1] } : {}),
      };
      return;
    }
    seen.add(phone);
    entries.push({ phone, companyId, ...(cells[1] ? { name: cells[1] } : {}) });
  });

  return { entries, errors };
}

/** Validate a company before it is stored. Returns the reason it is unusable,
 *  or `null`. Kept separate from parsing so the back-office can check a single
 *  edited row without re-uploading a roster. */
export function companyError(c: Partial<CompanyDiscount>): string | null {
  if (!c.nameEn?.trim() && !c.nameAr?.trim()) return 'a company needs a name';
  const p = c.percentOff;
  if (typeof p !== 'number' || !Number.isFinite(p)) return 'discount must be a number';
  if (p <= 0) return 'a 0% discount is not an arrangement — switch the company off instead';
  if (p > 100) return 'a discount over 100% would owe the customer money';
  return null;
}
