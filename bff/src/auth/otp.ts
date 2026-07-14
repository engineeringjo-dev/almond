import { config } from '../config';
import { badRequest, unauthorized } from '../http-error';

/** Normalize any Jordanian phone entry to canonical +9627XXXXXXXX. */
export function normalizePhone(raw: string): string {
  let d = (raw ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '');
  if (d.startsWith('962')) d = d.slice(3);
  d = d.replace(/^0/, '');
  if (!/^7\d{8}$/.test(d)) throw badRequest('invalid Jordan phone number');
  return `+962${d}`;
}

const otps = new Map<string, { code: string; exp: number }>();

export function requestOtp(phone: string): { sent: true } {
  // DEV: fixed code. PROD: generate a random 6-digit code and send via SMS.
  otps.set(phone, { code: config.OTP_DEV_CODE, exp: Date.now() + 5 * 60_000 });
  return { sent: true };
}

export function verifyOtp(phone: string, code: string): void {
  const rec = otps.get(phone);
  const valid = (rec && rec.exp > Date.now() && rec.code === code) ||
    (config.OTP_DEV_CODE !== '' && code === config.OTP_DEV_CODE); // dev bypass
  if (!valid) throw unauthorized('invalid or expired verification code');
  otps.delete(phone);
}
