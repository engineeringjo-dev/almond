import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { parse } from '../validate';
import { cancelOtpSend, normalizePhone, requestOtp, verifyOtp } from '../auth/otp';
import { LogSmsSender, otpSmsText, smsSender } from '../auth/sms';
import type { Backend } from '../backend';
import { HttpError, badGateway } from '../http-error';
import { limiter } from '../plugins/rateLimit';

/**
 * PER-SOURCE bounds on top of otp.ts's PER-PHONE ones. The phone caps stop a
 * guesser hammering one account; they do nothing against one guessing 5 codes
 * at each of 47,720 accounts, which is how a 6-digit code actually falls. The
 * request cap is also the SMS bill: per-phone caps never limited how many
 * DIFFERENT numbers one caller can have us text.
 */
const otpRequests = limiter('otp-request', () => config.RATE_LIMITS.otpRequestPerIp);
const otpFailures = limiter('otp-verify', () => config.RATE_LIMITS.otpFailedVerifyPerIp);

export function registerAuthRoutes(app: FastifyInstance, backend: Backend): void {
  app.post('/v1/auth/otp/request', async (req) => {
    otpRequests.take(req.ip);
    const { phone } = parse(z.object({ phone: z.string().max(64) }), req.body);
    const p = normalizePhone(phone);
    const issued = requestOtp(p);
    const { code } = issued;
    /**
     * 🔴 `{ sent: true }` ONLY FOR A TEXT THAT WAS SENT. This used to answer
     * sent in production with no SMS provider at all. Now: no provider ⇒ 503
     * `sms_unavailable`; the provider refused ⇒ 502 `sms_failed`. Either way
     * the attempt is taken back out of the phone's cooldown and hourly cap
     * (cancelOtpSend) — the member never got a code, so it must not cost them
     * one — and the code is burned.
     */
    const sender = smsSender();
    try {
      await sender.send(p, otpSmsText(code));
    } catch (err) {
      cancelOtpSend(p, issued);
      if (err instanceof HttpError && err.statusCode === 503) throw err;
      // The provider's own error stays in OUR log (it may name the account);
      // the phone learns only that sending failed. Never log the text.
      req.log.error({ provider: sender.name, err: err instanceof Error ? err.message : String(err) }, 'sms send failed');
      throw badGateway('sms_failed', 'the verification code could not be sent — try again');
    }
    // The generated code leaves this process ONLY here, only from the
    // development `log` sender, only outside production, and only into the
    // server log — never into the response body, in any environment. It is the
    // replacement for the fixed '123456' and, unlike it, a different number
    // every time and useless to anyone without log access. The E2E suite and
    // the load test read THIS line: its message and fields are a contract.
    if (sender instanceof LogSmsSender && config.NODE_ENV !== 'production') {
      req.log.warn({ phone: p, code }, 'DEV OTP issued — no SMS provider configured');
    }
    return { sent: true as const };
  });

  app.post('/v1/auth/otp/verify', async (req, reply) => {
    // Checked BEFORE the code is compared: a source that has spent its budget
    // learns nothing more, not even whether this guess was the right one.
    otpFailures.check(req.ip);
    const { phone, code, name } = parse(
      // `name` is bounded like /v1/me/profile's, for the same reason.
      z.object({ phone: z.string().max(64), code: z.string().max(16), name: z.string().max(4096).optional() }),
      req.body,
    );
    const p = normalizePhone(phone);
    try {
      verifyOtp(p, code);
    } catch (e) {
      // Only a WRONG CODE counts. Carrier NAT puts many honest phones behind
      // one address, and they succeed; a sprayer mostly fails.
      if (e instanceof HttpError && e.statusCode === 401) otpFailures.hit(req.ip);
      throw e;
    }
    const member = await backend.findOrCreateByPhone(p, name);
    // Identity is the token subject — clients never send a userId again.
    const token = app.jwt.sign({ sub: member.id }, { expiresIn: config.JWT_TTL });
    return reply.send({ token, member: { id: member.id, name: member.name, phone: member.phone } });
  });
}
