import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { menuItems } from '@almond/shared/menu';
import { calendarFeatures, daypartOf } from '@almond/shared/lib/calendar';
import { parse } from '../validate';
import { requireMember } from '../plugins/auth';
import { requireAdmin } from '../plugins/adminAuth';
import { listOrderLines, historyFor, recordStockout } from '../analytics/orderLines';
import { seasonalNaive, computePar, suggestedOrder, type ItemEconomics } from '../forecasting/par';

/**
 * Phase 0 forecasting surface (docs/DEMAND-FORECASTING.md):
 * seasonal-naïve demand → newsvendor par → suggested prep order.
 * Swapping in ETS/LightGBM later only changes the mu/sigma source.
 */
export function registerForecastRoutes(app: FastifyInstance): void {
  /**
   * Raw training-data export (branch ops / analytics).
   *
   * 🔴 ADMIN, NOT MEMBER. This was `requireMember`, and every customer is a
   * member: any signed-in customer could pull up to 5,000 order lines carrying
   * OTHER customers' `memberId`, branch, item, quantity and line total. The
   * route reads like analytics and was guarded like a profile page.
   */
  app.get('/v1/analytics/order-lines', { preHandler: [requireAdmin] }, async (req) => {
    const q = req.query as { branchId?: string; since?: string; limit?: string };
    return listOrderLines({
      branchId: q.branchId,
      since: q.since,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  });

  /**
   * Record unmet demand so models don't learn censored (understated) demand.
   *
   * Stays MEMBER-guarded on purpose, unlike the export above: this is a
   * customer hitting an out-of-stock item in the app, so the customer is the
   * only one who can report it. It writes a counter and returns nothing about
   * anyone else.
   */
  app.post('/v1/analytics/stockout', { preHandler: [requireMember] }, async (req, reply) => {
    const { branchId, itemId } = parse(z.object({ branchId: z.string(), itemId: z.string() }), req.body);
    recordStockout(branchId, itemId);
    return reply.code(201).send({ recorded: true });
  });

  // Prep sheet: par + suggested order per item for a branch × daypart.
  // Branch operations, not a customer-facing figure: it states what a branch
  // should prepare tomorrow, which is a business plan, not a member's data.
  app.get('/v1/forecast/prep-sheet', { preHandler: [requireAdmin] }, async (req) => {
    const q = req.query as { branchId?: string; daypart?: string; foodCostPct?: string };
    const branchId = q.branchId ?? 'all';
    const now = new Date();
    const cal = calendarFeatures(now);
    const daypart = q.daypart ?? daypartOf(new Date().getHours());
    // Until real per-item cost lands in Odoo, derive cost from a food-cost %
    // (bakery benchmark 12–18% — see report §4.1). Override per item later.
    const foodCostPct = q.foodCostPct ? Number(q.foodCostPct) : 0.18;

    const rows = menuItems
      .filter((m) => m.inStock !== false)
      .map((m) => {
        const history = historyFor(branchId, m.id, cal.dow, daypart);
        if (history.length === 0) return null; // no signal yet — nothing to prep
        const { mu, sigma } = seasonalNaive(history);
        const price = Math.min(...m.sizes.map((s) => s.price));
        const economics: ItemEconomics = { price, cost: price * foodCostPct, salvage: 0 };
        const { par, criticalRatio } = computePar({ mu, sigma, economics });
        return {
          itemId: m.id, nameAr: m.nameAr, nameEn: m.nameEn,
          mu: Number(mu.toFixed(2)), sigma: Number(sigma.toFixed(2)),
          criticalRatio: Number(criticalRatio.toFixed(3)),
          par, suggestedOrder: suggestedOrder(par, 0),
          observations: history.length,
        };
      })
      .filter(Boolean);

    return { branchId, daypart, calendar: cal, generatedAt: new Date().toISOString(), rows };
  });
}
