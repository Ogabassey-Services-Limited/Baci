import { NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { getPrimaryProductImage } from '@/lib/product-image';
import { merchantQuizPrizeProductsResponseSchema } from '@/schemas/quiz';

type PrizeProductRow = {
  default_variant_id: string | null;
  id: string;
  images: Array<string | { url?: string | null }> | null;
  name: string;
  price: number | string | null;
};

type MerchantSlugRow = {
  slug: string | null;
};

function mapPrizeProduct(row: PrizeProductRow) {
  return {
    defaultVariantId: row.default_variant_id,
    id: row.id,
    imageUrl: getPrimaryProductImage(row.images),
    name: row.name,
    price: Number(row.price ?? 0),
  };
}

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  if (!hasPermission(access, 'marketing', 'edit')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { data: merchant, error: merchantError } = await auth.supabase
    .from('merchants')
    .select('slug')
    .eq('id', access.merchantId)
    .maybeSingle();

  if (merchantError) {
    return NextResponse.json(
      { error: 'Failed to load prize products' },
      { status: 500 }
    );
  }

  const merchantSlug = (merchant as MerchantSlugRow | null)?.slug
    ?.trim()
    .toLowerCase();
  if (merchantSlug !== 'ogabassey') {
    return NextResponse.json(
      { error: 'Quiz creation is only available for Ogabassey' },
      { status: 403 }
    );
  }

  const { data, error } = await auth.supabase
    .from('products')
    .select('id, name, price, images, default_variant_id')
    .eq('merchant_id', access.merchantId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load prize products' },
      { status: 500 }
    );
  }

  const products = (Array.isArray(data) ? data : [])
    .filter((row): row is PrizeProductRow => {
      if (!row || typeof row !== 'object') return false;
      const product = row as Partial<PrizeProductRow>;
      return typeof product.id === 'string' && typeof product.name === 'string';
    })
    .map(mapPrizeProduct);

  const response = merchantQuizPrizeProductsResponseSchema.safeParse({
    products,
  });
  if (!response.success) {
    return NextResponse.json(
      { error: 'Failed to load prize products' },
      { status: 500 }
    );
  }

  return NextResponse.json(response.data);
}
