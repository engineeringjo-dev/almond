import type { FastifyInstance, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  companyError, parseRoster, corporateDiscountAmount,
  type CompanyDiscount,
} from '@almond/shared/loyalty/corporate';
import { config } from '../config';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { badRequest, unauthorized } from '../http-error';
import type { Backend } from '../backend';

/**
 * THE CORPORATE REGISTER — companies, their standing discount, and who is on
 * each roster.
 *
 * Owner, 2026-09-08: «بدي القدرة على اني ارفع على الباك اوفس تاع التطبيق
 * والموقع الالكتروني قائمة الشركات وخصوماتها».
 *
 * TWO AUDIENCES, TWO CREDENTIALS, AND THE SPLIT IS THE SECURITY MODEL:
 *
 *   /v1/admin/companies*   — the back-office. Shared ADMIN_KEY header. These
 *                            routes decide who pays half price, so they are
 *                            deliberately NOT reachable with a member JWT.
 *   /v1/me/corporate       — the member. Their own entitlement, resolved from
 *                            the phone OTP proved, and nothing else.
 *
 * 🔴 A MEMBER MAY NOT NAME THEIR OWN COMPANY. There is no route that accepts a
 * company id from a member, and `entitlementFor` reads the STORED phone. The
 * one thing a client could usefully forge — "I am an Almond employee, give me
 * 50%" — has no endpoint to say it to.
 */

/** Constant-time comparison — `!==` on a secret leaks its prefix through timing. */
function keyMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** FAILS CLOSED. An unset ADMIN_KEY is a locked door, not an unlocked one —
 *  the same lesson /v1/pos/scan learned the hard way (§G gate 0). */
function requireAdmin(req: FastifyRequest): void {
  const presented = req.headers['x-admin-key'];
  if (!config.ADMIN_KEY || typeof presented !== 'string' || !keyMatches(presented, config.ADMIN_KEY)) {
    throw unauthorized('invalid admin key');
  }
}

const companyBody = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'id must be lowercase letters, digits and dashes'),
  nameAr: z.string().max(120).default(''),
  nameEn: z.string().max(120).default(''),
  percentOff: z.number(),
  active: z.boolean().default(true),
});

const rosterBody = z.object({
  /** The pasted or uploaded list: one member per line, `phone` or `phone,name`. */
  text: z.string().max(1_000_000),
});

export function registerCorporateRoutes(app: FastifyInstance, backend: Backend): void {
  // ---- Back-office ----

  app.get('/v1/admin/companies', async (req) => {
    requireAdmin(req);
    const companies = await backend.listCompanies();
    const roster = await backend.listRoster();
    // The count travels with the company because "Almond staff, 50%, 137 people"
    // is the row an administrator needs to sanity-check an upload against.
    return {
      companies: companies.map((c) => ({
        ...c, memberCount: roster.filter((e) => e.companyId === c.id).length,
      })),
    };
  });

  app.put('/v1/admin/companies', async (req, reply) => {
    requireAdmin(req);
    const body = parse(companyBody, req.body);
    // Validated with the SHARED predicate, so the back-office preview and the
    // server agree about what is refusable — including the 150% that would owe
    // the customer money.
    const err = companyError(body);
    if (err) throw badRequest(err);
    return reply.code(201).send({ company: await backend.saveCompany(body as CompanyDiscount) });
  });

  app.put('/v1/admin/companies/:id/roster', async (req, reply) => {
    requireAdmin(req);
    const { id } = parse(z.object({ id: z.string().min(1) }), req.params);
    const companies = await backend.listCompanies();
    if (!companies.some((c) => c.id === id)) throw badRequest('no such company');

    const { text } = parse(rosterBody, req.body);
    const { entries, errors } = parseRoster(text, id);
    const before = (await backend.listRoster(id)).length;
    const count = await backend.replaceRoster(id, entries);
    // 🔴 THE REJECTED LINES ARE RETURNED, NOT SWALLOWED. A 200-row upload that
    // quietly stores 180 is how a company turns up at the till expecting a
    // discount nobody can find. `before`/`after` are returned for the same
    // reason: this REPLACES a roster, and an administrator who pasted the wrong
    // column should see 137 → 2 immediately.
    return reply.code(200).send({ companyId: id, before, after: count, rejected: errors });
  });

  app.get('/v1/admin/companies/:id/roster', async (req) => {
    requireAdmin(req);
    const { id } = parse(z.object({ id: z.string().min(1) }), req.params);
    return { roster: await backend.listRoster(id) };
  });

  /**
   * The staff-drinks report — «بدي يبين عندي كل موظف شو اخذ درنك، وكم مرة
   * استخدم خصمه».
   *
   * Returns the raw uses AND a per-person roll-up, because those are two
   * different questions ("what did Ahmad take on Tuesday" vs "who is using
   * this most") and computing the second on the client would mean every caller
   * reimplementing the same group-by.
   */
  app.get('/v1/admin/corporate/uses', async (req) => {
    requireAdmin(req);
    const q = parse(z.object({
      companyId: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }), req.query ?? {});
    const uses = await backend.listCorporateUses(q);

    const byMember = new Map<string, {
      memberId: string; phone: string; companyId: string; name?: string;
      times: number; discountJod: number; items: Record<string, number>;
    }>();
    const roster = await backend.listRoster();
    for (const u of uses) {
      const row = byMember.get(u.memberId) ?? {
        memberId: u.memberId, phone: u.phone, companyId: u.companyId,
        name: roster.find((e) => e.phone === u.phone)?.name,
        times: 0, discountJod: 0, items: {},
      };
      row.times += 1;
      row.discountJod = Math.round((row.discountJod + u.discountJod) * 1000) / 1000;
      for (const it of u.items) row.items[it.nameAr || it.nameEn] = (row.items[it.nameAr || it.nameEn] ?? 0) + it.qty;
      byMember.set(u.memberId, row);
    }
    return {
      uses,
      byMember: [...byMember.values()].sort((a, b) => b.times - a.times),
    };
  });

  // ---- The member's own entitlement ----

  /**
   * What THIS member is entitled to. `{ entitlement: null }` for everyone else
   * — one shape, so the app renders the same screen either way.
   *
   * `earnsPoints: false` is stated explicitly rather than left implied: the app
   * shows it beside the discount so an employee learns the trade the first time
   * they look, instead of noticing months later that their balance never moved.
   */
  app.get('/v1/me/corporate', { preHandler: [requireMember] }, async (req) => {
    const e = await backend.entitlementFor(memberId(req));
    if (!e) return { entitlement: null };
    return {
      entitlement: {
        companyId: e.company.id,
        nameAr: e.company.nameAr,
        nameEn: e.company.nameEn,
        percentOff: e.percentOff,
        earnsPoints: false,
      },
    };
  });

  /**
   * What a given basket total would cost them. A read: it moves nothing and
   * logs nothing, so the cart can call it on every keystroke.
   */
  app.post('/v1/me/corporate/quote', { preHandler: [requireMember] }, async (req) => {
    const { subtotal } = parse(z.object({ subtotal: z.number() }), req.body);
    const e = await backend.entitlementFor(memberId(req));
    const discount = e ? corporateDiscountAmount(subtotal, e.percentOff) : 0;
    return {
      subtotal,
      percentOff: e?.percentOff ?? 0,
      discount,
      payable: Math.round((subtotal - discount) * 1000) / 1000,
      earnsPoints: !e,
    };
  });
}
