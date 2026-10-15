import type { FastifyInstance } from 'fastify';
import { requireMember, memberId } from '../plugins/auth';
import { requireAdmin } from '../plugins/adminAuth';
import type { Backend } from '../backend';

/**
 * ACCOUNT DELETION (owner, 2026-10-15: «اضف حذف الحساب», «مهلة تراجع قبل
 * الحذف نعم»). What goes, what stays and when: loyalty/accountDeletion.ts.
 *
 * The member asks (POST), may withdraw (DELETE, or simply sign in again —
 * routes/auth.ts), and a back-office sweep carries out every request whose
 * grace period has run. Precedent: Apple App Store Review Guideline 5.1.1(v),
 * Google Play's account-deletion policy; Instagram and X hold a deletion for
 * 30 days and a sign-in within them cancels it.
 */
export function registerAccountDeletionRoutes(app: FastifyInstance, backend: Backend): void {
  app.get('/v1/me/deletion', { preHandler: [requireMember] }, async (req) => {
    return { deletion: await backend.getDeletion(memberId(req)) };
  });

  /** No body: the request names nothing but the member in the token. Asking
   *  again returns the pending request unchanged — the date never moves. */
  app.post('/v1/me/deletion', { preHandler: [requireMember] }, async (req) => {
    return { deletion: await backend.requestDeletion(memberId(req), new Date()) };
  });

  app.delete('/v1/me/deletion', { preHandler: [requireMember] }, async (req) => {
    return { cancelled: await backend.cancelDeletion(memberId(req)) };
  });

  /** Run by the back office on a schedule. Idempotent: a second run the same
   *  day erases nothing more. */
  app.post('/v1/admin/deletions/sweep', async (req) => {
    await requireAdmin(req);
    return { erased: await backend.eraseDueDeletions(new Date()) };
  });
}
