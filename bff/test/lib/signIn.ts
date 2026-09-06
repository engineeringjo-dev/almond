import type { FastifyInstance } from 'fastify';
import { requestOtp, normalizePhone } from '../../src/auth/otp';

/**
 * Sign a test member in.
 *
 * Every suite used to do this inline with `code: '123456'` — which is exactly
 * why §G gate 0 called the bypass load-bearing: the tests could not tell a
 * working login from a universal password, because they only ever used the
 * password. Deleting the constant turned nine of them red, and that redness is
 * the evidence that it verified every account.
 *
 * The code is obtained in-process from the same module the route uses, then
 * presented over HTTP, so the real verify path (expiry, single use, attempt
 * cap, constant-time compare) is still the thing under test.
 */
export async function signIn(app: FastifyInstance, phone: string): Promise<string> {
  const { code } = requestOtp(normalizePhone(phone));
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/otp/verify',
    payload: { phone, code },
  });
  if (res.statusCode !== 200) {
    throw new Error(`signIn(${phone}) failed: ${res.statusCode} ${res.body}`);
  }
  return res.json().token as string;
}
