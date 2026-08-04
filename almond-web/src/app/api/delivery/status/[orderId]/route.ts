import { NextResponse } from 'next/server';
import { ishbekStatus } from '@/server/ishbek';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    return NextResponse.json(await ishbekStatus(orderId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
