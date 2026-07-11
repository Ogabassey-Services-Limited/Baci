import { type NextRequest, NextResponse } from 'next/server';
import {
  BOOKING_LIST_COLUMNS,
  mapBookingRow,
} from '@/lib/repairs/booking-mappers';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import { createClient } from '@/lib/supabase/admin';
import { repairBookingsListQuerySchema } from '@/schemas/repair-bookings';

// Dashboard bookings list. Auth-first (repairs.view), tenant-scoped, explicit
// columns. Uses the service-role client AFTER the permission check (Phase 2
// pattern) and always filters by the caller's own merchant id.

export async function GET(request: NextRequest) {
  const authz = await authorizeRepairsRequest(request, 'view');
  if (!authz.ok) {
    return authz.response;
  }

  const url = new URL(request.url);
  const parsed = repairBookingsListQuerySchema.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { status, q, limit, offset } = parsed.data;
  const admin = createClient();
  let query = admin
    .from('repairs')
    .select(BOOKING_LIST_COLUMNS, { count: 'exact' })
    .eq('merchant_id', authz.access.merchantId);

  if (status) {
    query = query.eq('status', status);
  }
  if (q) {
    query = /^\d+$/.test(q)
      ? query.eq('ticket_number', Number(q))
      : query.ilike('device_model', `%${q}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load bookings' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    bookings: ((data ?? []) as Record<string, unknown>[]).map(mapBookingRow),
    total: count ?? 0,
  });
}
