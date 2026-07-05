import { NextResponse } from 'next/server';
import type { Order } from '@almond/shared/types';
import { ishbekDispatch } from '@/server/ishbek';

export const runtime = 'nodejs';

export async function POST(req: Request) {
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
