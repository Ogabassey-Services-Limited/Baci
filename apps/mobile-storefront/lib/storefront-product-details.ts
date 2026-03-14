import { normalizeVariantAttributes } from '@baci/shared';
import { withSupabaseRetry } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { transformProduct } from '@/lib/storefront-product-transform';
import {
  fetchStorefrontProductVariants,
  toMobileProductVariants,
} from '@/lib/storefront-product-variants';
import { supabase } from '@/lib/supabase';
import { ProductRowSchema } from '@/lib/validation';
import type { Product } from '@/types/product';
import type { StorefrontVariantRecord } from '@baci/shared';

const log = createLogger('StorefrontProductDetails');

const PRODUCT_DETAIL_COLUMNS = `
  id,
  merchant_id,
  name,
  slug,
  description,
  price,
  compare_at_price,
  images,
  brand,
  condition,
  specifications,
  has_variants,
  variant_attributes,
  manage_stock,
  stock_quantity,
  colors,
  color_images,
  has_condition_offers,
  offers:product_offers (
    id,
    condition,
    price,
    compare_at_price,
    stock_quantity,
    images,
    condition_notes,
    grade
  ),
  categories (id, name, slug)
`;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function fetchProductDetails(
  merchantId: string,
  productIdOrSlug: string
): Promise<Product> {
  if (!merchantId || !isUuid(merchantId)) {
    throw new TypeError('Invalid merchant identifier');
  }

  if (!productIdOrSlug || !productIdOrSlug.trim()) {
    throw new TypeError('Invalid product identifier or slug');
  }

  const normalizedProductIdOrSlug = productIdOrSlug.trim();

  const result = await withSupabaseRetry(
    async () => {
      let supabaseQuery = supabase
        .from('products')
        .select(PRODUCT_DETAIL_COLUMNS)
        .eq('merchant_id', merchantId)
        .eq('status', 'active');

      if (isUuid(normalizedProductIdOrSlug)) {
        supabaseQuery = supabaseQuery.eq('id', normalizedProductIdOrSlug);
      } else {
        supabaseQuery = supabaseQuery.eq('slug', normalizedProductIdOrSlug);
      }

      return await supabaseQuery.single();
    },
    {
      maxRetries: 3,
      onRetry: (attempt, error) => {
        log.warn(`Product detail retry ${attempt}: ${error.message}`);
      },
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    throw new Error('Product not found');
  }

  const validated = ProductRowSchema.safeParse(result.data);
  if (!validated.success) {
    const validationIssues = validated.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.join('.'),
    }));

    const productId =
      result.data && typeof result.data === 'object' && 'id' in result.data
        ? result.data.id
        : 'unknown';

    log.error('Product validation failed', {
      issues: validationIssues,
      productId,
    });
    throw new Error('Product validation failed');
  }

  const item = validated.data;
  let rpcVariants: StorefrontVariantRecord[] = [];

  try {
    rpcVariants = await fetchStorefrontProductVariants(item.id);
  } catch (error) {
    log.warn('Variant fetch failed; rendering product without variants', {
      error: error instanceof Error ? error.message : 'unknown',
      productId: item.id,
    });
  }

  return {
    ...transformProduct(item),
    merchant_id: item.merchant_id,
    specifications: item.specifications ?? undefined,
    has_variants: item.has_variants === true,
    variant_attributes: normalizeVariantAttributes(item.variant_attributes),
    variants: toMobileProductVariants(rpcVariants, {
      basePrice: item.price,
      compareAtPrice: item.compare_at_price ?? undefined,
      merchantId,
      productId: item.id,
    }),
  };
}
