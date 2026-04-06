import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { notifyNegotiationResponse } from '@/lib/negotiation-notifications';

const bodySchema = z.object({
  negotiationId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  // Auth: supports both Bearer token (mobile) and cookie-based (web)
  const {
    user,
    error: authError,
    supabase,
  } = await authenticateApiRequest(request);

  if (authError || !user || !supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permission check: caller must have orders:edit permission
  const access = await getUserAccess(supabase);
  if (!access || !hasPermission(access, 'orders', 'edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

  const { negotiationId } = parsed.data;

  // Fetch scoped by merchant_id to prevent cross-merchant access
  const { data: negotiation, error: fetchError } = await supabase
    .from('negotiation_requests')
    .select(
      'id, merchant_id, customer_id, type, item_info, offered_price, status'
    )
    .eq('id', negotiationId)
    .eq('merchant_id', access.merchantId)
    .single();

  if (fetchError || !negotiation) {
    return NextResponse.json(
      { error: 'Negotiation not found' },
      { status: 404 }
    );
  }

  // Use persisted status from DB (not client input) for notification accuracy
  const negotiationStatus = negotiation.status;
  if (negotiationStatus !== 'accepted' && negotiationStatus !== 'rejected') {
    return NextResponse.json(
      { error: 'Negotiation has not been resolved yet' },
      { status: 400 }
    );
  }

  // Guest negotiations can't receive push (no customer_id)
  if (!negotiation.customer_id) {
    return NextResponse.json({ notified: false, reason: 'no_customer_id' });
  }

  const negotiationType = negotiation.type;
  if (negotiationType !== 'single' && negotiationType !== 'total') {
    return NextResponse.json(
      { error: 'Invalid negotiation type' },
      { status: 400 }
    );
  }

  const itemName = negotiation.item_info?.name ?? null;
  const productSlug = negotiation.item_info?.slug ?? null;
  const acceptedPrice =
    negotiationStatus === 'accepted' && negotiation.offered_price != null
      ? Number(negotiation.offered_price)
      : null;

  try {
    await notifyNegotiationResponse(
      negotiation.customer_id,
      negotiationType,
      negotiationStatus,
      negotiationId,
      itemName,
      acceptedPrice,
      productSlug
    );
    return NextResponse.json({ notified: true });
  } catch (error) {
    // Use structured logging for production observability
    const { logger } = await import('@/lib/logger');
    logger.error({
      message: 'Failed to send negotiation notification',
      error,
      negotiationId,
    });
    return NextResponse.json(
      { notified: false, reason: 'notification_failed' },
      { status: 500 }
    );
  }
}
