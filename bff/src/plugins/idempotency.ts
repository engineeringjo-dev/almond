import type { FastifyReply, FastifyRequest } from 'fastify';
import { memberId } from './auth';

/** Idempotency-Key support for financial POSTs (Stripe/IETF convention).
 *  A client-generated UUID in the `Idempotency-Key` header makes a retried
 *  request return the first response instead of charging/granting twice.
 *  In-memory store — swap for Redis (with TTL) in production. */
type Entry = { status: 'pending' | 'done'; code?: number; body?: unknown; at: number };
const store = new Map<string, Entry>();

/**
 * 🔴 THE STORE USED TO GROW FOREVER. `at` was written on every entry and read
 * by nothing, so every financial POST ever made stayed in memory — and a member
 * sending a fresh key per request (which is what the header is FOR) could grow
 * it as fast as they could send, each key up to the 16 KB header limit. Entries
 * now live 24 hours (Stripe's replay window) and the key is bounded to a length
 * a UUID fits in with room to spare.
 */
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_KEY_LENGTH = 128;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, e] of store) if (now - e.at > TTL_MS) store.delete(k);
}

function keyFor(req: FastifyRequest): string | null {
  const k = req.headers['idempotency-key'];
  if (!k || typeof k !== 'string' || k.length > MAX_KEY_LENGTH) return null;
  let who = 'anon';
  try { who = memberId(req); } catch { /* unauthenticated */ }
  const url = (req.routeOptions?.url ?? req.url).split('?')[0];
  return `${who}:${req.method}:${url}:${k}`;
}

export async function idempotencyPreHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = keyFor(req);
  if (!key) {
    reply.code(400).send({ error: 'idempotency_key_required', message: `Send a unique Idempotency-Key header (at most ${MAX_KEY_LENGTH} characters)` });
    return;
  }
  const now = Date.now();
  sweep(now);
  const found = store.get(key);
  const hit = found && now - found.at <= TTL_MS ? found : undefined;
  if (hit?.status === 'done') {
    reply.header('Idempotent-Replay', 'true').code(hit.code ?? 200).send(hit.body);
    return;
  }
  if (hit?.status === 'pending') {
    reply.code(409).send({ error: 'request_in_progress' });
    return;
  }
  store.set(key, { status: 'pending', at: Date.now() });
  (req as unknown as { _idemKey?: string })._idemKey = key;
}

export function idempotencyOnSend(req: FastifyRequest, reply: FastifyReply, payload: unknown, done: (err: Error | null, p?: unknown) => void): void {
  const key = (req as unknown as { _idemKey?: string })._idemKey;
  if (key) {
    if (reply.statusCode < 500) {
      let body: unknown = payload;
      if (typeof payload === 'string') { try { body = JSON.parse(payload); } catch { /* keep string */ } }
      store.set(key, { status: 'done', code: reply.statusCode, body, at: Date.now() });
    } else {
      store.delete(key); // allow retry after a server error
    }
  }
  done(null, payload);
}
