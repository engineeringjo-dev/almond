import { NextResponse } from 'next/server';
import { ishbekCancel, isLive } from '@/server/ishbek';
import { isAdmin } from '@/server/admin';
import type { CancelParams } from '@/lib/delivery-types';

export const runtime = 'nodejs';

/** Cancelling a LIVE dispatch recalls a real captain from a real customer's
 *  order, and any caller could do it with nothing but a dispatch id. Same rule
 *  as dispatch/route.ts: live mode requires the admin session. */
export async function POST(req: Request) {
  if (isLive() && !(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const params = (await req.json()) as CancelParams;
    if (!params?.dispatchId) {
      return NextResponse.json({ error: 'missing dispatchId' }, { status: 400 });
    }
    return NextResponse.json(await ishbekCancel(params));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
