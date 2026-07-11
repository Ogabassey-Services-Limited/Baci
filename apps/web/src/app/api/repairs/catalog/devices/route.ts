import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { revalidateRepairsCatalog } from '@/lib/cache-revalidation';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import {
  buildDeviceInsert,
  DEVICE_COLUMNS,
  mapDeviceRow,
  type RepairDeviceAdmin,
} from '@/lib/repairs/catalog-admin-mappers';
import { loadTakenSlugs } from '@/lib/repairs/catalog-admin-slugs';
import { buildDeviceSlug, nextAvailableSlug } from '@/lib/repairs/catalog-slug';
import { createRepairDeviceSchema } from '@/schemas/repair-catalog-admin';

function matchesQuery(device: RepairDeviceAdmin, query: string): boolean {
  const haystack = [device.brand, device.model, ...device.aliases]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export async function GET(request: NextRequest) {
  const authz = await authorizeRepairsRequest(request, 'view');
  if (!authz.ok) {
    return authz.response;
  }

  const query = new URL(request.url).searchParams
    .get('q')
    ?.trim()
    .toLowerCase();

  const { data, error } = await authz.supabase
    .from('repair_devices')
    .select(DEVICE_COLUMNS)
    .eq('merchant_id', authz.access.merchantId)
    .order('sort_order', { ascending: true })
    .order('brand', { ascending: true })
    .order('model', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load devices' },
      { status: 500 }
    );
  }

  let devices = ((data ?? []) as Record<string, unknown>[]).map(mapDeviceRow);
  if (query) {
    devices = devices.filter((device) => matchesQuery(device, query));
  }

  return NextResponse.json({ devices });
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

  const parsed = createRepairDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const base = buildDeviceSlug(parsed.data.brand, parsed.data.model);
  let slug: string;
  try {
    const taken = await loadTakenSlugs(
      authz.supabase,
      'repair_devices',
      authz.access.merchantId,
      base
    );
    slug = nextAvailableSlug(base, taken);
  } catch {
    return NextResponse.json(
      { error: 'Failed to create device' },
      { status: 500 }
    );
  }

  const { data, error } = await authz.supabase
    .from('repair_devices')
    .insert(buildDeviceInsert(parsed.data, authz.access.merchantId, slug))
    .select(DEVICE_COLUMNS)
    .single();

  if (error) {
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
      { error: 'Failed to create device' },
      { status: 500 }
    );
  }

  revalidatePath('/dashboard/repairs');
  revalidateRepairsCatalog(authz.access.merchantId);
  return NextResponse.json(
    { device: mapDeviceRow(data as Record<string, unknown>) },
    { status: 201 }
  );
}
