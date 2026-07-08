import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import {
  buildQuoteInsert,
  mapQuoteRow,
  QUOTE_ADMIN_COLUMNS,
} from '@/lib/repairs/catalog-admin-mappers';
import { createClient } from '@/lib/supabase/admin';
import { createRepairQuoteSchema } from '@/schemas/repair-catalog-admin';

// Quotes carry internal_notes, which is excluded from the authenticated column
// grant — so dashboard reads/writes use the service-role client AFTER the route
// permission check, always scoped by the caller's own merchant id.

const deviceIdSchema = z.uuid();

export async function GET(request: NextRequest) {
  const authz = await authorizeRepairsRequest(request, 'view');
  if (!authz.ok) {
    return authz.response;
  }

  const rawDeviceId = new URL(request.url).searchParams.get('deviceId');
  let deviceId: string | null = null;
  if (rawDeviceId !== null) {
    const parsed = deviceIdSchema.safeParse(rawDeviceId);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid device id' }, { status: 400 });
    }
    deviceId = parsed.data;
  }

  const admin = createClient();
  let query = admin
    .from('repair_quotes')
    .select(QUOTE_ADMIN_COLUMNS)
    .eq('merchant_id', authz.access.merchantId);
  if (deviceId) {
    query = query.eq('device_id', deviceId);
  }

  const { data, error } = await query.order('price', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load quotes' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    quotes: ((data ?? []) as Record<string, unknown>[]).map(mapQuoteRow),
  });
}

export async function POST(request: NextRequest) {
  const authz = await authorizeRepairsRequest(request, 'edit');
  if (!authz.ok) {
    return authz.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createRepairQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createClient();
  const { data, error } = await admin
    .from('repair_quotes')
    .insert(buildQuoteInsert(parsed.data, authz.access.merchantId))
    .select(QUOTE_ADMIN_COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A quote for this service and part quality already exists' },
        { status: 409 }
      );
    }
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Device or service type not found for this store' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create quote' },
      { status: 500 }
    );
  }

  revalidatePath('/dashboard/repairs');
  return NextResponse.json(
    { quote: mapQuoteRow(data as Record<string, unknown>) },
    { status: 201 }
  );
}
