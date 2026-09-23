import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { config, insecureBootReasons } from '../src/config';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import {
  __overrideSmsSender, otpSmsText, otpTemplateError, smsProviderConfigError, smsSender,
  UnconfiguredSmsSender, type SmsSender,
} from '../src/auth/sms';
import { __resetOtpState } from '../src/auth/otp';
import { __resetRateLimits } from '../src/plugins/rateLimit';

/**
 * SMS — THE SIGN-IN TEXT. `{ sent: true }` only for a text a provider accepted;
 * 503 `sms_unavailable` with no provider; 502 `sms_failed` when it refused —
 * and a send that did not happen never counts against the member's caps.
 */

type Mutable = Record<string, unknown>;
const cfg = config as unknown as Mutable;
const saved = { NODE_ENV: config.NODE_ENV, SMS_PROVIDER: config.SMS_PROVIDER, OTP_SMS_TEMPLATE: config.OTP_SMS_TEMPLATE };

/** A provider that records what it was asked to send, and can be told to fail. */
class RecordingSender implements SmsSender {
  readonly name = 'recording';
  sent: { to: string; text: string }[] = [];
  failWith: Error | null = null;
  async send(to: string, text: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push({ to, text });
  }
}

let phoneSeq = 0;
const freshPhone = () => `079${String(4_000_000 + phoneSeq++).padStart(7, '0')}`;

beforeEach(() => { __resetOtpState(); __resetRateLimits(); });
afterEach(() => { Object.assign(cfg, saved); __overrideSmsSender(null); });

describe('SMS /v1/auth/otp/request', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await build(createMemoryBackend()); });
  afterAll(async () => { await app.close(); });
  const request = (phone: string) => app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone } });
  const verify = (phone: string, code: string) => app.inject({ method: 'POST', url: '/v1/auth/otp/verify', payload: { phone, code } });

  it('SMS.1 development default: the log sender, and { sent: true } exactly as before', async () => {
    expect(smsSender().name).toBe('log');
    const r = await request(freshPhone());
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ sent: true });
  });

  it('SMS.2 🔴 production with no provider answers 503 — never "sent" — and the attempt costs the member nothing', async () => {
    cfg.NODE_ENV = 'production';
    expect(smsSender()).toBeInstanceOf(UnconfiguredSmsSender);
    const phone = freshPhone();
    // Six in a row: if a refused send were counted, the second would be the
    // 30-second cooldown's 429 and the sixth the hourly cap's.
    for (let i = 0; i < 6; i += 1) {
      const r = await request(phone);
      expect(r.statusCode).toBe(503);
      expect(r.json().error).toBe('sms_unavailable');
    }
    cfg.NODE_ENV = saved.NODE_ENV;
    expect((await request(phone)).statusCode).toBe(200);     // no cooldown was left behind
  });

  it('SMS.3 🔴 a provider failure is 502 sms_failed, not counted, and its code is burned', async () => {
    const provider = new RecordingSender();
    provider.failWith = new Error('provider said no');
    __overrideSmsSender(provider);
    const phone = freshPhone();
    for (let i = 0; i < 6; i += 1) {
      const r = await request(phone);
      expect(r.statusCode).toBe(502);
      expect(r.json().error).toBe('sms_failed');
      expect(r.body).not.toContain('provider said no');       // the provider's error stays in our log
    }
    provider.failWith = null;
    const ok = await request(phone);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ sent: true });
    expect(provider.sent).toHaveLength(1);
    const code = /(\d{6})/.exec(provider.sent[0].text)![1];
    expect((await verify(phone, code)).statusCode).toBe(200);
  });

  it('SMS.3b the code in a text that failed to send cannot be used', async () => {
    const provider = new RecordingSender();
    // Records the text it was handed, THEN fails — as a provider that times
    // out after accepting the request would.
    provider.send = async (to, text) => { provider.sent.push({ to, text }); throw new Error('timeout'); };
    __overrideSmsSender(provider);
    const phone = freshPhone();
    expect((await request(phone)).statusCode).toBe(502);
    const code = /(\d{6})/.exec(provider.sent[0].text)![1];
    expect((await verify(phone, code)).statusCode).toBe(401);
  });

  it('SMS.4 the text is the configured Arabic-first template, with the code in it', async () => {
    const provider = new RecordingSender();
    __overrideSmsSender(provider);
    const phone = freshPhone();
    await request(phone);
    expect(provider.sent[0].to).toBe(`+962${phone.slice(1)}`);
    expect(provider.sent[0].text).toMatch(/^رمز التحقق من ألموند: \d{6}$/);
    cfg.OTP_SMS_TEMPLATE = 'Almond: {code} — ألموند';
    await request(freshPhone());
    expect(provider.sent[1].text).toMatch(/^Almond: \d{6} — ألموند$/);
    expect(otpSmsText('123456', 'a {code} b {code}')).toBe('a 123456 b 123456');
  });

  it('SMS.5 🔴 boot: production refuses the log sender; a template without {code} or an unknown provider refuses everywhere', async () => {
    const strong = {
      NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), POS_TOKEN_SECRET: 'y'.repeat(48),
      POS_SCAN_KEY: 'z'.repeat(32), ADMIN_KEY: 'w'.repeat(32), CORS_ORIGINS: 'https://almond.jo',
      DATABASE_URL: 'postgresql://x', TRUST_PROXY_SET: true,
    };
    expect(insecureBootReasons({ ...strong, SMS_PROVIDER: 'log' }).join(' | ')).toMatch(/SMS_PROVIDER is "log"/);
    expect(insecureBootReasons({ ...strong, SMS_PROVIDER: '' })).toEqual([]);
    // …and a production PROCESS never serves it, whatever the boot check said.
    cfg.NODE_ENV = 'production';
    cfg.SMS_PROVIDER = 'log';
    expect(smsSender()).toBeInstanceOf(UnconfiguredSmsSender);
    Object.assign(cfg, saved);

    expect(otpTemplateError('no code here')).toMatch(/\{code\}/);
    expect(otpTemplateError(config.OTP_SMS_TEMPLATE)).toBeNull();
    cfg.OTP_SMS_TEMPLATE = 'رمز التحقق';
    await expect(build(createMemoryBackend())).rejects.toThrow(/OTP_SMS_TEMPLATE/);
    cfg.OTP_SMS_TEMPLATE = saved.OTP_SMS_TEMPLATE;
    expect(smsProviderConfigError('twilio')).toMatch(/not a registered sender/);
    cfg.SMS_PROVIDER = 'twilio';
    await expect(build(createMemoryBackend())).rejects.toThrow(/SMS_PROVIDER "twilio"/);
  });
});
