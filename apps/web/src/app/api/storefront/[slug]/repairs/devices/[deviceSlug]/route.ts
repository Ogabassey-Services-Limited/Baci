import { type NextRequest, NextResponse } from 'next/server';
import { resolveRepairsCatalogMerchant } from '@/lib/repairs/repairs-catalog-access';
import { getRepairDeviceDetailBySlug } from '@/lib/repairs/repairs-catalog-data';
import { repairsDeviceDetailRouteParamsSchema } from '@/schemas/repair-catalog';

const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; deviceSlug: string }> }
) {
  try {
    const parsedParams = repairsDeviceDetailRouteParamsSchema.safeParse(
      await params
    );
    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: 'Invalid route parameters',
          details: parsedParams.error.flatten(),
        },
        { status: 400 }
      );
    }

    const merchant = await resolveRepairsCatalogMerchant(
      parsedParams.data.slug
    );
    if (!merchant?.enabled) {
      return NextResponse.json(
        { error: 'Repairs catalogue not available' },
        { status: 404 }
      );
    }

    const detail = await getRepairDeviceDetailBySlug(
      merchant.merchantId,
      parsedParams.data.deviceSlug
    );
    if (!detail) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    return NextResponse.json(detail, {
      headers: { 'Cache-Control': CACHE_CONTROL },
    });
  } catch (error) {
    console.error(
      'Error in GET /api/storefront/[slug]/repairs/devices/[deviceSlug]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
