import { createHash } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { memberId } from './auth';
import { unauthorized } from '../http-error';
import type { Backend } from '../backend';

/**
 * Idempotency-Key support for financial POSTs (Stripe/IETF convention). A
 * client-generated UUID in the `Idempotency-Key` header makes a retried request
 * return the first response instead of charging or granting twice.
 *
 * 🔴 THE KEYS LIVE IN THE STORE, NOT IN THIS PROCESS. They used to be a
 * module-level Map: the money was durable and the memory of which request had
 * already moved it was not, so a retry after a restart — or on a second
 * instance — spent the points again and minted a second code
 * (bff/test/resilience-restart.test.ts R2.6). Now a claim is a row in the same
 * database as the money (Backend.claimIdempotencyKey), and the in-memory
 * backend keeps an in-process twin with the same semantics.
 *
 * 🔴 A KEY IS BOUND TO ONE REQUEST. The claim carries a hash of the method, the
 * route and the canonical body; the same key with a different request is 422,
 * never a replay — replaying "redeem 300" as the answer to "redeem 3000" would
 * tell the client something happened that it never asked for.
 *
 * Keys live 24 hours (backend/idempotency.ts) and are bounded to a length a
 * UUID fits in with room to spare: every key is now a row.
 */
const MAX_KEY_LENGTH = 128;

/** JSON with object keys sorted, so the hash does not depend on the order a
 *  client library happened to serialise a retry in. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

function requestHash(req: FastifyRequest): string {
  const route = (req.routeOptions?.url ?? req.url).split('?')[0];
  return createHash('sha256')
    .update(`${req.method}\n${route}\n${canonical(req.body)}`)
    .digest('hex');
}

interface Claimed { memberId: string; key: string; hash: string }
const CLAIM = Symbol('idempotency-claim');
type WithClaim = FastifyRequest & { [CLAIM]?: Claimed };

export function idempotency(backend: Backend) {
  async function preHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const key = req.headers['idempotency-key'];
    if (!key || typeof key !== 'string' || key.length > MAX_KEY_LENGTH) {
      reply.code(400).send({ error: 'idempotency_key_required', message: `Send a unique Idempotency-Key header (at most ${MAX_KEY_LENGTH} characters)` });
      return;
    }
    let who: string;
    // Every keyed route runs requireMember first; a request that reaches here
    // without a member is refused rather than keyed under a shared "anon".
    try { who = memberId(req); } catch { throw unauthorized(); }
    const hash = requestHash(req);
    const claim = await backend.claimIdempotencyKey(who, key, hash, new Date());
    switch (claim.state) {
      case 'claimed':
        (req as WithClaim)[CLAIM] = { memberId: who, key, hash };
        return;
      case 'done':
        // The stored bytes, verbatim: a replay is indistinguishable from the
        // first answer except for this header.
        reply.header('Idempotent-Replay', 'true').code(claim.statusCode)
          .type('application/json; charset=utf-8').send(claim.body);
        return;
      case 'pending':
        // Also the answer for a request whose process DIED mid-flight: it may
        // have moved money, and re-running it is the one thing that cannot be
        // undone. It stays 409 until the key expires.
        reply.code(409).send({ error: 'request_in_progress' });
        return;
      case 'mismatch':
        reply.code(422).send({
          error: 'idempotency_key_reused',
          message: 'This Idempotency-Key was already used for a different request',
        });
        return;
    }
  }

  async function onSend(req: FastifyRequest, reply: FastifyReply, payload: unknown): Promise<unknown> {
    const claim = (req as WithClaim)[CLAIM];
    if (!claim) return payload;
    (req as WithClaim)[CLAIM] = undefined;
    const body = typeof payload === 'string' ? payload
      : Buffer.isBuffer(payload) ? payload.toString('utf8') : null;
    try {
      if (reply.statusCode < 500 && body !== null) {
        await backend.completeIdempotencyKey(claim.memberId, claim.key, claim.hash, reply.statusCode, body);
      } else {
        // A server error: allow the retry, as this plugin always has. Every
        // money-moving Backend method is one transaction, so a 5xx thrown BY
        // one moved nothing. ⚠ A 5xx from a read AFTER such a method committed
        // would be re-run on retry — which is why checkout, subscribe and
        // top-up build their reply from the transaction's own result.
        await backend.releaseIdempotencyKey(claim.memberId, claim.key, claim.hash);
      }
    } catch (err) {
      // The answer still goes out: the effect has happened and the client
      // should learn it. The key stays PENDING, so a retry is refused (409)
      // rather than re-run — the failure that cannot double-spend.
      req.log.error({ err }, 'idempotency: could not record the outcome');
    }
    return payload;
  }

  return { preHandler, onSend };
}
