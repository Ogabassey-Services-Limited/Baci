import {
  inferProductVariantModel,
  MOBILE_ADMIN_PRODUCT_COLUMNS as PRODUCT_COLUMNS,
  normalizeProductVariantModel,
} from '@baci/shared';
import { normalizeProductInventory } from '@/lib/product-inventory';
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
import { syncStructuredVariants } from './product-variant-sync';
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

  const { data, error } = await supabase
    .from('products')
    .update({ ...productPayload, updated_at: new Date().toISOString() })
    .eq('id', args.id)
    .eq('merchant_id', args.merchantId)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) {
    if (isDuplicateConstraintError(error)) throw new Error(DUPLICATE_PRODUCT_ERROR);
    throw new Error(error.message);
  }

  await syncStructuredVariants({
    hasVariants: productPayload.has_variants,
    merchantId: args.merchantId,
    productId: args.id,
    variants: variantsForSync,
  });

  const { data: rolloutProduct, error: rolloutError } = await supabase
    .from('products')
    .update({
      variant_model: variantModel,
      ...(variantModel === 'sku_matrix'
        ? { migration_status: 'migrated' as const }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.id)
    .eq('merchant_id', args.merchantId)
    .select(PRODUCT_COLUMNS)
    .single();

  if (rolloutError) throw new Error(rolloutError.message);

  return normalizeProductInventory(rolloutProduct ?? data);
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

  const { data, error } = await supabase
    .from('products')
    .insert([{ ...productPayload, merchant_id: args.merchantId }])
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) {
    if (isDuplicateConstraintError(error)) throw new Error(DUPLICATE_PRODUCT_ERROR);
    throw new Error(error.message);
  }

  try {
    await syncStructuredVariants({
      hasVariants: productPayload.has_variants,
      merchantId: args.merchantId,
      productId: data.id,
      variants: variantsForSync,
    });

    const { data: rolloutProduct, error: rolloutError } = await supabase
      .from('products')
      .update({
        variant_model: variantModel,
        ...(variantModel === 'sku_matrix'
          ? { migration_status: 'migrated' as const }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .eq('merchant_id', args.merchantId)
      .select(PRODUCT_COLUMNS)
      .single();

    if (rolloutError) throw new Error(rolloutError.message);
    return normalizeProductInventory(rolloutProduct ?? data);
  } catch (variantError) {
    await supabase
      .from('products')
      .delete()
      .eq('id', data.id)
      .eq('merchant_id', args.merchantId);
    throw variantError;
  }
}
