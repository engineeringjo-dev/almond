import { NextResponse } from 'next/server';
import { ishbekStatus, isLive } from '@/server/ishbek';
import { isAdmin } from '@/server/admin';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  // A live status read spends the Ishbek key on an order id the caller names.
  // Nothing in the site calls this for a customer yet; staff only, like
  // dispatch/route.ts, until a customer can prove the order is theirs.
  if (isLive() && !(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const { orderId } = await params;
    return NextResponse.json(await ishbekStatus(orderId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
