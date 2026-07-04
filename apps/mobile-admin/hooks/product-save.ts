import {
  inferProductVariantModel,
  normalizeProductVariantModel,
} from '@baci/shared';
import { normalizeProductInventory } from '@/lib/product-inventory';
import {
  revalidateStorefrontProducts,
  type StorefrontProductRevalidateEntry,
} from '@/lib/revalidate-storefront-products';
import { supabase } from '@/lib/supabase';
import {
  ProductDbSchema,
  type ProductFormValues,
} from '@/lib/validators/product';
import {
  assertNoDuplicateProduct,
  DUPLICATE_PRODUCT_ERROR,
  isDuplicateConstraintError,
} from './product-duplicate';
import type { Product } from './products.types';

export async function updateProductRecord(args: {
  id: string;
  merchantId: string;
  updates: ProductFormValues;
  /**
   * The product's PRE-SAVE category text / id, read from the loaded product in
   * the edit controller. When the save MOVES the product to a new category,
   * these seed a hint-only purge of the OLD category's cached URLs (see
   * `saveProductWithVariants`).
   */
  previousCategory?: string | null;
  previousCategoryId?: string | null;
}): Promise<Product> {
  const dbPayload = ProductDbSchema.parse(args.updates);
  const {
    variants,
    variant_model: persistedVariantModel,
    migration_status: _migrationStatus,
    ...productPayload
  } = dbPayload;
  const variantsForSync = productPayload.has_variants ? variants : [];
  const variantModel =
    productPayload.has_variants === false
      ? normalizeProductVariantModel(persistedVariantModel)
      : inferProductVariantModel({
          variantModel: persistedVariantModel,
          variants: variantsForSync,
        });

  await assertNoDuplicateProduct({
    excludeProductId: args.id,
    merchantId: args.merchantId,
    productName: productPayload.name,
  });

  return saveProductWithVariants({
    merchantId: args.merchantId,
    productId: args.id,
    productPayload,
    variantModel,
    variants: variantsForSync,
    previousCategory: args.previousCategory,
    previousCategoryId: args.previousCategoryId,
  });
}

export async function createProductRecord(args: {
  merchantId: string;
  newProduct: ProductFormValues;
}): Promise<Product> {
  const dbPayload = ProductDbSchema.parse(args.newProduct);
  const {
    variants,
    variant_model: persistedVariantModel,
    migration_status: _migrationStatus,
    ...productPayload
  } = dbPayload;
  const variantsForSync = productPayload.has_variants ? variants : [];
  const variantModel =
    productPayload.has_variants === false
      ? normalizeProductVariantModel(persistedVariantModel)
      : inferProductVariantModel({
          variantModel: persistedVariantModel,
          variants: variantsForSync,
        });

  await assertNoDuplicateProduct({
    merchantId: args.merchantId,
    productName: productPayload.name,
  });

  return saveProductWithVariants({
    merchantId: args.merchantId,
    productId: null,
    productPayload,
    variantModel,
    variants: variantsForSync,
  });
}

function normalizeCategoryValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

/**
 * True when an edit moved the product to a DIFFERENT category (by legacy text or
 * category_id). Requires a non-blank PRE-SAVE category text: without it we have
 * no old segment to hint, and a product that had NO category simply gains one —
 * its old `/products/<slug>` fallback is already re-purged by the primary entry.
 */
function hasCategoryMoved(args: {
  previousCategory: string | null | undefined;
  previousCategoryId: string | null | undefined;
  nextCategory: string | null | undefined;
  nextCategoryId: string | null | undefined;
}): boolean {
  if (!normalizeCategoryValue(args.previousCategory)) {
    return false;
  }
  return (
    normalizeCategoryValue(args.previousCategory) !==
      normalizeCategoryValue(args.nextCategory) ||
    normalizeCategoryValue(args.previousCategoryId) !==
      normalizeCategoryValue(args.nextCategoryId)
  );
}

async function saveProductWithVariants(args: {
  merchantId: string;
  productId: string | null;
  productPayload: Record<string, unknown>;
  variantModel: 'legacy' | 'sku_matrix';
  variants: unknown[];
  previousCategory?: string | null;
  previousCategoryId?: string | null;
}): Promise<Product> {
  const { data, error } = await supabase.rpc(
    'save_mobile_admin_product_with_variants',
    {
      p_merchant_id: args.merchantId,
      p_product_id: args.productId,
      p_product_payload: args.productPayload,
      p_variant_model: args.variantModel,
      p_variants: args.variants,
    }
  );

  if (error) {
    if (isDuplicateConstraintError(error))
      throw new Error(DUPLICATE_PRODUCT_ERROR);
    throw new Error(error.message);
  }

  const product = normalizeProductInventory(data as Product);

  // The RPC mutated the product without any web route running, so nothing has
  // evicted the storefront's raised-TTL edge cache. Fire-and-forget a purge of
  // the saved product's public URLs (never awaited, never throws).
  const purgeEntries: StorefrontProductRevalidateEntry[] = [
    { slug: product.slug, id: product.id, category: product.category },
  ];

  // A category MOVE leaves the OLD category's cached `/<oldCat>` listing and
  // `/<oldCat>/<slug>` PDP still pointing at this product. Web enrichment
  // resolves the segment for an ID-carrying entry from the CURRENT row, so the
  // primary entry above can only purge the NEW location. Append a HINT-ONLY
  // entry (NO id) carrying the pre-save category text: web enrichment only
  // OVERRIDES id-carrying entries (see apps/web
  // src/app/api/cache/revalidate/route.ts +
  // src/lib/internal-product-purge-entries.ts), so a no-id hint keeps its text
  // and resolves the OLD segment to purge.
  if (
    args.productId &&
    hasCategoryMoved({
      nextCategory: product.category,
      nextCategoryId: product.category_id,
      previousCategory: args.previousCategory,
      previousCategoryId: args.previousCategoryId,
    })
  ) {
    purgeEntries.push({
      slug: product.slug,
      category: args.previousCategory ?? null,
    });
  }

  void revalidateStorefrontProducts(purgeEntries, args.merchantId);

  return product;
}
