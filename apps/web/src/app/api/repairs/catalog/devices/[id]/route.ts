import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidateRepairsCatalog } from '@/lib/cache-revalidation';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import {
  buildDeviceUpdate,
  DEVICE_COLUMNS,
  mapDeviceRow,
} from '@/lib/repairs/catalog-admin-mappers';
import { updateRepairDeviceSchema } from '@/schemas/repair-catalog-admin';

const paramsSchema = z.object({ id: z.uuid() });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authz = await authorizeRepairsRequest(request, 'edit');
  if (!authz.ok) {
    return authz.response;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: 'Invalid device id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateRepairDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = buildDeviceUpdate(parsed.data);
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
  }

  const { data, error } = await authz.supabase
    .from('repair_devices')
    .update(payload)
    .eq('id', params.data.id)
    .eq('merchant_id', authz.access.merchantId)
    .select(DEVICE_COLUMNS)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Linked product not found for this store' },
        { status: 400 }
      );
    }
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A device with that name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update device' },
      { status: 500 }
    );
  }

  revalidatePath('/dashboard/repairs');
  revalidateRepairsCatalog(authz.access.merchantId);
  return NextResponse.json({
    device: mapDeviceRow(data as Record<string, unknown>),
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authz = await authorizeRepairsRequest(request, 'delete');
  if (!authz.ok) {
    return authz.response;
  }

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: 'Invalid device id' }, { status: 400 });
  }

  const { data, error } = await authz.supabase
    .from('repair_devices')
    .delete()
    .eq('id', params.data.id)
    .eq('merchant_id', authz.access.merchantId)
    .select('id');

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete device' },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  revalidatePath('/dashboard/repairs');
  revalidateRepairsCatalog(authz.access.merchantId);
  return NextResponse.json({ success: true });
}
