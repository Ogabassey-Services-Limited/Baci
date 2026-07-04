import {
  inferProductVariantModel,
  normalizeProductVariantModel,
} from '@baci/shared';
import { normalizeProductInventory } from '@/lib/product-inventory';
import { revalidateStorefrontProducts } from '@/lib/revalidate-storefront-products';
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

async function saveProductWithVariants(args: {
  merchantId: string;
  productId: string | null;
  productPayload: Record<string, unknown>;
  variantModel: 'legacy' | 'sku_matrix';
  variants: unknown[];
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
  void revalidateStorefrontProducts([
    { slug: product.slug, id: product.id, category: product.category },
  ]);

  return product;
}
