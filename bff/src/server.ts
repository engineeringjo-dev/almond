import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { config, insecureBootReasons } from './config';
import { createBackend, type Backend } from './backend';
import { HttpError } from './http-error';
import { registerAuthRoutes } from './routes/auth';
import { registerCheckoutRoutes } from './routes/checkout';
import { registerWalletRoutes } from './routes/wallet';
import { registerLoyaltyRoutes } from './routes/loyalty';
import { registerPosRoutes } from './routes/pos';
import { registerMeRoutes } from './routes/me';
import { registerSubscriptionRoutes } from './routes/subscription';
import { registerForecastRoutes } from './routes/forecast';
import { registerCorporateRoutes } from './routes/corporate';

/**
 * `backend` is injectable ONLY so a test can build a member the routes cannot
 * mint: the ratchet — a member whose 90-day window has rolled below a threshold
 * they already crossed — takes 90 days of wall-clock to occur, and there is no
 * route that back-dates a sale. Production calls this with no argument.
 */
/**
 * WHAT A BROWSER MAY SEND US.
 *
 * 🔴 BOTH LISTS WERE SHORT BY EXACTLY WHAT THE BACK-OFFICE NEEDS, AND THE
 * FAILURE IS INVISIBLE. `x-admin-key` was missing from the headers and `PUT`
 * from the methods, while both corporate writes — saving a company and
 * replacing a roster — are `PUT` carrying that header. A browser never reaches
 * the route: the preflight fails and the caller sees an opaque network error
 * with no server log, which reads as "the server is down".
 *
 * They are named constants rather than string literals inline because that is
 * how they drifted: a route was added with a new method and header, and the two
 * literals sat in a file nobody editing routes opens.
 *
 * NOTE this widens what a BROWSER may attempt, not what is authorised. The
 * admin routes still require the shared key (plugins/adminAuth.ts), and the
 * key belongs on a server, never in a browser — the back-office calls its own
 * server, which calls us.
 */
const CORS_HEADERS = 'content-type,authorization,idempotency-key,x-pos-key,x-admin-key';
const CORS_METHODS = 'GET,POST,PUT,OPTIONS';

export async function build(backend: Backend = createBackend()): Promise<FastifyInstance> {
  // §G gate 0. Every secret below has a working development fallback, which is
  // what let `OTP_DEV_CODE = '123456'` sit in the codebase unnoticed: nothing
  // ever complained. Production now refuses to start rather than start weak.
  const insecure = insecureBootReasons();
  if (insecure.length > 0) {
    throw new Error(
      `refusing to boot in production with insecure configuration:\n  - ${insecure.join('\n  - ')}`,
    );
  }

  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(jwt, { secret: config.JWT_SECRET });

  // Minimal CORS (no extra dependency).
  const allow = config.CORS_ORIGINS.split(',').map((s) => s.trim());
  app.addHook('onRequest', async (req, reply) => {
    const origin = req.headers.origin;
    if (config.CORS_ORIGINS === '*') reply.header('access-control-allow-origin', '*');
    else if (origin && allow.includes(origin)) reply.header('access-control-allow-origin', origin);
    reply.header('access-control-allow-headers', CORS_HEADERS);
    reply.header('access-control-allow-methods', CORS_METHODS);
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

  app.get('/health', async () => ({ ok: true, dataSource: config.DATA_SOURCE }));
  registerAuthRoutes(app, backend);
  registerCheckoutRoutes(app, backend);
  registerCorporateRoutes(app, backend);
  registerWalletRoutes(app, backend);
  registerLoyaltyRoutes(app, backend);
  registerPosRoutes(app, backend);
  registerMeRoutes(app, backend);
  registerSubscriptionRoutes(app, backend);
  registerForecastRoutes(app);
  return app;
}

const isMain = !!process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  build()
    .then((app) => app.listen({ port: config.PORT, host: '0.0.0.0' }))
    .then((addr) => console.log(`Almond BFF listening on ${addr} (DATA_SOURCE=${config.DATA_SOURCE})`))
    .catch((e) => { console.error(e); process.exit(1); });
}
