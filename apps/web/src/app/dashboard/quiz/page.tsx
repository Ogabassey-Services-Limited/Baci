import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ensurePermission,
  isMerchantPermissionRedirectError,
} from '@/lib/merchant-server';
import { getPrimaryProductImage } from '@/lib/product-image';
import { createClient } from '@/lib/supabase/server';
import { merchantQuizPrizeProductsResponseSchema } from '@/schemas/quiz';
import { QuizAdminClient } from './quiz-admin-client';

export const metadata: Metadata = {
  title: 'Quiz | Baci Dashboard',
  description: 'Generate merchant quiz topics and questions with Gemma',
};

type PrizeProductRow = {
  default_variant_id: string | null;
  id: string;
  images: Array<string | { url?: string | null }> | null;
  name: string;
  price: number | string | null;
};

async function loadPrizeProducts(merchantId: string) {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, images, default_variant_id')
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    return {
      error: 'Failed to load prize products',
      products: [],
    };
  }

  const products = (Array.isArray(data) ? data : [])
    .filter((row): row is PrizeProductRow => {
      if (!row || typeof row !== 'object') return false;
      const product = row as Partial<PrizeProductRow>;
      return typeof product.id === 'string' && typeof product.name === 'string';
    })
    .map((row) => ({
      defaultVariantId: row.default_variant_id,
      id: row.id,
      imageUrl: getPrimaryProductImage(row.images),
      name: row.name,
      price: Number(row.price ?? 0),
    }));

  const response = merchantQuizPrizeProductsResponseSchema.safeParse({
    products,
  });
  if (!response.success) {
    return {
      error: 'Failed to load prize products',
      products: [],
    };
  }

  return { error: null, products: response.data.products };
}

export default async function QuizDashboardPage() {
  let permissionContext: Awaited<ReturnType<typeof ensurePermission>>;
  try {
    permissionContext = await ensurePermission('marketing', 'edit');
  } catch (error) {
    if (!isMerchantPermissionRedirectError(error)) {
      throw error;
    }
    redirect('/dashboard');
  }

  if (permissionContext.merchant.slug?.trim().toLowerCase() !== 'ogabassey') {
    redirect('/dashboard');
  }

  const prizeProductResult = await loadPrizeProducts(
    permissionContext.merchant.id
  );

  return (
    <QuizAdminClient
      initialPrizeProducts={prizeProductResult.products}
      initialPrizeProductsError={prizeProductResult.error}
    />
  );
}
