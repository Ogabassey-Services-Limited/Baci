import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleKey } from '@/env';
import { hasPermission } from '@/lib/api-auth';
import { revalidateProducts } from '@/lib/cache-revalidation';
import { getCountryByCode } from '@/lib/countries';
import { checkCsrfProtection } from '@/lib/csrf';
import { deriveProductVariantWriteProjections } from '@/lib/derive-product-variant-projections';
import { getProductEmbeddingText } from '@/lib/embeddings';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import {
  getPrimaryProductImage,
  PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL,
  PRODUCT_IMAGE_PLACEHOLDER_URL,
} from '@/lib/product-image';
import {
  PRODUCT_COLUMNS,
  PRODUCT_VARIANT_COLUMNS,
} from '@/lib/product-queries';
import { getEffectiveStock } from '@/lib/product-stock';
import {
  getSkuMatrixValidationError,
  inferProductVariantModel,
  normalizeProductVariantModel,
} from '@/lib/product-variant-model';
import type { Product, ProductVariant } from '@/lib/products';
import { sanitizeHtml } from '@/lib/sanitize';
import { sanitizeText } from '@/lib/sanitize-core';
import { sanitizeSchemaMarkup } from '@/lib/sanitize-json-ld';
import {
  generateMetaDescription,
  generateProductSchema,
  generateProductSlug,
  generateSlug,
} from '@/lib/seo-utils';
import { createClient } from '@/lib/supabase/server';
import { formatZodErrors, updateProductSchema } from '@/schemas/products';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'products', 'view')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // Try to find by ID first, then by slug
    let query = supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('merchant_id', merchantId);

    // Check if id is a UUID
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      );

    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('slug', id);
    }

    const { data: product, error: productError } = await query.single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let variants: ProductVariant[] = [];
    if (product.has_variants) {
      const { data: v } = await supabase
        .from('product_variants')
        .select(PRODUCT_VARIANT_COLUMNS)
        .eq('product_id', product.id)
        .eq('merchant_id', merchantId)
        .returns<ProductVariant[]>();
      variants = v || [];
    }

    const primaryImage = getPrimaryProductImage(product.images);

    const fullProduct: Product = {
      id: product.id,
      name: product.name,
      description: product.description || '',
      status: product.status || 'draft',
      price: Number.parseFloat(product.price),
      manage_stock: product.manage_stock ?? true,
      stock: getEffectiveStock(product),
      minimum_order_quantity: 1,

      image: primaryImage || PRODUCT_IMAGE_PLACEHOLDER_URL,
      imageLarge: primaryImage || PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL,
      imageHint: product.image_hint || '',
      images: product.images || [],

      brand: product.brand || '',
      gtin: product.gtin || '',
      mpn: product.mpn || '',
      google_product_category: product.google_product_category,

      has_variants: product.has_variants || false,
      category: product.category || 'General',
      color: product.color,

      sku: product.sku,
      slug: product.slug,
      compare_at_price: product.compare_at_price
        ? Number.parseFloat(product.compare_at_price)
        : undefined,
      cost_price: product.cost_price
        ? Number.parseFloat(product.cost_price)
        : undefined,
      low_stock_threshold: product.low_stock_threshold,
      variant_model:
        product.variant_model === 'sku_matrix' ? 'sku_matrix' : 'legacy',
      migration_status:
        product.migration_status === 'needs_review' ||
        product.migration_status === 'migrated'
          ? product.migration_status
          : 'pending',
      default_variant_id:
        typeof product.default_variant_id === 'string'
          ? product.default_variant_id
          : undefined,
      available_conditions: Array.isArray(product.available_conditions)
        ? (product.available_conditions as Product['available_conditions'])
        : undefined,
      min_variant_price:
        product.min_variant_price != null
          ? Number.parseFloat(String(product.min_variant_price))
          : undefined,
      max_variant_price:
        product.max_variant_price != null
          ? Number.parseFloat(String(product.max_variant_price))
          : undefined,

      weight_value: product.weight_value
        ? Number.parseFloat(product.weight_value)
        : undefined,
      weight_unit: product.weight_unit,
      dimensions: product.dimensions,

      taxable: product.taxable,
      tax_code: product.tax_code,

      condition: product.condition,
      condition_detail: product.condition_detail,

      meta_title: product.meta_title,
      meta_description: product.meta_description,
      keywords: product.keywords,
      canonical_url: product.canonical_url,
      schema_markup: product.schema_markup,

      variants: variants.map((v) => ({
        id: v.id,
        product_id: v.product_id,
        merchant_id: v.merchant_id,
        condition: v.condition,
        attributes: v.attributes,
        price_override: v.price_override,
        cost_price: v.cost_price,
        stock_quantity: v.stock_quantity,
        sku: v.sku,
        primary_image: v.primary_image,
        images: v.images || [],
      })),
    };

    return NextResponse.json({ product: fullProduct });
  } catch (error) {
    console.error('Error in GET /api/products/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid && response) return response;

  try {
    const { id } = await params;
    const rawBody = await request.json();
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Validate and sanitize input using Zod schema (2026 best practice)
    // updateProductSchema allows partial updates - only provided fields are validated
    const parseResult = updateProductSchema.safeParse(rawBody);
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

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant record
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'products', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // Verify product belongs to merchant
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select(
        'id, name, description, brand, color, slug, condition, condition_detail, has_variants, variant_model'
      )
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (fetchError || !existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const existingVariantModel = normalizeProductVariantModel(
      existingProduct.variant_model
    );
    const variantModel =
      body.variant_model !== undefined
        ? normalizeProductVariantModel(body.variant_model)
        : body.has_variants === false
          ? existingVariantModel
          : existingVariantModel === 'sku_matrix'
            ? 'sku_matrix'
            : body.variants !== undefined
              ? inferProductVariantModel({ variants: body.variants })
              : existingVariantModel;
    const shouldValidateSkuMatrixInput =
      variantModel === 'sku_matrix' &&
      (body.variant_model !== undefined ||
        body.variants !== undefined ||
        body.has_variants === false);
    const skuMatrixValidationError = shouldValidateSkuMatrixInput
      ? getSkuMatrixValidationError({
          variantModel,
          hasVariants: body.has_variants ?? existingProduct.has_variants,
          variants: body.variants,
        })
      : null;

    if (skuMatrixValidationError) {
      return NextResponse.json(
        { error: skuMatrixValidationError },
        { status: 400 }
      );
    }

    const variantWriteProjections =
      body.variants !== undefined || body.has_variants !== undefined
        ? deriveProductVariantWriteProjections({
            fallbackColor:
              body.color !== undefined ? body.color : existingProduct.color,
            hasVariants: body.has_variants ?? existingProduct.has_variants,
            productImages: body.images,
            variants: body.variants,
          })
        : null;

    // Build updates object conditionally (2026 best practice: only update provided fields)
    // This prevents overwriting existing values with undefined on partial updates
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Core fields - only add if provided
    if (body.name !== undefined) {
      updates.name =
        typeof body.name === 'string' ? sanitizeText(body.name) : body.name;
    }
    // Sanitize description to prevent Stored XSS
    if (body.description !== undefined)
      updates.description =
        body.description !== null ? sanitizeHtml(body.description) : null;
    if (variantModel !== 'sku_matrix' && body.price !== undefined) {
      updates.price = body.price;
    }
    if (variantModel !== 'sku_matrix' && body.stock !== undefined) {
      updates.stock_quantity = body.stock;
    }

    // Generate slug only if name or condition changed
    if (body.slug !== undefined) {
      updates.slug = body.slug;
    } else if (body.name !== undefined) {
      updates.slug = generateProductSlug(
        body.name,
        variantModel === 'sku_matrix'
          ? existingProduct.condition
          : (body.condition ?? existingProduct.condition),
        body.condition_detail ?? existingProduct.condition_detail
      );
    }

    // Generate SKU only if explicitly provided or name changed
    if (body.sku !== undefined) {
      updates.sku = body.sku;
    } else if (body.name !== undefined) {
      updates.sku = generateSlug(body.name).toUpperCase().substring(0, 20);
    }

    // SEO fields - generate only if source changed
    if (body.meta_title !== undefined) {
      updates.meta_title =
        typeof body.meta_title === 'string'
          ? sanitizeText(body.meta_title)
          : body.meta_title;
    } else if (body.name !== undefined) {
      updates.meta_title = updates.name as string;
    }

    if (body.meta_description !== undefined) {
      updates.meta_description =
        typeof body.meta_description === 'string'
          ? sanitizeText(body.meta_description)
          : body.meta_description;
    } else if (body.description !== undefined && body.description !== null) {
      updates.meta_description = generateMetaDescription(
        updates.description as string
      );
    }

    // Pricing fields
    if (body.compare_at_price !== undefined)
      updates.compare_at_price = body.compare_at_price;
    if (body.cost_price !== undefined) updates.cost_price = body.cost_price;
    if (body.low_stock_threshold !== undefined)
      updates.low_stock_threshold = body.low_stock_threshold;

    // Image fields
    if (body.images !== undefined) {
      updates.images = body.images;
    }
    if (
      body.images === undefined &&
      (body.image !== undefined || body.imageLarge !== undefined)
    ) {
      const primaryImage = body.image ?? body.imageLarge;
      const sanitizedImage = primaryImage
        ? sanitizeText(primaryImage)
        : primaryImage;
      updates.images = sanitizedImage
        ? [
            {
              url: sanitizedImage,
              alt:
                (typeof updates.name === 'string'
                  ? updates.name
                  : sanitizeText(existingProduct.name)) || 'Product image',
              order: 0,
            },
          ]
        : [];
    }
    if (body.imageHint !== undefined) updates.image_hint = body.imageHint;

    // Physical attributes
    if (body.weight_value !== undefined)
      updates.weight_value = body.weight_value;
    if (body.weight_unit !== undefined) updates.weight_unit = body.weight_unit;
    if (body.dimensions !== undefined) updates.dimensions = body.dimensions;

    // Status fields
    if (body.status !== undefined) {
      updates.status = body.status;
    }

    // Tax fields
    if (body.taxable !== undefined) updates.taxable = body.taxable;
    if (body.tax_code !== undefined) updates.tax_code = body.tax_code;

    // Condition fields
    if (variantModel !== 'sku_matrix' && body.condition !== undefined) {
      updates.condition = body.condition;
    }
    if (body.condition_detail !== undefined)
      updates.condition_detail = body.condition_detail;

    // Additional SEO fields
    if (body.keywords !== undefined) {
      updates.keywords =
        typeof body.keywords === 'string'
          ? sanitizeText(body.keywords)
          : body.keywords;
    }
    if (body.canonical_url !== undefined) {
      updates.canonical_url =
        typeof body.canonical_url === 'string'
          ? sanitizeText(body.canonical_url)
          : body.canonical_url;
    }

    // Identifiers
    if (body.gtin !== undefined) updates.gtin = body.gtin;
    if (body.mpn !== undefined) updates.mpn = body.mpn;
    if (body.google_product_category !== undefined)
      updates.google_product_category = body.google_product_category;
    if (body.brand !== undefined) {
      updates.brand =
        typeof body.brand === 'string' ? sanitizeText(body.brand) : body.brand;
    }

    // Other fields
    if (body.fulfillment_details !== undefined)
      updates.fulfillment_details = body.fulfillment_details;
    if (body.has_variants !== undefined)
      updates.has_variants = body.has_variants;
    const deferredVariantModelUpdates =
      body.variant_model !== undefined || body.variants !== undefined
        ? {
            variant_model: variantModel,
            ...(variantModel === 'sku_matrix'
              ? { migration_status: 'migrated' as const }
              : {}),
          }
        : null;
    if (body.category !== undefined) updates.category = body.category;
    if (body.color !== undefined || variantWriteProjections) {
      updates.color = variantWriteProjections?.color ?? body.color;
    }

    // Schema markup - generate or sanitize
    if (body.schema_markup !== undefined) {
      updates.schema_markup = sanitizeSchemaMarkup(body.schema_markup);
    } else if (
      body.name !== undefined ||
      body.description !== undefined ||
      body.price !== undefined
    ) {
      // Regenerate schema if core product fields changed
      const schemaName = String(body.name ?? existingProduct.name ?? '');
      const schemaDescription = String(
        updates.description ?? existingProduct.description ?? ''
      );
      const schemaSku = String(updates.sku ?? '');

      // Fetch country and business_name for schema generation
      const { data: merchantDetails } = await supabase
        .from('merchants')
        .select('business_name, country')
        .eq('id', merchantId)
        .single();
      const businessName =
        merchantDetails?.business_name ?? merchantContext.businessName ?? '';
      const country = merchantDetails?.country
        ? getCountryByCode(merchantDetails.country)
        : undefined;
      const currency = country ? country.currency : 'USD';

      const productForSchema: Product = {
        id: id,
        name: schemaName,
        description: schemaDescription,
        price: body.price ?? 0,
        stock: body.stock ?? 0,
        manage_stock: body.manage_stock ?? true,
        status: (body.status ?? 'draft') as 'draft' | 'active' | 'archived',
        image: body.images?.[0]?.url || '',
        imageLarge: body.images?.[0]?.url || '',
        imageHint: body.imageHint || '',
        brand: body.brand || businessName,
        sku: schemaSku,
        gtin: body.gtin ?? '',
        mpn: body.mpn ?? '',
        weight_value: body.weight_value,
        weight_unit: body.weight_unit,
        condition: body.condition,
      };

      updates.schema_markup = generateProductSchema(
        productForSchema,
        businessName,
        currency
      );
    }

    let updatedProduct = existingProduct;
    let hasFreshProductRow = false;
    if (Object.keys(updates).length > 1) {
      const { data: persistedProduct, error: updateError } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .eq('merchant_id', merchantId)
        .select(PRODUCT_COLUMNS)
        .single();

      if (updateError) {
        console.error('Error updating product:', updateError);
        return NextResponse.json(
          { error: 'Failed to update product' },
          { status: 500 }
        );
      }

      updatedProduct = persistedProduct;
      hasFreshProductRow = true;
    }

    // Handle Variants
    if (body.variants !== undefined && body.has_variants !== false) {
      type RequestVariant = NonNullable<typeof body.variants>[number];

      // 1. Get IDs of variants to keep
      const variantIdsToKeep = body.variants
        .filter((v: RequestVariant) => v.id)
        .map((v: RequestVariant) => v.id);

      // 2. Delete variants not in the list
      if (variantIdsToKeep.length > 0) {
        const { error: deleteVariantsError } = await supabase
          .from('product_variants')
          .delete()
          .eq('product_id', id)
          .eq('merchant_id', merchantId)
          .not('id', 'in', `(${variantIdsToKeep.join(',')})`);
        if (deleteVariantsError) {
          console.error('Error deleting stale variants:', deleteVariantsError);
          return NextResponse.json(
            { error: 'Failed to sync product variants' },
            { status: 500 }
          );
        }
      } else {
        const { error: deleteVariantsError } = await supabase
          .from('product_variants')
          .delete()
          .eq('product_id', id)
          .eq('merchant_id', merchantId);
        if (deleteVariantsError) {
          console.error(
            'Error deleting product variants:',
            deleteVariantsError
          );
          return NextResponse.json(
            { error: 'Failed to sync product variants' },
            { status: 500 }
          );
        }
      }

      // 3. Separate updates and inserts
      const variantsToUpsert = body.variants.map((v: RequestVariant) => ({
        id: v.id,
        product_id: id,
        merchant_id: merchantId,
        condition: v.condition,
        attributes: v.attributes,
        price_override: v.price_override,
        cost_price: v.cost_price, // New field
        stock_quantity: v.stock_quantity,
        sku: v.sku,
        primary_image: v.primary_image,
        images: v.images || [],
      }));

      const variantsToUpdate = variantsToUpsert.filter(
        (v: (typeof variantsToUpsert)[number]) => v.id
      );
      const variantsToInsert = variantsToUpsert.filter(
        (v: (typeof variantsToUpsert)[number]) => !v.id
      );

      if (variantsToUpdate.length > 0) {
        const { error: updateVarError } = await supabase
          .from('product_variants')
          .upsert(variantsToUpdate);
        if (updateVarError) {
          console.error('Error updating variants:', updateVarError);
          return NextResponse.json(
            { error: 'Failed to update product variants' },
            { status: 500 }
          );
        }
      }

      if (variantsToInsert.length > 0) {
        const { error: insertVarError } = await supabase
          .from('product_variants')
          .insert(variantsToInsert);
        if (insertVarError) {
          console.error('Error inserting variants:', insertVarError);
          return NextResponse.json(
            { error: 'Failed to create product variants' },
            { status: 500 }
          );
        }
      }
    } else if (body.has_variants === false) {
      const { error: deleteVariantsError } = await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', id)
        .eq('merchant_id', merchantId);
      if (deleteVariantsError) {
        console.error('Error deleting product variants:', deleteVariantsError);
        return NextResponse.json(
          { error: 'Failed to delete product variants' },
          { status: 500 }
        );
      }
    }

    if (deferredVariantModelUpdates) {
      const { data: variantModelProduct, error: variantModelError } =
        await supabase
          .from('products')
          .update({
            ...deferredVariantModelUpdates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('merchant_id', merchantId)
          .select(PRODUCT_COLUMNS)
          .single();

      if (variantModelError) {
        console.error(
          'Error updating product variant model state:',
          variantModelError
        );
        return NextResponse.json(
          { error: 'Failed to sync product variant model' },
          { status: 500 }
        );
      }

      updatedProduct = variantModelProduct;
      hasFreshProductRow = true;
    }

    if (!hasFreshProductRow) {
      const { data: refreshedProduct, error: refreshedProductError } =
        await supabase
          .from('products')
          .select(PRODUCT_COLUMNS)
          .eq('id', id)
          .eq('merchant_id', merchantId)
          .single();

      if (refreshedProductError) {
        console.error(
          'Error refreshing updated product:',
          refreshedProductError
        );
        return NextResponse.json(
          { error: 'Failed to load updated product' },
          { status: 500 }
        );
      }

      updatedProduct = refreshedProduct;
    }

    // Regenerate embedding if name or description changed
    if (updatedProduct && (body.name || body.description)) {
      const embeddingText = getProductEmbeddingText({
        name: updatedProduct.name,
        description: updatedProduct.description,
        brand: updatedProduct.brand,
        category_name: body.category,
      });
      const serviceRoleKey = getSupabaseServiceRoleKey();

      // Fire-and-forget: Call edge function to regenerate embedding
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
            id: updatedProduct.id,
            text: embeddingText,
          }),
          signal: AbortSignal.timeout(10_000),
        }
      ).catch((err) =>
        console.error('Failed to regenerate product embedding:', err)
      );
    }

    // Invalidate product caches so storefront reflects changes immediately
    revalidateProducts(merchantId, updatedProduct.slug);

    return NextResponse.json({ product: updatedProduct });
  } catch (error) {
    console.error('Unexpected error in PUT /api/products/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid && response) return response;

  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'products', 'delete')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchantId);

    if (deleteError) {
      console.error('Error deleting product:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete product' },
        { status: 500 }
      );
    }

    // Invalidate product caches after deletion
    revalidateProducts(merchantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/products/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
