import { supabase } from '@/lib/supabase';
import type { PersistedProductVariantInput } from './products.types';

export async function syncStructuredVariants(args: {
  hasVariants: boolean;
  merchantId: string;
  productId: string;
  variants: PersistedProductVariantInput[];
}) {
  if (!args.hasVariants) {
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', args.productId)
      .eq('merchant_id', args.merchantId);

    if (error) throw new Error(error.message);
    return;
  }

  const { data: existingVariants, error: existingVariantsError } =
    await supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', args.productId)
      .eq('merchant_id', args.merchantId);

  if (existingVariantsError) throw new Error(existingVariantsError.message);

  const variantIdsToKeep = new Set(
    args.variants.map((variant) => variant.id).filter(Boolean)
  );
  const variantIdsToDelete = (existingVariants ?? [])
    .map((variant) => variant.id)
    .filter((id) => !variantIdsToKeep.has(id));

  if (variantIdsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', args.productId)
      .eq('merchant_id', args.merchantId)
      .in('id', variantIdsToDelete);

    if (deleteError) throw new Error(deleteError.message);
  }

  const variantPayloads = args.variants.map((variant) => ({
    attributes: variant.attributes,
    condition: variant.condition ?? null,
    cost_price: variant.cost_price,
    id: variant.id,
    images: variant.images,
    merchant_id: args.merchantId,
    price_override: variant.price_override,
    primary_image: variant.primary_image,
    product_id: args.productId,
    sku: variant.sku,
    stock_quantity: variant.stock_quantity,
  }));
  const variantsToUpdate = variantPayloads.filter((variant) => variant.id);
  const variantsToInsert = variantPayloads
    .filter((variant) => !variant.id)
    .map(({ id, ...variant }) => variant);

  if (variantsToUpdate.length > 0) {
    const { error: updateError } = await supabase
      .from('product_variants')
      .upsert(variantsToUpdate);
    if (updateError) throw new Error(updateError.message);
  }

  if (variantsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('product_variants')
      .insert(variantsToInsert);
    if (insertError) throw new Error(insertError.message);
  }
}
