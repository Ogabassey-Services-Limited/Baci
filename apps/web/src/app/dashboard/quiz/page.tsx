import { getEffectiveProductStock } from '@baci/shared';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ensurePermission,
  isMerchantPermissionRedirectError,
} from '@/lib/merchant-server';
import { getPrimaryProductImage } from '@/lib/product-image';
import { createClient } from '@/lib/supabase/server';
import {
  quizPrizeProductSchema,
  quizPrizeProductsResponseSchema,
} from '@/schemas/quiz-prize-product';
import { QuizAdminClient } from './quiz-admin-client';

export const metadata: Metadata = {
  title: 'Quiz | Baci Dashboard',
  description: 'Generate merchant quiz topics and questions with Gemma',
};

type PrizeProductRow = {
  default_variant_id: string | null;
  condition: string | null;
  has_variants: boolean | null;
  id: string;
  images: Array<string | { url?: string | null }> | null;
  name: string;
  manage_stock: boolean | null;
  price: number | string | null;
  stock: number | string | null;
  stock_quantity: number | string | null;
};

const INITIAL_PRIZE_PRODUCT_LIMIT = 100;

function productOffsetCursor(productOffset: number): string {
  // Matches the product-offset/zero-variant cursor consumed by the prize API.
  return String((productOffset * (productOffset + 1)) / 2);
}

function isPrizeProductRow(value: unknown): value is PrizeProductRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<PrizeProductRow>;
  return typeof row.id === 'string' && typeof row.name === 'string';
}

export async function loadPrizeProducts(merchantId: string) {
  const supabase = createClient(await cookies());
  const { count, data, error } = await supabase
    .from('products')
    .select(
      'id, name, price, images, condition, default_variant_id, has_variants, manage_stock, stock, stock_quantity',
      { count: 'exact' }
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(INITIAL_PRIZE_PRODUCT_LIMIT);

  if (error) {
    return {
      error: 'Failed to load prize products',
      nextCursor: null,
      products: [],
      total: null,
    };
  }

  const rows = (Array.isArray(data) ? data : []).filter(isPrizeProductRow);
  const products = rows
    .map((row) => {
      const manageStock = row.manage_stock === true;
      const effectiveStock = manageStock ? getEffectiveProductStock(row) : null;
      const hasVariants = row.has_variants === true;
      return {
        available: !hasVariants && (!manageStock || (effectiveStock ?? 0) > 0),
        condition: row.condition?.trim() || 'unspecified',
        defaultVariantId: row.default_variant_id ?? null,
        effectiveStock,
        hasVariants,
        id: row.id,
        imageUrl: getPrimaryProductImage(row.images),
        manageStock,
        name: row.name,
        price: Number(row.price ?? 0),
        requiresVariantSelection: hasVariants,
        selectionId: `${row.id}:product`,
        variantId: null,
        variantLabel: null,
      };
    })
    .flatMap((product) => {
      const parsed = quizPrizeProductSchema.safeParse(product);
      return parsed.success ? [parsed.data] : [];
    });

  const total = typeof count === 'number' && count >= 0 ? count : null;
  const nextCursor =
    total !== null &&
    rows.length === INITIAL_PRIZE_PRODUCT_LIMIT &&
    total > rows.length
      ? productOffsetCursor(rows.length)
      : null;

  const response = quizPrizeProductsResponseSchema.safeParse({
    nextCursor,
    products,
    total,
  });
  if (!response.success) {
    return {
      error: 'Failed to load prize products',
      nextCursor: null,
      products: [],
      total: null,
    };
  }

  return { error: null, ...response.data };
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
