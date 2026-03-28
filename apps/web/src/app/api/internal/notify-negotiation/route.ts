import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { notifyNegotiationRequest } from '@/lib/expo-push';

const bodySchema = z.object({
  merchantId: z.string().uuid(),
  negotiationType: z.enum(['single', 'total']),
  offeredPrice: z.number(),
  negotiationId: z.string().uuid(),
  itemName: z.string().nullable().optional(),
  currentPrice: z.number().nullable().optional(),
});

export async function POST(request: NextRequest) {
  // Auth: verify internal API secret
  const authHeader = request.headers.get('Authorization');
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    merchantId,
    negotiationType,
    offeredPrice,
    negotiationId,
    itemName,
    currentPrice,
  } = parsed.data;

  await notifyNegotiationRequest(
    merchantId,
    negotiationType,
    offeredPrice,
    negotiationId,
    itemName ?? null,
    currentPrice ?? null
  );

  return NextResponse.json({ success: true });
}
