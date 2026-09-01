import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { bookRepairPickup } from '@/lib/repairs/book-repair-pickup';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import { createClient } from '@/lib/supabase/admin';
import { repairPickupRequestSchema } from '@/schemas/repair-bookings';

const idSchema = z.uuid();

type RouteContext = { params: Promise<{ id: string }> };

type ManualPickupOutcome = 'recorded' | 'not_found' | 'error';

/**
 * Records a manual pickup arrangement (the merchant handles logistics offline)
 * by appending an admin note. Used as the fallback when courier booking is
 * unavailable.
 *
 * Distinguishes a genuinely absent booking (`not_found`) from a database/RLS
 * failure (`error`) so a real fault is surfaced as a server error rather than
 * masquerading as a missing booking, and only reports `recorded` once the note
 * write has actually persisted.
 */
async function recordManualPickup(
  admin: ReturnType<typeof createClient>,
  merchantId: string,
  repairId: string
): Promise<ManualPickupOutcome> {
  const { data, error } = await admin
    .from('repairs')
    .select('admin_notes')
    .eq('id', repairId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) {
    logger.error({
      message: 'recordManualPickup: booking lookup failed',
      repairId,
      merchantId,
      error,
    });
    return 'error';
  }
  if (!data) {
    return 'not_found';
  }

  const existing =
    typeof (data as { admin_notes?: unknown }).admin_notes === 'string'
      ? ((data as { admin_notes: string }).admin_notes as string)
      : '';
  const note = `${existing ? `${existing}\n` : ''}[${new Date().toISOString()}] Pickup arranged manually.`;

  const { error: updateError } = await admin
    .from('repairs')
    .update({ admin_notes: note, updated_at: new Date().toISOString() })
    .eq('id', repairId)
    .eq('merchant_id', merchantId);

  if (updateError) {
    logger.error({
      message: 'recordManualPickup: note write failed',
      repairId,
      merchantId,
      error: updateError,
    });
    return 'error';
  }

  return 'recorded';
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const authz = await authorizeRepairsRequest(request, 'edit');
  if (!authz.ok) {
    return authz.response;
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  // An empty body is valid (mode defaults to 'auto'); malformed JSON is not —
  // otherwise bad input silently books a paid GIGL pickup instead of 400ing.
  let body: unknown = {};
  const rawBody = await request.text();
  if (rawBody.trim().length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
  }
  const parsed = repairPickupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const admin = createClient();

  if (parsed.data.mode === 'manual') {
    const outcome = await recordManualPickup(
      admin,
      authz.access.merchantId,
      id
    );
    if (outcome === 'not_found') {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    if (outcome === 'error') {
      return NextResponse.json(
        { error: 'Failed to record manual pickup' },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, manual: true });
  }

  const result = await bookRepairPickup(admin, authz.access.merchantId, id);
  if (!result.ok && result.reason === 'not_found') {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }

  return NextResponse.json({ result });
}
