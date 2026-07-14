import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { config } from './config';
import { createBackend } from './backend';
import { HttpError } from './http-error';
import { registerAuthRoutes } from './routes/auth';
import { registerCheckoutRoutes } from './routes/checkout';
import { registerWalletRoutes } from './routes/wallet';
import { registerLoyaltyRoutes } from './routes/loyalty';
import { registerPosRoutes } from './routes/pos';
import { registerMeRoutes } from './routes/me';

export async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(jwt, { secret: config.JWT_SECRET });

  // Minimal CORS (no extra dependency).
  const allow = config.CORS_ORIGINS.split(',').map((s) => s.trim());
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (config.CORS_ORIGINS === '*') reply.header('access-control-allow-origin', '*');
    else if (origin && allow.includes(origin)) reply.header('access-control-allow-origin', origin);
    reply.header('access-control-allow-headers', 'content-type,authorization,idempotency-key,x-pos-key');
    reply.header('access-control-allow-methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return reply.code(204).send();
  });

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.statusCode).send({ error: err.code, message: err.message });
    const e = err as { statusCode?: number; code?: string };
    if (e.statusCode === 401 || (e.code ?? '').startsWith('FST_JWT')) {
      return reply.code(401).send({ error: 'unauthorized', message: err.message });
    }
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: e.code ?? 'error', message: err.message });
    req.log.error(err);
    return reply.code(500).send({ error: 'internal', message: 'Internal error' });
  });

  const backend = createBackend();
  app.get('/health', async () => ({ ok: true, dataSource: config.DATA_SOURCE }));
  registerAuthRoutes(app, backend);
  registerCheckoutRoutes(app, backend);
  registerWalletRoutes(app, backend);
  registerLoyaltyRoutes(app, backend);
  registerPosRoutes(app, backend);
  registerMeRoutes(app, backend);
  return app;
}

const isMain = !!process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  build()
    .then((app) => app.listen({ port: config.PORT, host: '0.0.0.0' }))
    .then((addr) => console.log(`Almond BFF listening on ${addr} (DATA_SOURCE=${config.DATA_SOURCE})`))
    .catch((e) => { console.error(e); process.exit(1); });
}
