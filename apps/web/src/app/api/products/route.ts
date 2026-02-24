import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { revalidateProducts } from '@/lib/cache-revalidation';
import { getCountryByCode } from '@/lib/countries';
import { checkCsrfProtection } from '@/lib/csrf';
import { getProductEmbeddingText } from '@/lib/embeddings';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { PRODUCT_WITH_VARIANTS_QUERY } from '@/lib/product-queries';
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
    const searchParams = request.nextUrl.searchParams;
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '10', 10);
    const searchRaw = searchParams.get('search') || '';
    // Sanitize search input to prevent SQL injection
    const search = searchRaw ? sanitizeSearchQuery(searchRaw) : '';
    const status = searchParams.get('status') || 'All';
    const stock = searchParams.get('stock') || 'All';
    const ids = searchParams.get('ids');

    const offset = (page - 1) * limit;

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
      query = query.range(offset, offset + limit - 1);

      // Apply filters only if not fetching by ID
      if (status !== 'All') {
        query = query.eq('status', status);
      }

      if (stock !== 'All') {
        if (stock === 'out_of_stock') {
          query = query.eq('stock_quantity', 0);
        } else if (stock === 'in_stock') {
          query = query.gt('stock_quantity', 0);
        }
      }

      if (search?.trim()) {
        const sanitizedPattern = sanitizeLikePattern(search);
        query = query.or(
          `name.ilike.%${sanitizedPattern}%,sku.ilike.%${sanitizedPattern}%`
        );
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
          status: p.status || (p.is_active ? 'active' : 'draft'),
          price: Number.parseFloat(p.price),
          manage_stock: p.manage_stock ?? true,
          stock: p.stock_quantity,
          minimum_order_quantity: p.min_order_quantity,

          // Image handling
          image:
            p.images?.[0]?.url ||
            p.image_small ||
            'https://picsum.photos/seed/placeholder/80/80',
          imageLarge:
            p.images?.[0]?.url ||
            p.image_large ||
            'https://picsum.photos/seed/placeholder/600/400',
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
          .select('*', { count: 'exact', head: true })
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
      products: transformedProducts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
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

        images: body.images || [],
        // Legacy image fields for backward compatibility
        image_small: body.images?.[0]?.url || body.image,
        image_large: body.images?.[0]?.url || body.imageLarge,
        image_hint: body.imageHint,

        weight_value: body.weight_value,
        weight_unit: body.weight_unit,
        dimensions: body.dimensions,

        status: body.status || 'draft',
        // Legacy is_active for backward compatibility
        is_active: body.status === 'active',

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
        category: body.category,
        color: body.color,
      })
      .select()
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
          attributes: v.attributes,
          price_override: v.price,
          cost_price: v.cost_price, // New field
          stock_quantity: v.stock_quantity,
          sku: v.sku,
          primary_image: v.image,
          images: v.images || [],
        })
      );

      const { error: variantsError } = await supabase
        .from('product_variants')
        .insert(variantsToInsert);

      if (variantsError) {
        console.error('Error creating variants:', variantsError);
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

      // Fire-and-forget: Call edge function to generate embedding
      fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-embedding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
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
