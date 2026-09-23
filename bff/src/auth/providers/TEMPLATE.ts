/**
 * ════════════════════════════════════════════════════════════════════════════
 *  TEMPLATE — a real SMS provider for sign-in codes.  NOT REGISTERED.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * For Ishbek. Copy to `providers/<provider>.ts` (a Jordanian aggregator —
 * e.g. the operator's bulk-SMS API, or an international one with a JO route),
 * implement `send`, and register it in `bff/src/auth/sms.ts`:
 *
 *     export const SMS_SENDERS = {
 *       log: () => new LogSmsSender(),
 *       jo_sms: () => new JoSmsSender(),                  // ← one line
 *     };
 *
 * Server environment (never in an app or web bundle):
 *
 *     SMS_PROVIDER=jo_sms
 *     SMS_API_URL=https://…                  the provider's send endpoint
 *     SMS_API_KEY=…                          SECRET
 *     SMS_SENDER_ID=Almond                   see the TRC note below
 *     OTP_SMS_TEMPLATE='رمز التحقق من ألموند: {code}'   (already the default)
 *
 * 🇯🇴 SENDER ID (TRC). Jordan's Telecommunications Regulatory Commission
 * requires an alphanumeric Sender ID to be REGISTERED (through the provider)
 * before operators deliver it; an unregistered one is silently dropped or
 * rewritten by Zain / Orange / Umniah. Register "Almond" (or the brand the
 * owner chooses) for the TRANSACTIONAL/OTP category before go-live, and test
 * delivery on all three networks — a 200 from the provider is not a delivered
 * text.
 *
 * ARABIC TEXT. The message is Arabic first, so it is sent as UCS-2/Unicode
 * (most APIs: `unicode=1`, `type=unicode` or `coding=8`). A Unicode SMS holds
 * 70 characters per part; the default template is well inside one part — keep
 * it that way (a split OTP costs double and can arrive out of order).
 *
 * THE CONTRACT (bff/src/auth/sms.ts):
 *   - resolve ONLY when the provider accepted the message (HTTP 2xx AND the
 *     provider's own success code in the body — many answer 200 with an error);
 *   - on anything else THROW. The route answers 502 `sms_failed` and does not
 *     count the attempt against the member's hourly send cap;
 *   - never log `text` or the full response body — it contains the code;
 *   - use a timeout (AbortSignal.timeout(8_000)): a hung provider must not hold
 *     the sign-in request open.
 *   - `to` arrives canonical: +9627XXXXXXXX. Strip the '+' if the API wants
 *     9627XXXXXXXX.
 */
import type { SmsSender } from '../sms';

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — the SMS provider cannot be called`);
  return v;
}

export class TemplateSmsSender implements SmsSender {
  readonly name = 'template';

  async send(_to: string, _text: string): Promise<void> {
    // const url = requiredEnv('SMS_API_URL');
    // const key = requiredEnv('SMS_API_KEY');
    // const sender = requiredEnv('SMS_SENDER_ID');
    // const res = await fetch(url, {
    //   method: 'POST',
    //   headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    //   body: JSON.stringify({ to: to.replace(/^\+/, ''), from: sender, text, unicode: true }),
    //   signal: AbortSignal.timeout(8_000),
    // });
    // if (!res.ok) throw new Error(`sms provider answered ${res.status}`);
    // const body = await res.json() as { status?: string };
    // if (body.status !== 'accepted') throw new Error(`sms provider refused: ${body.status}`);
    void requiredEnv;
    throw new Error('not implemented');
  }
}
