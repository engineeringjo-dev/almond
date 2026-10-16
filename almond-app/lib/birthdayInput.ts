import { formatDayKey } from '@almond/shared/lib/format';
import { toWesternDigits } from '@almond/shared/lib/phone';
import { isValidBirthday } from '@almond/shared/loyalty/profile';

/** The profile stores ISO; its editable field always reads day/month/year. */
export function birthdayInputText(iso: string): string {
  if (isValidBirthday(iso)) return formatDayKey(iso, 'en');
  // A native fallback can emit an out-of-range date when typed. Preserve its
  // parts as an invalid draft so Save rejects it rather than clearing a DOB.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/** UI syntax only; the shared profile predicate remains the calendar/age
 * authority. Null is invalid or empty, never an earlier valid draft. */
export function birthdayISOFromInput(input: string, at: Date = new Date()): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(toWesternDigits(input).trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidBirthday(iso, at) ? iso : null;
}
