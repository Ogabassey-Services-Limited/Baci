import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import {
  buildServiceTypeUpdate,
  mapServiceTypeRow,
  SERVICE_TYPE_COLUMNS,
} from '@/lib/repairs/catalog-admin-mappers';
import { updateRepairServiceTypeSchema } from '@/schemas/repair-catalog-admin';

const paramsSchema = z.object({ id: z.uuid() });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authz = await authorizeRepairsRequest(request, 'edit');
  if (!authz.ok) {
    return authz.response;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json(
      { error: 'Invalid service type id' },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateRepairServiceTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = buildServiceTypeUpdate(parsed.data);
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
  }

  const { data, error } = await authz.supabase
    .from('repair_service_types')
    .update(payload)
    .eq('id', params.data.id)
    .eq('merchant_id', authz.access.merchantId)
    .select(SERVICE_TYPE_COLUMNS)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Service type not found' },
        { status: 404 }
      );
    }
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A service type with that name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update service type' },
      { status: 500 }
    );
  }

  revalidatePath('/dashboard/repairs');
  return NextResponse.json({
    serviceType: mapServiceTypeRow(data as Record<string, unknown>),
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authz = await authorizeRepairsRequest(request, 'delete');
  if (!authz.ok) {
    return authz.response;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json(
      { error: 'Invalid service type id' },
      { status: 400 }
    );
  }

  const { error } = await authz.supabase
    .from('repair_service_types')
    .delete()
    .eq('id', params.data.id)
    .eq('merchant_id', authz.access.merchantId);

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Remove the quotes using this service type first' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to delete service type' },
      { status: 500 }
    );
  }

  revalidatePath('/dashboard/repairs');
  return NextResponse.json({ success: true });
}
