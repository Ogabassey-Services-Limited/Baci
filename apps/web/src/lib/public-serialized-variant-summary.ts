import type { SupabaseClient } from '@supabase/supabase-js';

export interface PublicSerializedVariantSummary {
  productId: string;
  variantId: string | null;
  publicAvailableUnits: number;
  inventoryTrackingPolicy:
    | 'off'
    | 'serialized_strict'
    | 'serialized_then_unlimited';
}

/**
 * Resolves the effective tracking policy for a variant based on the product policy and the variant policy.
 */
export function getEffectiveInventoryTrackingPolicy(
  productPolicy: string,
  variantPolicy?: string | null
): 'off' | 'serialized_strict' | 'serialized_then_unlimited' {
  if (
    variantPolicy === 'off' ||
    variantPolicy === 'serialized_strict' ||
    variantPolicy === 'serialized_then_unlimited'
  ) {
    return variantPolicy;
  }
  if (
    productPolicy === 'serialized_strict' ||
    productPolicy === 'serialized_then_unlimited'
  ) {
    return productPolicy as 'serialized_strict' | 'serialized_then_unlimited';
  }
  return 'off';
}

/**
 * Fetches the public-safe serialized variant summaries for a list of products.
 * Handles chunking in 200-item batches to comply with the database RPC limits.
 */
export async function getPublicSerializedVariantSummariesByProductId(
  supabase: SupabaseClient,
  merchantId: string,
  productIds: string[],
  branchId?: string
): Promise<PublicSerializedVariantSummary[]> {
  if (!productIds || productIds.length === 0) {
    return [];
  }

  // 1. Chunk product IDs in batches of at most 200
  const chunks: string[][] = [];
  for (let i = 0; i < productIds.length; i += 200) {
    chunks.push(productIds.slice(i, i + 200));
  }

  // 2. Fetch data in parallel for each chunk
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      // Fetch products' tracking policies
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, inventory_tracking_policy, has_variants, status')
        .eq('merchant_id', merchantId)
        .in('id', chunk);

      if (productsError) {
        throw productsError;
      }

      // Fetch variants' tracking policies (including the anchor variant)
      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select(
          'id, product_id, inventory_tracking_policy, is_inventory_anchor'
        )
        .eq('merchant_id', merchantId)
        .in('product_id', chunk);

      if (variantsError) {
        throw variantsError;
      }

      // Fetch available counts from RPC
      const { data: counts, error: countsError } = await supabase.rpc(
        'get_public_serialized_variant_availability_counts',
        {
          p_merchant_id: merchantId,
          p_product_ids: chunk,
          p_branch_id: branchId || null,
        }
      );

      if (countsError) {
        throw countsError;
      }

      // 3. Reconcile and resolve
      const summaries: PublicSerializedVariantSummary[] = [];

      // Create maps for fast lookup
      const productsMap = new Map(products?.map((p) => [p.id, p]));
      const variantsByProductMap = new Map<string, typeof variants>();
      if (variants) {
        for (const v of variants) {
          const list = variantsByProductMap.get(v.product_id) || [];
          list.push(v);
          variantsByProductMap.set(v.product_id, list);
        }
      }

      const countsMap = new Map<string, number>(); // key: productId:variantId
      if (counts) {
        for (const c of counts) {
          const key = `${c.product_id}:${c.variant_id || 'null'}`;
          countsMap.set(key, c.public_available_units);
        }
      }

      // Resolve for each product in the chunk
      for (const productId of chunk) {
        const product = productsMap.get(productId);
        if (product?.status !== 'active') {
          continue; // Only active products are returned
        }

        const productVariants = variantsByProductMap.get(productId) || [];

        if (product.has_variants) {
          // Variant-based product: resolve for each non-anchor variant
          for (const variant of productVariants) {
            if (variant.is_inventory_anchor) {
              continue; // Exclude anchor variant from public/storefront summaries
            }

            const effectivePolicy = getEffectiveInventoryTrackingPolicy(
              product.inventory_tracking_policy,
              variant.inventory_tracking_policy
            );

            const countKey = `${productId}:${variant.id}`;
            const availableUnits = countsMap.get(countKey) || 0;

            summaries.push({
              productId,
              variantId: variant.id,
              publicAvailableUnits: availableUnits,
              inventoryTrackingPolicy: effectivePolicy,
            });
          }
        } else {
          // Simple product: resolve for the anchor variant or product policy
          const anchorVariant = productVariants.find(
            (v) => v.is_inventory_anchor
          );
          const effectivePolicy = getEffectiveInventoryTrackingPolicy(
            product.inventory_tracking_policy,
            anchorVariant?.inventory_tracking_policy
          );

          const countKey = `${productId}:null`;
          const availableUnits = countsMap.get(countKey) || 0;

          summaries.push({
            productId,
            variantId: null, // Simple products expose null variantId in summaries
            publicAvailableUnits: availableUnits,
            inventoryTrackingPolicy: effectivePolicy,
          });
        }
      }

      return summaries;
    })
  );

  // Use flatMap to avoid nested arrays
  return results.flat();
}
