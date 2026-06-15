import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedImportedProduct } from '@/lib/imports/bumpa/bumpa-types';
import { generateProductSlug } from '@/lib/seo-utils';

interface CommitBumpaProductsInput {
  supabase: SupabaseClient;
  merchantId: string;
  importJobId: string;
  products: NormalizedImportedProduct[];
}

interface ExistingProductRecord {
  id: string;
  slug: string | null;
  external_id: string | null;
  external_source: string | null;
}

interface CommitBumpaProductsResult {
  createdProducts: number;
  updatedProducts: number;
}

function buildProductImages(product: NormalizedImportedProduct) {
  return product.images.map((url) => ({
    url,
    alt: product.title,
  }));
}

function resolveUniqueSlug(
  baseSlug: string,
  usedSlugs: Set<string>,
  existingSlug: string | null
) {
  if (existingSlug) {
    usedSlugs.add(existingSlug);
    return existingSlug;
  }

  let candidate = baseSlug;
  let suffix = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  usedSlugs.add(candidate);
  return candidate;
}

export async function commitBumpaProducts({
  supabase,
  merchantId,
  importJobId,
  products,
}: CommitBumpaProductsInput): Promise<CommitBumpaProductsResult> {
  const existingProducts: ExistingProductRecord[] = [];
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const end = start + pageSize - 1;
    const { data, error } = await supabase
      .from('products')
      .select('id, slug, external_id, external_source')
      .eq('merchant_id', merchantId)
      .order('id', { ascending: true })
      .range(start, end);

    if (error) {
      throw new Error(`Failed to load existing products: ${error.message}`);
    }

    const page = (data || []) as ExistingProductRecord[];
    existingProducts.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  const usedSlugs = new Set<string>();
  const productsByExternalId = new Map<string, ExistingProductRecord>();

  for (const product of existingProducts) {
    if (product.slug) {
      usedSlugs.add(product.slug);
    }

    if (product.external_id && product.external_source === 'bumpa') {
      productsByExternalId.set(product.external_id, product);
    }
  }

  let createdProducts = 0;
  let updatedProducts = 0;

  for (const product of products) {
    const existingProduct = productsByExternalId.get(product.externalSourceId);
    const baseSlug =
      generateProductSlug(product.title) || product.externalSourceId;
    const slug = resolveUniqueSlug(
      baseSlug,
      usedSlugs,
      existingProduct?.slug || null
    );
    const payload = {
      merchant_id: merchantId,
      name: product.title,
      description: product.description,
      price: product.price,
      stock_quantity: product.stock,
      stock: product.stock,
      manage_stock: product.manageStock,
      category: product.category,
      sku: product.sku,
      status: product.status,
      slug,
      images: buildProductImages(product),
      image_small: product.images[0] || null,
      image_large: product.images[0] || null,
      external_source: product.sourcePlatform,
      external_id: product.externalSourceId,
      import_job_id: importJobId,
      imported_at: new Date().toISOString(),
      metadata: {
        import_metadata: product.importMetadata,
      },
      created_at: product.sourceCreatedAt || undefined,
      updated_at: product.sourceUpdatedAt || undefined,
    };

    if (existingProduct) {
      const { error: updateError } = await supabase
        .from('products')
        .update(payload)
        .eq('id', existingProduct.id);

      if (updateError) {
        throw new Error(
          `Failed to update imported product: ${updateError.message}`
        );
      }

      updatedProducts += 1;
      continue;
    }

    const { error: insertError } = await supabase
      .from('products')
      .insert(payload);
    if (insertError) {
      throw new Error(
        `Failed to create imported product: ${insertError.message}`
      );
    }

    createdProducts += 1;
  }

  return {
    createdProducts,
    updatedProducts,
  };
}
