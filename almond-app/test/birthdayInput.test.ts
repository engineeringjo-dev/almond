import { describe, expect, it } from 'vitest';
import { birthdayInputText, birthdayISOFromInput } from '@/lib/birthdayInput';

const NOW = new Date('2026-12-31T21:30:00Z'); // Already 1 January in Amman.

describe('the birthday field displays day/month/year and saves canonical ISO', () => {
  it('does not confuse a day and month that both fit in a month slot', () => {
    expect(birthdayInputText('1991-04-07')).toBe('07/04/1991');
    expect(birthdayISOFromInput('07/04/1991', NOW)).toBe('1991-04-07');
    expect(birthdayISOFromInput('04/07/1991', NOW)).toBe('1991-07-04');
  });

  it('accepts real leap days and folds Arabic-Indic input into the same ISO contract', () => {
    expect(birthdayISOFromInput('29/02/2000', NOW)).toBe('2000-02-29');
    expect(birthdayISOFromInput('٢٩/٠٢/٢٠٠٠', NOW)).toBe('2000-02-29');
    expect(birthdayISOFromInput('۲۹/۰۲/۲۰۰۰', NOW)).toBe('2000-02-29');
  });

  it.each(['31/02/2000', '29/02/1900', '31/04/2000', '00/11/1990', '15/13/1990', '15/11/1899', '15/11/2999', '15/11/', '1990-11-15', ''])('rejects invalid or incomplete draft %s', (draft) => {
    expect(birthdayISOFromInput(draft, NOW)).toBeNull();
  });

  it('does not return the previous valid date after the customer makes the draft invalid', () => {
    expect(birthdayISOFromInput('15/11/1990', NOW)).toBe('1990-11-15');
    expect(birthdayISOFromInput('31/02/1990', NOW)).toBeNull();
    expect(birthdayISOFromInput('31/02/', NOW)).toBeNull();
  });

  it('retains invalid native calendar text for correction instead of silently clearing it', () => {
    expect(birthdayInputText('2999-11-15')).toBe('15/11/2999');
    expect(birthdayInputText('1990-02-31')).toBe('31/02/1990');
    expect(birthdayInputText('')).toBe('');
    expect(birthdayISOFromInput(birthdayInputText('2999-11-15'), NOW)).toBeNull();
  });

  it('uses the shared Amman birthday limit rather than the host UTC calendar day', () => {
    expect(birthdayISOFromInput('01/01/2027', NOW)).toBe('2027-01-01');
    expect(birthdayISOFromInput('02/01/2027', NOW)).toBeNull();
  });
});
