import { NextResponse } from 'next/server';
import type { Order } from '@almond/shared/types';
import { ishbekDispatch, isLive } from '@/server/ishbek';
import { isAdmin } from '@/server/admin';

export const runtime = 'nodejs';

/**
 * 🔴 NOBODY WAS ASKED WHO THEY WERE. This handler spends Almond's Ishbek key —
 * a real Careem/Talabat captain, at Almond's cost — for any caller on the
 * internet, on an `order` the CALLER wrote (items, prices, branch, customer):
 *
 *   curl -X POST https://<site>/api/delivery/dispatch \
 *     -H 'content-type: application/json' -d '{"order":{"id":"x","branchId":"b1","items":[]}}'
 *
 * The website has no member session and no payment (data/payment.ts throws
 * under 'odoo'), so no browser request can prove there is a paid order behind
 * it. Live dispatch therefore belongs to a server that has seen the payment
 * (Odoo, when the order is settled) or to back-office staff; until that is
 * wired, live mode requires the admin session. Mock mode answers locally and
 * spends nothing, so the demo site keeps working.
 */
export async function POST(req: Request) {
  if (isLive() && !(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const { order } = (await req.json()) as { order: Order };
    if (!order?.id) {
      return NextResponse.json({ error: 'missing order' }, { status: 400 });
    }
    return NextResponse.json(await ishbekDispatch(order));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
