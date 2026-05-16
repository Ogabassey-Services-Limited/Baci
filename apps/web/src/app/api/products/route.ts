import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleKey } from '@/env';
import { revalidateProducts } from '@/lib/cache-revalidation';
import { getCountryByCode } from '@/lib/countries';
import { checkCsrfProtection } from '@/lib/csrf';
import { deriveProductVariantWriteProjections } from '@/lib/derive-product-variant-projections';
import { getProductEmbeddingText } from '@/lib/embeddings';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import {
  getPrimaryProductImage,
  PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL,
  PRODUCT_IMAGE_PLACEHOLDER_URL,
} from '@/lib/product-image';
import { PRODUCT_WITH_VARIANTS_QUERY } from '@/lib/product-queries';
import {
  getEffectiveStock,
  matchesProductStockFilter,
} from '@/lib/product-stock';
import {
  getSkuMatrixValidationError,
  inferProductVariantModel,
} from '@/lib/product-variant-model';
import type { Product } from '@/lib/products';
import { sanitizeHtml } from '@/lib/sanitize';
import { sanitizeLikePattern, sanitizeSearchQuery } from '@/lib/sanitize-core';
import { sanitizeSchemaMarkup } from '@/lib/sanitize-json-ld';
import {
  generateMetaDescription,
  generateProductSchema,
  generateProductSlug,
  generateSlug,
} from '@/lib/seo-utils';
import { createClient } from '@/lib/supabase/server';
import { productListQuerySchema } from '@/schemas/product-list-query';
import { createProductSchema, formatZodErrors } from '@/schemas/products';

/**
 * Extract denormalized variant attributes for fast UI rendering
 * Called when saving products with variants
 */
function extractVariantAttributes(variants: Record<string, unknown>[]): {
  colors: string[];
  storage_options: string[];
  available_sizes: string[];
} {
  const colors = new Set<string>();
  const storage = new Set<string>();
  const sizes = new Set<string>();

  for (const v of variants) {
    const attrs = v.attributes as Record<string, string> | undefined;
    if (attrs?.color) colors.add(attrs.color);
    if (attrs?.storage) storage.add(attrs.storage);
    if (attrs?.size) sizes.add(attrs.size);
  }

  return {
    colors: [...colors],
    storage_options: [...storage],
    available_sizes: [...sizes],
  };
}

function buildProductImagesInput(
  images: Record<string, unknown>[] | undefined,
  fallbackImage: string | null | undefined,
  fallbackAlt: string
) {
  if (Array.isArray(images) && images.length > 0) {
    return images;
  }

  if (!fallbackImage) {
    return [];
  }

  return [{ url: fallbackImage, alt: fallbackAlt, order: 0 }];
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant record (works for both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;

    // Parse query parameters
    const queryParams = productListQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!queryParams.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: queryParams.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      page,
      limit,
      search: searchRaw,
      migration,
      status,
      stock,
      ids,
    } = queryParams.data;
    // Sanitize search input to prevent SQL injection
    const search = searchRaw ? sanitizeSearchQuery(searchRaw) : '';

    const offset = (page - 1) * limit;
    const shouldPaginateInDatabase = !ids && stock === 'All';

    // Build query
    // PERFORMANCE: Select only essential variant fields instead of wildcard
    let query = supabase
      .from('products')
      .select(PRODUCT_WITH_VARIANTS_QUERY, { count: 'exact' })
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    // If fetching by IDs, ignore pagination and other filters usually
    if (ids) {
      const idList = ids.split(',').filter(Boolean);
      if (idList.length > 0) {
        query = query.in('id', idList);
      }
    } else {
      // Apply filters only if not fetching by ID
      if (status !== 'All') {
        query = query.eq('status', status);
      }

      if (migration !== 'All') {
        query =
          migration === 'pending'
            ? query.or('migration_status.eq.pending,migration_status.is.null')
            : query.eq('migration_status', migration);
      }

      if (search?.trim()) {
        const sanitizedPattern = sanitizeLikePattern(search);
        query = query.or(
          `name.ilike.%${sanitizedPattern}%,sku.ilike.%${sanitizedPattern}%`
        );
      }

      if (shouldPaginateInDatabase) {
        query = query.range(offset, offset + limit - 1);
      }
    }

    const { data: products, error, count } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    // Transform to match UI Product interface
    const transformedProducts: Product[] =
      products?.map((p) => {
        // Extract denormalized attributes from variants for fast UI access
        const variantAttrs = p.variants?.length
          ? extractVariantAttributes(p.variants)
          : { colors: [], storage_options: [], available_sizes: [] };

        // Extract rating from schema_markup if available
        const schemaRating = p.schema_markup?.aggregateRating;
        const rating =
          typeof schemaRating?.ratingValue === 'number'
            ? schemaRating.ratingValue
            : undefined;
        const review_count =
          typeof schemaRating?.reviewCount === 'number'
            ? schemaRating.reviewCount
            : undefined;

        return {
          id: p.id,
          name: p.name,
          description: p.description || '',
          status: p.status || 'draft',
          price: Number.parseFloat(p.price),
          manage_stock: p.manage_stock ?? true,
          stock: getEffectiveStock(p),
          minimum_order_quantity: 1,

          // Image handling
          image:
            getPrimaryProductImage(p.images) || PRODUCT_IMAGE_PLACEHOLDER_URL,
          imageLarge:
            getPrimaryProductImage(p.images) ||
            PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL,
          imageHint: p.image_hint || '',
          images: p.images || [],

          brand: p.brand || '',
          gtin: p.gtin || '',
          mpn: p.mpn || '',
          google_product_category: p.google_product_category,

          has_variants: p.has_variants || false,
          variants:
            p.variants?.map((v: Record<string, unknown>) => ({
              id: v.id as string,
              product_id: v.product_id as string,
              merchant_id: v.merchant_id as string,
              condition: v.condition as Product['condition'] | undefined,
              attributes: v.attributes as Record<string, string>,
              price_override: v.price_override as number | undefined,
              cost_price: v.cost_price as number | undefined,
              stock_quantity: v.stock_quantity as number,
              sku: v.sku as string | undefined,
              primary_image: v.primary_image as string | undefined,
              images: v.images as string[] | undefined,
            })) || [],
          category: p.category || 'General',
          color: p.color,

          // Denormalized fields for fast UI rendering
          colors:
            variantAttrs.colors.length > 0
              ? variantAttrs.colors
              : p.color
                ? [p.color]
                : undefined,
          storage_options:
            variantAttrs.storage_options.length > 0
              ? variantAttrs.storage_options
              : undefined,
          available_sizes:
            variantAttrs.available_sizes.length > 0
              ? variantAttrs.available_sizes
              : undefined,
          rating,
          review_count,

          // Other fields
          sku: p.sku,
          slug: p.slug,
          compare_at_price: p.compare_at_price
            ? Number.parseFloat(p.compare_at_price)
            : undefined,
          cost_price: p.cost_price
            ? Number.parseFloat(p.cost_price)
            : undefined,
          low_stock_threshold: p.low_stock_threshold,
          variant_model:
            p.variant_model === 'sku_matrix' ? 'sku_matrix' : 'legacy',
          migration_status:
            p.migration_status === 'needs_review' ||
            p.migration_status === 'migrated'
              ? p.migration_status
              : 'pending',
          default_variant_id:
            typeof p.default_variant_id === 'string'
              ? p.default_variant_id
              : undefined,
          available_conditions: Array.isArray(p.available_conditions)
            ? (p.available_conditions as Product['available_conditions'])
            : undefined,
          min_variant_price:
            p.min_variant_price != null
              ? Number.parseFloat(String(p.min_variant_price))
              : undefined,
          max_variant_price:
            p.max_variant_price != null
              ? Number.parseFloat(String(p.max_variant_price))
              : undefined,

          weight_value: p.weight_value
            ? Number.parseFloat(p.weight_value)
            : undefined,
          weight_unit: p.weight_unit,
          dimensions: p.dimensions,

          taxable: p.taxable,
          tax_code: p.tax_code,

          condition: p.condition,
          condition_detail: p.condition_detail,

          meta_title: p.meta_title,
          meta_description: p.meta_description,
          keywords: p.keywords,
          canonical_url: p.canonical_url,
          schema_markup: p.schema_markup,
        };
      }) || [];
    const filteredProducts =
      ids || stock === 'All'
        ? transformedProducts
        : transformedProducts.filter((product) =>
            matchesProductStockFilter(product, stock)
          );
    const paginatedProducts = shouldPaginateInDatabase
      ? filteredProducts
      : ids
        ? filteredProducts
        : filteredProducts.slice(offset, offset + limit);
    const totalProducts =
      ids || stock === 'All'
        ? (count ?? filteredProducts.length)
        : filteredProducts.length;

    // Calculate stats
    // OPTIMIZED STATS CALCULATION (2025 Pattern)
    // 1. Try to get stats from DB RPC (fastest)
    // 2. Fallback to lightweight counts if RPC not exists
    // 3. Avoid fetching all rows at all costs

    let inventoryValue = 0;
    let outOfStockCount = 0;
    let categoryCount = 0;

    try {
      const { data: rpcStats, error: rpcError } = await supabase.rpc(
        'get_merchant_inventory_stats',
        { p_merchant_id: merchantId }
      );

      if (!rpcError && rpcStats) {
        inventoryValue = Number(rpcStats.inventoryValue || 0);
        outOfStockCount = Number(rpcStats.outOfStockCount || 0);
        categoryCount = Number(rpcStats.categoryCount || 0);
      } else {
        // PERFORMANCE: Improved fallback with lightweight COUNT queries
        // Log the RPC error for debugging
        if (rpcError) {
          console.warn(
            'RPC get_merchant_inventory_stats failed:',
            rpcError.message
          );
        }

        // Fallback: Use separate COUNT query for out-of-stock count
        const oosResult = await supabase
          .from('products')
          // PERFORMANCE: Use .select('id') instead of .select('*') for COUNT queries to prevent overfetching full rows
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', merchantId)
          .eq('stock_quantity', 0);

        outOfStockCount = oosResult.count || 0;
        // For category count, we'd need a distinct query which Supabase doesn't support well
        // Use the products array we already fetched instead
        const uniqueCategories = new Set(
          transformedProducts.map((p) => p.category).filter(Boolean)
        );
        categoryCount = uniqueCategories.size;

        // Calculate inventory value from already-fetched products (no extra query)
        inventoryValue = transformedProducts.reduce(
          (sum, p) => sum + (p.price || 0) * (p.stock || 0),
          0
        );
      }
    } catch (statsErr) {
      console.error('Error fetching stats:', statsErr);
      // Fail silently for stats, don't block the product list
    }

    return NextResponse.json({
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total: totalProducts,
        totalPages: Math.ceil(totalProducts / limit),
      },
      stats: {
        inventoryValue,
        outOfStockCount,
        categoryCount,
      },
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/products:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid && response) return response;

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant record (works for both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;
    const businessName = merchantContext.businessName ?? '';

    // Fetch extra merchant fields needed for product creation
    const { data: merchantData } = await supabase
      .from('merchants')
      .select('country')
      .eq('id', merchantId)
      .single();

    const rawBody = await request.json();

    // Validate and sanitize input using Zod schema (2026 best practice)
    const parseResult = createProductSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatZodErrors(parseResult.error),
        },
        { status: 400 }
      );
    }

    // Use sanitized data from Zod transform
    const body = parseResult.data;
    const variantModel = inferProductVariantModel({
      variantModel: body.variant_model,
      variants: body.variants,
    });
    const skuMatrixValidationError = getSkuMatrixValidationError({
      variantModel,
      hasVariants: body.has_variants,
      variants: body.variants,
    });

    if (skuMatrixValidationError) {
      return NextResponse.json(
        { error: skuMatrixValidationError },
        { status: 400 }
      );
    }

    // Prepare data for insertion using sanitized values
    // Generate slug with condition if not 'new'
    const slug =
      body.slug ||
      generateProductSlug(body.name, body.condition, body.condition_detail);
    const sku =
      body.sku || generateSlug(body.name).toUpperCase().substring(0, 20); // Fallback SKU

    // Sanitize description to prevent Stored XSS
    const description = body.description ? sanitizeHtml(body.description) : '';
    const meta_description =
      body.meta_description || generateMetaDescription(description);
    const meta_title = body.meta_title || body.name;

    // Prepare product object for schema generation (using sanitized values)
    const productForSchema: Product = {
      id: '', // Placeholder
      name: body.name,
      description: description,
      price: body.price,
      stock: body.stock ?? 0,
      manage_stock: body.manage_stock ?? true,
      status: body.status ?? 'draft',
      image: body.images?.[0]?.url || '',
      imageLarge: body.images?.[0]?.url || '',
      imageHint: body.imageHint || '',
      brand: body.brand || businessName,
      sku: sku,
      gtin: body.gtin ?? '',
      mpn: body.mpn ?? '',
      weight_value: body.weight_value,
      weight_unit: body.weight_unit,
      condition: body.condition,
    };

    const country = merchantData?.country
      ? getCountryByCode(merchantData.country)
      : undefined;
    const currency = country ? country.currency : 'USD';
    // Sanitize user-provided schema_markup to prevent XSS (defense in depth)
    const schema_markup = body.schema_markup
      ? sanitizeSchemaMarkup(body.schema_markup)
      : generateProductSchema(productForSchema, businessName, currency);
    const resolvedImages = buildProductImagesInput(
      body.images,
      body.image ?? body.imageLarge,
      body.name
    );
    const variantWriteProjections = deriveProductVariantWriteProjections({
      fallbackColor: body.color,
      hasVariants: body.has_variants || false,
      productImages: resolvedImages,
      variants: body.variants,
    });

    // Check for duplicates (same slug for this merchant)
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('slug', slug)
      .maybeSingle();

    if (existingProduct) {
      return NextResponse.json(
        { error: 'A product with this name already exists.' },
        { status: 409 }
      );
    }

    // Insert Product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        merchant_id: merchantId,
        name: body.name,
        description: description,
        price: body.price,
        stock_quantity: body.stock,

        // New fields
        sku: sku,
        slug: slug,
        compare_at_price: body.compare_at_price,
        cost_price: body.cost_price,
        low_stock_threshold: body.low_stock_threshold ?? 5,

        images: resolvedImages,
        image_hint: body.imageHint,

        weight_value: body.weight_value,
        weight_unit: body.weight_unit,
        dimensions: body.dimensions,

        status: body.status || 'draft',

        taxable: body.taxable ?? true,
        tax_code: body.tax_code,

        condition: body.condition || 'new',
        condition_detail: body.condition_detail,

        meta_title: meta_title,
        meta_description: meta_description,
        keywords: body.keywords,
        canonical_url: body.canonical_url,
        schema_markup: schema_markup,

        gtin: body.gtin,
        mpn: body.mpn,
        google_product_category: body.google_product_category,
        brand: body.brand,

        fulfillment_details: body.fulfillment_details,
        has_variants: body.has_variants || false,
        variant_model: variantModel,
        migration_status:
          variantModel === 'sku_matrix' ? 'migrated' : 'pending',
        category: body.category,
        color: (variantWriteProjections.color ?? body.color?.trim()) || null,
      })
      // PERFORMANCE: Use explicit column selection instead of .select() to prevent overfetching full product rows on insertion, as only the ID is needed below
      .select('id')
      .single();

    if (productError) {
      console.error('Error creating product:', productError);
      return NextResponse.json(
        { error: 'Failed to create product', details: productError.message },
        { status: 500 }
      );
    }

    // Insert Variants if any
    if (body.has_variants && body.variants && body.variants.length > 0) {
      const variantsToInsert = body.variants.map(
        (v: Record<string, unknown>) => ({
          product_id: product.id,
          merchant_id: merchantId,
          condition: v.condition,
          attributes: v.attributes,
          price_override: v.price_override,
          cost_price: v.cost_price, // New field
          stock_quantity: v.stock_quantity,
          sku: v.sku,
          primary_image: v.primary_image,
          images: v.images || [],
        })
      );

      const { error: variantsError } = await supabase
        .from('product_variants')
        .insert(variantsToInsert);

      if (variantsError) {
        // The product row was created with has_variants=true but the
        // variants insert failed. Roll back the product row so we don't
        // leave an orphaned has_variants=true product without variants —
        // that state breaks downstream stock/availability resolution.
        console.error('Error creating variants:', variantsError, {
          productId: product?.id,
          variantCount: variantsToInsert.length,
        });
        const { error: rollbackError } = await supabase
          .from('products')
          .delete()
          .eq('id', product.id)
          .eq('merchant_id', merchantId);
        if (rollbackError) {
          console.error(
            'Failed to roll back orphaned product after variant insert failure:',
            { productId: product.id, variantsError, rollbackError }
          );
        }
        return NextResponse.json(
          {
            error: 'Failed to create product variants',
            details: variantsError.message,
            productId: product?.id,
            rolledBack: !rollbackError,
          },
          { status: 500 }
        );
      }
    }

    // Generate embedding asynchronously (non-blocking)
    if (product?.id) {
      const embeddingText = getProductEmbeddingText({
        name: body.name,
        description: description,
        brand: body.brand,
        category_name: body.category,
      });
      const serviceRoleKey = getSupabaseServiceRoleKey();

      // Fire-and-forget: Call edge function to generate embedding
      fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-embedding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: 'product',
            id: product.id,
            text: embeddingText,
          }),
          signal: AbortSignal.timeout(10_000),
        }
      ).catch((err) =>
        console.error('Failed to generate product embedding:', err)
      );
    }

    // Invalidate product caches so storefront shows the new product immediately
    revalidateProducts(merchantId, slug);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/products:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
