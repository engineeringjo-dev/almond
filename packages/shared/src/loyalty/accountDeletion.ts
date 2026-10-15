import { config } from '../config';

/**
 * DELETING A MEMBER'S ACCOUNT — what goes, what stays, and when.
 *
 * Owner, 2026-10-15:
 *   «اضف حذف الحساب» — the member can delete their account from the app.
 *   «مهلة تراجع قبل الحذف نعم» — with a grace period first.
 *   «عند الحذف يبقى الرصيد مربوط بالمعلومات ورقم الهاتف» and «النقاط لا تسقط
 *   الا بالموعدها» — the points and the wallet stay tied to the phone number
 *   and expire only on their own dates; deleting does not forfeit them.
 *   «لا مانع من اخفاء اسم الزبون اذا كان مشروط اما غير مشروط نبقيه كفواتير
 *   قديمة فيبقى» — past orders and invoices stay as they are.
 *
 * Precedents: Apple App Store Review Guideline 5.1.1(v) and Google Play's
 * account-deletion policy require deletion to be offered in the app (and, for
 * Google, from a web page) and allow keeping what a business must keep — here
 * the member's prepaid balance and its invoices. Instagram and X hold a
 * deletion for 30 days, and signing in within them cancels it.
 *
 * ERASED after the grace period: the profile the member gave us (name, birth
 * date, gender) and the words they wrote (rating comments).
 * KEPT: the phone number (the balance is linked to it), the points and wallet
 * lots with their own expiry dates, the points history, orders, till sales and
 * invoices. The profile bonus stamp is KEPT too, so completing the profile
 * again after returning does not pay the one-time bonus twice.
 *
 * Signing in again with the same number before the date cancels the request;
 * after it, the member returns to the same balance with an empty profile.
 */

/** A pending (not yet erased) deletion request. */
export interface AccountDeletion {
  /** ISO instant of the request. */
  requestedAt: string;
  /** ISO instant from which the profile may be erased — STORED at request
   *  time, so changing the grace period never moves a promise already made. */
  eraseAfter: string;
}

export interface DeletionRules {
  graceDays: number;
}

export function deletionRulesFromConfig(): DeletionRules {
  return { graceDays: config.ACCOUNT_DELETION_GRACE_DAYS };
}

/** The deletion a request made at `at` promises. */
export function newDeletion(at: Date, rules: DeletionRules = deletionRulesFromConfig()): AccountDeletion {
  return {
    requestedAt: at.toISOString(),
    eraseAfter: new Date(at.getTime() + rules.graceDays * 86_400_000).toISOString(),
  };
}

/** May this request be carried out at `at`? Never early, by even a moment. */
export function isDeletionDue(d: AccountDeletion, at: Date): boolean {
  return at.getTime() >= Date.parse(d.eraseAfter);
}
