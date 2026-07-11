import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { revalidateRepairsCatalog } from '@/lib/cache-revalidation';
import { authorizeRepairsRequest } from '@/lib/repairs/catalog-admin-auth';
import {
  buildServiceTypeInsert,
  mapServiceTypeRow,
  SERVICE_TYPE_COLUMNS,
} from '@/lib/repairs/catalog-admin-mappers';
import { loadTakenSlugs } from '@/lib/repairs/catalog-admin-slugs';
import { nextAvailableSlug, slugifyRepair } from '@/lib/repairs/catalog-slug';
import { createRepairServiceTypeSchema } from '@/schemas/repair-catalog-admin';

export async function GET(request: NextRequest) {
  const authz = await authorizeRepairsRequest(request, 'view');
  if (!authz.ok) {
    return authz.response;
  }

  const { data, error } = await authz.supabase
    .from('repair_service_types')
    .select(SERVICE_TYPE_COLUMNS)
    .eq('merchant_id', authz.access.merchantId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load service types' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    serviceTypes: ((data ?? []) as Record<string, unknown>[]).map(
      mapServiceTypeRow
    ),
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

  const parsed = createRepairServiceTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const base = slugifyRepair(parsed.data.name);
  let slug: string;
  try {
    const taken = await loadTakenSlugs(
      authz.supabase,
      'repair_service_types',
      authz.access.merchantId,
      base
    );
    slug = nextAvailableSlug(base, taken);
  } catch {
    return NextResponse.json(
      { error: 'Failed to create service type' },
      { status: 500 }
    );
  }

  const { data, error } = await authz.supabase
    .from('repair_service_types')
    .insert(buildServiceTypeInsert(parsed.data, authz.access.merchantId, slug))
    .select(SERVICE_TYPE_COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A service type with that name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create service type' },
      { status: 500 }
    );
  }

  revalidatePath('/dashboard/repairs');
  revalidateRepairsCatalog(authz.access.merchantId);
  return NextResponse.json(
    { serviceType: mapServiceTypeRow(data as Record<string, unknown>) },
    { status: 201 }
  );
}
