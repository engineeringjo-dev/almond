import { NextResponse } from 'next/server';
import { ishbekQuote } from '@/server/ishbek';
import type { QuoteParams } from '@/lib/delivery-types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const params = (await req.json()) as QuoteParams;
    return NextResponse.json(await ishbekQuote(params));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
