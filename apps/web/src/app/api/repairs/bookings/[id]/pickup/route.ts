import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { bookRepairPickup } from '@/lib/repairs/book-repair-pickup';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import { createClient } from '@/lib/supabase/admin';
import { repairPickupRequestSchema } from '@/schemas/repair-bookings';

const idSchema = z.uuid();

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Records a manual pickup arrangement (the merchant handles logistics offline)
 * by appending an admin note. Used as the fallback when courier booking is
 * unavailable. Returns whether the booking exists.
 */
async function recordManualPickup(
  admin: ReturnType<typeof createClient>,
  merchantId: string,
  repairId: string
): Promise<boolean> {
  const { data } = await admin
    .from('repairs')
    .select('admin_notes')
    .eq('id', repairId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (!data) {
    return false;
  }

  const existing =
    typeof (data as { admin_notes?: unknown }).admin_notes === 'string'
      ? ((data as { admin_notes: string }).admin_notes as string)
      : '';
  const note = `${existing ? `${existing}\n` : ''}[${new Date().toISOString()}] Pickup arranged manually.`;

  await admin
    .from('repairs')
    .update({ admin_notes: note, updated_at: new Date().toISOString() })
    .eq('id', repairId)
    .eq('merchant_id', merchantId);

  return true;
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

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = repairPickupRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const admin = createClient();

  if (parsed.data.mode === 'manual') {
    const found = await recordManualPickup(admin, authz.access.merchantId, id);
    if (!found) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, manual: true });
  }

  const result = await bookRepairPickup(admin, authz.access.merchantId, id);
  if (!result.ok && result.reason === 'not_found') {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }

  return NextResponse.json({ result });
}
