import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInternalApiSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { logger } from '@/lib/logger';
import { notifyNegotiationRequest } from '@/lib/negotiation-notifications';

const sharedFields = {
  merchantId: z.string().uuid(),
  offeredPrice: z.number().positive(),
  negotiationId: z.string().uuid(),
};

const bodySchema = z.discriminatedUnion('negotiationType', [
  z.object({
    ...sharedFields,
    negotiationType: z.literal('single'),
    itemName: z.string(),
    currentPrice: z.number().positive(),
  }),
  z.object({
    ...sharedFields,
    negotiationType: z.literal('total'),
    itemName: z.string().nullable().optional(),
    currentPrice: z.number().nullable().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  // Auth: verify internal API secret (timing-safe comparison)
  const authHeader = request.headers.get('Authorization');
  const expectedSecret = getInternalApiSecret();

  if (!expectedSecret) {
    logger.error({ message: 'INTERNAL_API_SECRET not configured' });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }

  const expectedToken = `Bearer ${expectedSecret}`;
  if (!authHeader || !constantTimeEqual(authHeader, expectedToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

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

  try {
    await notifyNegotiationRequest(
      merchantId,
      negotiationType,
      offeredPrice,
      negotiationId,
      itemName ?? null,
      currentPrice ?? null
    );
  } catch (error) {
    logger.error({ message: 'Failed to send negotiation notification', error });
    return NextResponse.json(
      { error: 'Notification delivery failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
