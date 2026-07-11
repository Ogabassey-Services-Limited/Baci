import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  BOOKING_DETAIL_COLUMNS,
  mapBookingDetail,
} from '@/lib/repairs/booking-mappers';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import { notifyRepairStatusChange } from '@/lib/repairs/notify-repair-status-change';
import {
  canTransitionRepairStatus,
  isRepairStatus,
} from '@/lib/repairs/repair-status';
import { createClient } from '@/lib/supabase/admin';
import { updateRepairBookingSchema } from '@/schemas/repair-bookings';

const idSchema = z.uuid();

type RouteContext = { params: Promise<{ id: string }> };

async function loadTrackingNumber(
  admin: ReturnType<typeof createClient>,
  merchantId: string,
  shipmentId: unknown
): Promise<string | null> {
  if (typeof shipmentId !== 'string') {
    return null;
  }
  const { data } = await admin
    .from('shipments')
    .select('tracking_number')
    .eq('id', shipmentId)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  const tracking = (data as { tracking_number?: unknown } | null)
    ?.tracking_number;
  return typeof tracking === 'string' ? tracking : null;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const authz = await authorizeRepairsRequest(request, 'view');
  if (!authz.ok) {
    return authz.response;
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  const admin = createClient();
  const { data, error } = await admin
    .from('repairs')
    .select(BOOKING_DETAIL_COLUMNS)
    .eq('id', id)
    .eq('merchant_id', authz.access.merchantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load booking' },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const row = data as Record<string, unknown>;
  const tracking = await loadTrackingNumber(
    admin,
    authz.access.merchantId,
    row.shipment_id
  );

  return NextResponse.json({ booking: mapBookingDetail(row, tracking) });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const authz = await authorizeRepairsRequest(request, 'edit');
  if (!authz.ok) {
    return authz.response;
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid booking id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateRepairBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createClient();
  const { data: current, error: loadError } = await admin
    .from('repairs')
    .select(
      'id, status, ticket_number, customer_name, customer_email, device_type, device_model'
    )
    .eq('id', id)
    .eq('merchant_id', authz.access.merchantId)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json(
      { error: 'Failed to load booking' },
      { status: 500 }
    );
  }
  if (!current) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const currentRow = current as Record<string, unknown>;
  const currentStatus = isRepairStatus(currentRow.status)
    ? currentRow.status
    : 'pending';
  const nextStatus = parsed.data.status;
  const statusChanged =
    nextStatus !== undefined && nextStatus !== currentStatus;

  if (statusChanged && !canTransitionRepairStatus(currentStatus, nextStatus)) {
    return NextResponse.json(
      { error: `Cannot change status from ${currentStatus} to ${nextStatus}` },
      { status: 409 }
    );
  }

  let updateQuery = admin
    .from('repairs')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('merchant_id', authz.access.merchantId);

  // Optimistic concurrency: whenever the request carries a status (even one
  // equal to the current value), only write if the row is still in the status we
  // read. This blocks both the transition case (read `pending`, write
  // `confirmed` over a concurrent cancel) AND the equal-status resend case (a
  // whole-form save that re-sends `pending` and would otherwise revert a
  // concurrent terminal transition). Pure cost/notes edits stay unguarded.
  if (nextStatus !== undefined) {
    updateQuery = updateQuery.eq('status', currentStatus);
  }

  const { data: updated, error: updateError } = await updateQuery
    .select(BOOKING_DETAIL_COLUMNS)
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    );
  }
  if (!updated) {
    // The booking exists (loaded above) but no row matched the status guard —
    // another request changed its status first. Ask the client to reload.
    return NextResponse.json(
      {
        error: 'Booking was updated by another request. Reload and try again.',
        code: 'status_conflict',
      },
      { status: 409 }
    );
  }

  const updatedRow = updated as Record<string, unknown>;
  // Load the courier tracking number BEFORE notifying so the status email can
  // include the pickup tracking CTA (the shipment id is unchanged by a status
  // edit, so this is the same value returned to the client below).
  const tracking = await loadTrackingNumber(
    admin,
    authz.access.merchantId,
    updatedRow.shipment_id
  );

  if (statusChanged) {
    // Best-effort; notify* never throws, so it cannot fail the update.
    await notifyRepairStatusChange({
      merchantId: authz.access.merchantId,
      repairId: id,
      ticketNumber: Number(currentRow.ticket_number),
      customerName:
        typeof currentRow.customer_name === 'string'
          ? currentRow.customer_name
          : 'Customer',
      customerEmail:
        typeof currentRow.customer_email === 'string'
          ? currentRow.customer_email
          : '',
      deviceLabel:
        `${currentRow.device_type ?? ''} ${currentRow.device_model ?? ''}`.trim() ||
        'Device',
      status: nextStatus,
      trackingNumber: tracking,
    });
  }

  return NextResponse.json({ booking: mapBookingDetail(updatedRow, tracking) });
}
