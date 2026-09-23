import { config } from '../config';
import { serviceUnavailable } from '../http-error';

/**
 * THE SMS SEAM — the one interface a real SMS provider implements.
 *
 * 🔴 WHY IT EXISTS. /v1/auth/otp/request answered `{ sent: true }` in
 * production while nothing was sent: there was no provider, the code was
 * generated, and the member waited for a text that never came. Now the answer
 * is what happened — `{ sent: true }` only after a sender accepted the text,
 * 503 `sms_unavailable` when no provider is configured, 502 `sms_failed` when
 * the provider refused.
 *
 * Ishbek implements ONE class (start from providers/TEMPLATE.ts), registers it
 * in SMS_SENDERS below and sets SMS_PROVIDER. Nothing else changes.
 *
 * The contract a sender keeps:
 *   - `send` resolves ONLY when the provider accepted the message for delivery;
 *   - any failure THROWS (the route answers 502 and does NOT count the send
 *     against the member's hourly cap — the member did not get a code);
 *   - it never logs the text: the text contains the code.
 */
export interface SmsSender {
  readonly name: string;
  /** `to` is canonical +9627XXXXXXXX (auth/otp.ts normalizePhone). */
  send(to: string, text: string): Promise<void>;
}

/**
 * DEVELOPMENT: nothing is texted. The route writes the code to the server log
 * (`DEV OTP issued`), which is how a developer, the E2E suite and the load test
 * sign in. Refused at boot in production (config.ts insecureBootReasons).
 */
export class LogSmsSender implements SmsSender {
  readonly name = 'log';
  async send(): Promise<void> { /* the route logs the code; see routes/auth.ts */ }
}

/** PRODUCTION WITH NO PROVIDER: an honest 503, never a pretended send. */
export class UnconfiguredSmsSender implements SmsSender {
  readonly name = 'unconfigured';
  async send(): Promise<never> {
    throw serviceUnavailable('sms_unavailable', 'sign-in by SMS is not available on this server (SMS_PROVIDER is not set)');
  }
}

/** The registry. Add a real provider here with ONE line. */
export const SMS_SENDERS: Readonly<Record<string, () => SmsSender>> = {
  log: () => new LogSmsSender(),
};

const UNCONFIGURED = new UnconfiguredSmsSender();
const instances = new Map<string, SmsSender>();
let override: SmsSender | null = null;

/**
 * The sender for this request, read from config on every call:
 *   unset, outside production  → log
 *   unset, in production       → unconfigured (503)
 *   `log` in a production process → unconfigured, whatever the boot check said
 *   a registered name          → that sender
 *   anything else              → unconfigured (and providers.ts refuses to boot)
 */
export function smsSender(): SmsSender {
  if (override) return override;
  const prod = config.NODE_ENV === 'production';
  const name = config.SMS_PROVIDER || (prod ? '' : 'log');
  if (!name || (name === 'log' && prod)) return UNCONFIGURED;
  const make = Object.hasOwn(SMS_SENDERS, name) ? SMS_SENDERS[name] : undefined;
  if (!make) return UNCONFIGURED;
  let s = instances.get(name);
  if (!s) { s = make(); instances.set(name, s); }
  return s;
}

export function smsProviderConfigError(name: string = config.SMS_PROVIDER): string | null {
  if (!name || Object.hasOwn(SMS_SENDERS, name)) return null;
  return `SMS_PROVIDER "${name}" is not a registered sender (known: ${Object.keys(SMS_SENDERS).join(', ')}) — register it in bff/src/auth/sms.ts`;
}

/** The sign-in text, from config.OTP_SMS_TEMPLATE — never an inline literal. */
export function otpSmsText(code: string, template: string = config.OTP_SMS_TEMPLATE): string {
  return template.split('{code}').join(code);
}

export function otpTemplateError(template: string = config.OTP_SMS_TEMPLATE): string | null {
  return template.includes('{code}') ? null : 'OTP_SMS_TEMPLATE has no {code} placeholder — every sign-in SMS would arrive without its code';
}

/** Test-only: serve this sender regardless of config (null restores). */
export function __overrideSmsSender(s: SmsSender | null): void { override = s; }
