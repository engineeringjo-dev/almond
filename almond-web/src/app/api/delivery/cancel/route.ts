import { NextResponse } from 'next/server';
import { ishbekCancel } from '@/server/ishbek';
import type { CancelParams } from '@/lib/delivery-types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
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
