import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidateRepairsCatalog } from '@/lib/cache-revalidation';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import {
  buildQuoteUpdate,
  mapQuoteRow,
  QUOTE_ADMIN_COLUMNS,
} from '@/lib/repairs/catalog-admin-mappers';
import { createClient } from '@/lib/supabase/admin';
import { updateRepairQuoteSchema } from '@/schemas/repair-catalog-admin';

const paramsSchema = z.object({ id: z.uuid() });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authz = await authorizeRepairsRequest(request, 'edit');
  if (!authz.ok) {
    return authz.response;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: 'Invalid quote id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateRepairQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = buildQuoteUpdate(parsed.data);
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
  }

  const admin = createClient();
  const { data, error } = await admin
    .from('repair_quotes')
    .update(payload)
    .eq('id', params.data.id)
    .eq('merchant_id', authz.access.merchantId)
    .select(QUOTE_ADMIN_COLUMNS)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
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
      { error: 'Failed to update quote' },
      { status: 500 }
    );
  }

  revalidatePath('/dashboard/repairs');
  revalidateRepairsCatalog(authz.access.merchantId);
  return NextResponse.json({
    quote: mapQuoteRow(data as Record<string, unknown>),
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authz = await authorizeRepairsRequest(request, 'delete');
  if (!authz.ok) {
    return authz.response;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: 'Invalid quote id' }, { status: 400 });
  }

  const admin = createClient();
  const { error } = await admin
    .from('repair_quotes')
    .delete()
    .eq('id', params.data.id)
    .eq('merchant_id', authz.access.merchantId);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete quote' },
      { status: 500 }
    );
  }

  revalidatePath('/dashboard/repairs');
  revalidateRepairsCatalog(authz.access.merchantId);
  return NextResponse.json({ success: true });
}
