import type { User } from '@/types';
import { config } from '@/constants/config';
import { delay, genId } from './util';

export interface AuthService {
  /** Send a 6-digit OTP to a +962 phone (section 2.1). */
  sendOtp(phone: string): Promise<{ sent: boolean }>;
  /** Verify the OTP and return the user. */
  verifyOtp(phone: string, code: string): Promise<User>;
}

// DECISION: mock accepts the canonical demo code 123456 (any 6 digits in dev).
const MOCK_OTP = '123456';

const mockAuthService: AuthService = {
  sendOtp: (_phone) => delay({ sent: true }),
  verifyOtp: (phone, code) => {
    if (code.length !== 6 || (code !== MOCK_OTP && !/^\d{6}$/.test(code))) {
      return Promise.reject(new Error('Invalid OTP'));
    }
    const user: User = {
      id: genId('user'),
      phone,
      // 🔴 EMPTY, AND NEVER A LITERAL. This used to be 'ضيف ألموند', which the
      // home greeting then interpolated into whatever language the UI was in:
      // an English member saw "Good evening, ضيف ألموند". A display name is a
      // fact about a PERSON, so it has no translation and cannot be invented —
      // and a name the app made up is not a name, it is a label, and a label
      // belongs in the locale files where both languages exist.
      //
      // OTP verification learns a PHONE NUMBER and nothing else. Odoo will fill
      // this in from the real customer record; until then it is honestly blank,
      // and every consumer falls back to the localized `home.guest`.
      name: '',
      isGuest: false,
    };
    return delay(user);
  },
};

const odooAuthService: AuthService = {
  // TODO: confirm Odoo/loyalty auth endpoints for OTP send/verify.
  sendOtp: mockAuthService.sendOtp,
  verifyOtp: mockAuthService.verifyOtp,
};

export const authService: AuthService =
  config.DATA_SOURCE === 'odoo' ? odooAuthService : mockAuthService;
