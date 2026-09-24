import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { normalizeJordanPhone } from '@almond/shared/lib/phone';
import { maskedDisplayName } from '@almond/shared/loyalty/profile';
import {
  transferRemainingToday, transferRulesFromConfig, type TransferKind,
} from '@almond/shared/loyalty/transfer';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { idempotency } from '../plugins/idempotency';
import { limiter, rateLimit } from '../plugins/rateLimit';
import { HttpError } from '../http-error';
import { transferRefused } from '../memberMoves';
import { config } from '../config';
import { toFils, toJod } from '../money';
import type { Backend, Member } from '../backend/types';

const previews = limiter('transfer-preview', () => config.RATE_LIMITS.transferPreviewPerMember);
const sends = limiter('transfer', () => config.RATE_LIMITS.transferPerMember);

/** JOD in whole fils, positive — the wallet never holds a fraction of one. */
const walletJod = z.number().finite().positive().max(100_000)
  .refine((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6, 'more than 3 decimals (fils)');

const sendBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('points'), phone: z.string().min(1).max(32), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('wallet'), phone: z.string().min(1).max(32), amount: walletJod }),
]);

/**
 * TRANSFERS TO A FRIEND — owner, 2026-09-24: points or wallet balance, to a
 * REGISTERED member only, with a daily cap (loyalty/transfer.ts has the rule).
 *
 *   POST /v1/me/transfers/preview  {phone} → who is that? (masked name only)
 *   POST /v1/me/transfers          {phone, kind, amount} + Idempotency-Key
 *
 * 🔴 THE RECIPIENT IS FOUND, NEVER MADE. A phone nobody has signed in with is
 * `recipient_not_found` — the same rule the in-store tablet keeps: OTP sign-in
 * is the only door into the member table, and a send that created an account
 * would let anyone open one in someone else's name.
 *
 * 🔴 THE PREVIEW SHOWS A MASKED NAME AND NOTHING ELSE — first name + initial
 * (maskedDisplayName, as /v1/pos/identify). Enough for the sender to recognise
 * their friend, not enough to turn the app into a reverse phone book; and it is
 * rate-limited per member for the same reason.
 *
 * ⚠ NO STEP-UP CONFIRMATION. There is no OTP/PIN re-confirmation mechanism in
 * this server to reuse (sign-in OTP is the only one, and there is no SMS
 * provider yet), so none is invented here: a transfer is authorised by the
 * member's session, bounded by the DAILY CAP and the rate limit. When an SMS
 * provider lands, a step-up belongs in a preHandler on POST /v1/me/transfers —
 * docs/INTEGRATIONS.md records the seam.
 */
export function registerTransferRoutes(app: FastifyInstance, backend: Backend): void {
  const idem = idempotency(backend);
  const rules = transferRulesFromConfig();

  /** What the sender may still send today, in the units a screen shows. */
  async function remainingToday(senderId: string, at: Date) {
    const day = ammanDayKey(at);
    const points = await backend.transferredOn(senderId, 'points', day);
    const fils = await backend.transferredOn(senderId, 'wallet', day);
    return {
      points: transferRemainingToday('points', points, rules),
      walletJod: toJod(transferRemainingToday('wallet', fils, rules)),
    };
  }

  /** The member behind a typed phone — or the refusal a sender sees. */
  async function recipientFor(senderId: string, rawPhone: string): Promise<Member> {
    const phone = normalizeJordanPhone(rawPhone);
    if (!phone) throw new HttpError(400, 'phone_invalid', 'not a Jordanian mobile number');
    const m = await backend.findMemberByPhone(phone);
    if (!m) throw new HttpError(404, 'recipient_not_found', 'no member has signed in with this number');
    if (m.id === senderId) throw transferRefused('transfer_to_self');
    return m;
  }

  app.post('/v1/me/transfers/preview', {
    preHandler: [requireMember, rateLimit(previews, memberId)],
  }, async (req) => {
    const id = memberId(req);
    const { phone } = parse(z.object({ phone: z.string().min(1).max(32) }), req.body);
    const recipient = await recipientFor(id, phone);
    return {
      recipientFound: true as const,
      // null when the friend has told us no name — the screen then says
      // "a member", never an invented name.
      displayName: maskedDisplayName(recipient.name),
      remainingToday: await remainingToday(id, new Date()),
    };
  });

  app.post('/v1/me/transfers', {
    preHandler: [requireMember, rateLimit(sends, memberId), idem.preHandler],
    onSend: [idem.onSend],
  }, async (req, reply) => {
    const id = memberId(req);
    const body = parse(sendBody, req.body);
    const recipient = await recipientFor(id, body.phone);
    const kind: TransferKind = body.kind;
    const at = new Date();
    // WHOLE points, or WHOLE fils — the unit the ledger holds.
    const amount = kind === 'points' ? body.amount : toFils(body.amount);
    const result = await backend.transfer({ senderId: id, recipientId: recipient.id, kind, amount, at });
    // 🔴 THE MONEY HAS MOVED — from here on nothing may become a 5xx (a 5xx
    // releases the Idempotency-Key and the retry would move it again). The
    // remaining allowance is computed from the transaction's own result, not
    // re-read.
    return reply.code(201).send({
      transferId: result.transfer.id,
      kind,
      amount: kind === 'points' ? result.transfer.amount : toJod(result.transfer.amount),
      recipientDisplayName: maskedDisplayName(recipient.name),
      pointsBalance: result.senderPointsBalance,
      walletBalance: toJod(result.senderWalletFils),
      remainingToday: kind === 'points'
        ? { kind, amount: transferRemainingToday('points', result.sentToday, rules) }
        : { kind, amount: toJod(transferRemainingToday('wallet', result.sentToday, rules)) },
    });
  });
}
