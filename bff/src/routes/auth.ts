import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { parse } from '../validate';
import { normalizePhone, requestOtp, verifyOtp } from '../auth/otp';
import type { Backend } from '../backend';

export function registerAuthRoutes(app: FastifyInstance, backend: Backend): void {
  app.post('/v1/auth/otp/request', async (req) => {
    const { phone } = parse(z.object({ phone: z.string() }), req.body);
    return requestOtp(normalizePhone(phone));
  });

  app.post('/v1/auth/otp/verify', async (req, reply) => {
    const { phone, code, name } = parse(
      z.object({ phone: z.string(), code: z.string(), name: z.string().optional() }),
      req.body,
    );
    const p = normalizePhone(phone);
    verifyOtp(p, code);
    const member = await backend.findOrCreateByPhone(p, name);
    // Identity is the token subject — clients never send a userId again.
    const token = app.jwt.sign({ sub: member.id }, { expiresIn: config.JWT_TTL });
    return reply.send({ token, member: { id: member.id, name: member.name, phone: member.phone } });
  });
}
