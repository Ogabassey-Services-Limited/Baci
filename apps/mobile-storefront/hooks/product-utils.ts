import type { QueryClient } from '@tanstack/react-query';
import { withSupabaseRetry } from '@/lib/api';
import { CONFIG } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { normalizeProductConditionFilterValue } from '@/lib/product-filter-options';
import {
  getPrimaryProductImage,
  normalizeProductImages,
  normalizeProductSpecifications,
  normalizeVariantAttributes,
} from '@/lib/product-normalization';
import { removeProductSlugFromProductsCache } from '@/lib/product-query-cache';
import { getProductSlugFallbackCandidates } from '@/lib/product-slug-fallback';
import { supabase } from '@/lib/supabase';
import { ProductRowSchema } from '@/lib/validation';
import {
  formatProductConditionDisplay,
  type Product,
  type ProductVariant,
} from '@/types/product';
import { normalizeProductInventory } from '../../../packages/shared/src/lib/product-inventory';

const log = createLogger('Products');

export const MERCHANT_SLUG = CONFIG.MERCHANT_SLUG || 'ogabassey';
export const CONSTANT_MERCHANT_ID = CONFIG.MERCHANT_ID;

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  icon?: string;
}

export interface UseProductsOptions {
  category?: string;
  limit?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  search?: string;
  condition?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  enabled?: boolean;
}

export interface ProductsPage {
  products: Product[];
  nextOffset: number | null;
  total: number;
}

export const PRODUCT_SELECT = `
  id, name, slug, description, price, compare_at_price,
  images, brand, condition, has_condition_offers, average_rating, review_count, status, specifications,
  has_variants, variant_attributes, manage_stock, stock, stock_quantity,
  variants:product_variants (
    id,
    product_id,
    merchant_id,
    sku,
    price_override,
    primary_image,
    images,
    stock_quantity,
    attributes
  ),
  categories (id, name, slug)
`;

export const PRODUCT_DETAIL_SELECT = `
  id, name, slug, description, price, compare_at_price,
  images, brand, color, condition, average_rating, review_count, status, specifications,
  has_variants, variant_attributes, manage_stock, stock, stock_quantity,
  color_images, has_condition_offers,
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
  variants:product_variants (
    id,
    product_id,
    merchant_id,
    sku,
    price_override,
    primary_image,
    images,
    stock_quantity,
    attributes
  ),
  categories (id, name, slug)
`;

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function normalizeProductVariants(
  variants: unknown,
  options: {
    basePrice: number;
    compareAtPrice?: number;
  }
): ProductVariant[] {
  const parsedVariants = ProductRowSchema.shape.variants.safeParse(variants);
  if (!parsedVariants.success) {
    return [];
  }

  return (
    parsedVariants.data?.map((variant) => {
      const attributes = variant.attributes ?? undefined;
      const synthesizedName =
        [
          attributes?.storage,
          attributes?.ram,
          attributes?.color,
          attributes?.platform,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' ')
          .trim() ||
        variant.sku ||
        variant.name ||
        'Variant';
      const primaryImage = variant.primary_image ?? variant.image ?? undefined;
      const images = normalizeProductImages(
        variant.images ?? (primaryImage ? [primaryImage] : undefined)
      );
      const stockQuantity = variant.stock_quantity ?? undefined;

      return {
        id: variant.id,
        name: synthesizedName,
        sku: variant.sku ?? undefined,
        price:
          variant.price ??
          variant.price_override ??
          (typeof variant.price_modifier === 'number'
            ? Math.max(0, options.basePrice + variant.price_modifier)
            : options.basePrice),
        compare_at_price:
          variant.compare_at_price ?? options.compareAtPrice ?? undefined,
        price_override: variant.price_override ?? undefined,
        price_modifier: variant.price_modifier ?? undefined,
        image: primaryImage,
        images: images.length > 0 ? images : undefined,
        in_stock:
          typeof stockQuantity === 'number'
            ? stockQuantity > 0
            : (variant.in_stock ?? undefined),
        stock_quantity: stockQuantity,
        attributes,
      };
    }) ?? []
  );
}

export function fetchProductRow(
  merchantId: string,
  identifier: string,
  context: string
) {
  let supabaseQuery = supabase
    .from('products')
    .select(PRODUCT_DETAIL_SELECT)
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (isUuid(identifier)) {
    supabaseQuery = supabaseQuery.eq('id', identifier);
  } else {
    supabaseQuery = supabaseQuery.eq('slug', identifier);
  }

  return withSupabaseRetry(async () => await supabaseQuery.maybeSingle(), {
    maxRetries: 3,
    onRetry: (attempt, err) => {
      log.warn(`${context} retry ${attempt}: ${err.message}`);
    },
  });
}

export async function resolveProductRow(merchantId: string, slug: string) {
  const exact = await fetchProductRow(merchantId, slug, 'Product');
  if (exact.error) throw exact.error;
  if (exact.data) return exact.data;
  if (isUuid(slug)) return null;

  for (const fallbackSlug of getProductSlugFallbackCandidates(slug)) {
    const fallback = await fetchProductRow(
      merchantId,
      fallbackSlug,
      'Product fallback'
    );
    if (fallback.error) throw fallback.error;
    if (fallback.data) {
      log.warn(`Resolved legacy product slug "${slug}" to "${fallbackSlug}"`);
      return fallback.data;
    }
  }

  return null;
}

export async function resolveAndEvictProduct(
  merchantId: string,
  slug: string,
  queryClient: QueryClient
) {
  const data = await resolveProductRow(merchantId, slug);
  if (data) {
    return data;
  }

  queryClient.removeQueries({
    queryKey: ['product', slug, merchantId],
    exact: true,
  });

  queryClient.setQueriesData(
    { queryKey: ['products', merchantId], exact: false },
    (cached) => removeProductSlugFromProductsCache(cached, slug)
  );

  throw new Error(
    'This product is no longer available. Refresh the app to remove outdated product cards.'
  );
}

export async function fetchAvailableBrands(
  merchantId: string,
  options: UseProductsOptions
): Promise<string[]> {
  const brands = new Set<string>();
  const pageSize = 500;
  let offset = 0;

  while (true) {
    let query = supabase
      .from('products')
      .select('brand')
      .eq('merchant_id', merchantId)
      .eq('status', 'active');

    if (options.category) {
      query = query.eq('category_id', options.category);
    }
    if (options.search) {
      const escapedSearch = options.search
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      query = query.ilike('name', `%${escapedSearch}%`);
    }

    const normalizedCondition = normalizeProductConditionFilterValue(
      options.condition
    );
    if (normalizedCondition) {
      query = query.eq('condition', normalizedCondition);
    }
    if (options.minPrice !== undefined) {
      query = query.gte('price', options.minPrice);
    }
    if (options.maxPrice !== undefined) {
      query = query.lte('price', options.maxPrice);
    }
    if (options.minRating !== undefined && options.minRating > 0) {
      query = query.gte('average_rating', options.minRating);
    }

    query = query
      .order('brand', { ascending: true })
      .range(offset, offset + pageSize - 1);

    const result = await withSupabaseRetry(async () => await query, {
      maxRetries: 3,
      onRetry: (attempt, err) => {
        log.warn(`Brand retry ${attempt}: ${err.message}`);
      },
    });

    if (result.error) {
      throw result.error;
    }

    const rows = result.data ?? [];
    for (const row of rows) {
      const brand = row?.brand?.trim();
      if (brand) {
        brands.add(brand);
      }
    }

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return Array.from(brands).sort((left, right) => left.localeCompare(right));
}

export function transformProduct(item: unknown): Product | null {
  const validated = ProductRowSchema.safeParse(item);
  if (!validated.success) {
    log.error('Product row validation failed during transform', {
      issues: validated.error.format(),
      item,
    });
    return null;
  }
  const product = validated.data;
  const images = normalizeProductImages(product.images);
  const rating = Number.isFinite(product.average_rating)
    ? (product.average_rating as number)
    : undefined;
  const reviewCount = Number.isFinite(product.review_count)
    ? Math.max(0, Math.trunc(product.review_count as number))
    : 0;
  const colorImages =
    product.color_images && typeof product.color_images === 'object'
      ? Object.fromEntries(
          Object.entries(product.color_images).map(([color, images]) => [
            color,
            normalizeProductImages(images),
          ])
        )
      : undefined;
  const derivedColors = Array.from(
    new Set([
      ...(typeof product.color === 'string' && product.color.trim()
        ? [product.color.trim()]
        : []),
      ...Object.keys(colorImages ?? {}),
    ])
  );
  const colors = Array.isArray(product.colors)
    ? product.colors.map((color) =>
        typeof color === 'string'
          ? color
          : {
              name: color.name,
              value: color.value || color.name,
            }
      )
    : derivedColors.length > 0
      ? derivedColors
      : undefined;
  const offers = Array.isArray(product.offers)
    ? product.offers.map((offer) => ({
        id: offer.id,
        condition: offer.condition as NonNullable<
          Product['offers']
        >[number]['condition'],
        price: offer.price,
        compare_at_price: offer.compare_at_price ?? undefined,
        stock_quantity: offer.stock_quantity ?? undefined,
        images: normalizeProductImages(offer.images),
        condition_notes: offer.condition_notes ?? undefined,
        grade: offer.grade ?? undefined,
      }))
    : undefined;
  const inventory = normalizeProductInventory({
    stock: product.stock,
    stock_quantity: product.stock_quantity,
    manage_stock: product.manage_stock ?? false,
  });

  return {
    id: String(product.id ?? ''),
    name: String(product.name ?? ''),
    slug: String(product.slug ?? ''),
    description: product.description as string | undefined,
    price: Number(product.price ?? 0),
    compare_at_price: product.compare_at_price as number | undefined,
    image: getPrimaryProductImage(product.images),
    images,
    brand: product.brand as string | undefined,
    category: Array.isArray(product.categories)
      ? product.categories.length > 0
        ? (product.categories[0] as Category).name
        : ''
      : product.categories != null
        ? (product.categories as unknown as Category).name
        : '',
    specifications: normalizeProductSpecifications(product.specifications),
    condition: product.has_condition_offers
      ? 'New & Used'
      : formatProductConditionDisplay(product.condition),
    rating,
    review_count: reviewCount,
    manage_stock: (product.manage_stock as boolean) ?? false,
    stock_quantity: inventory.stock_quantity,
    colors,
    color_images: colorImages,
    has_variants: product.has_variants ?? false,
    variant_attributes: normalizeVariantAttributes(product.variant_attributes),
    variants: normalizeProductVariants(product.variants, {
      basePrice: Number(product.price ?? 0),
      compareAtPrice: product.compare_at_price ?? undefined,
    }),
    has_condition_offers: product.has_condition_offers ?? false,
    offers,
    in_stock: inventory.manage_stock === false || inventory.stock_quantity > 0,
  };
}

export async function fetchProductsPage(
  merchantId: string,
  options: UseProductsOptions,
  offset: number
): Promise<ProductsPage> {
  const limit = options.limit || 20;

  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (options.category) {
    query = query.eq('category_id', options.category);
  }
  if (options.search) {
    query = query.textSearch('search_vector', options.search.trim(), {
      type: 'websearch',
      config: 'english',
    });
  }
  const normalizedCondition = normalizeProductConditionFilterValue(
    options.condition
  );
  if (normalizedCondition) {
    query = query.eq('condition', normalizedCondition);
  }
  if (options.brand) {
    query = query.eq('brand', options.brand);
  }
  if (options.minPrice !== undefined) {
    query = query.gte('price', options.minPrice);
  }
  if (options.maxPrice !== undefined) {
    query = query.lte('price', options.maxPrice);
  }
  if (options.minRating !== undefined && options.minRating > 0) {
    query = query.gte('average_rating', options.minRating);
  }

  switch (options.sortBy) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'popular':
      query = query.order('view_count', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const result = await withSupabaseRetry(async () => await query, {
    maxRetries: 3,
    onRetry: (attempt, err) => {
      log.warn(`Retry ${attempt}: ${err.message}`);
    },
  });

  if (result.error) throw result.error;

  const products = (result.data || [])
    .map(transformProduct)
    .filter((product): product is Product => product !== null);
  const resultWithCount = result as typeof result & { count: number | null };
  const total = resultWithCount.count ?? 0;
  const nextOffset = offset + limit < total ? offset + limit : null;

  return { products, nextOffset, total };
}

export { log, normalizeVariantAttributes };
