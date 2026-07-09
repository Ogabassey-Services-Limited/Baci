import { useQuery } from '@tanstack/react-query';
import type { SelectedParentProduct } from '@/components/orders/new-order.types';
import { useMerchant } from '@/hooks/useMerchant';
import {
  type AdminProductVariant,
  buildStructuredVariantPickerItems,
  type ProductPickerVariantParent,
  type ProductPickerVariantRow,
} from '@/lib/product-picker-variant-rows';
import { supabase } from '@/lib/supabase';

interface ParentProductPriceRow {
  price: number | string | null;
}

function normalizeParentProductPrice(
  value: number | string | null | undefined,
  fallback: number
): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

async function fetchParentProductPrice(args: {
  fallbackPrice: number;
  merchantId: string;
  productId: string;
}): Promise<number> {
  const { data, error } = await supabase
    .from('products')
    .select('price')
    .eq('merchant_id', args.merchantId)
    .eq('id', args.productId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeParentProductPrice(
    (data as ParentProductPriceRow | null)?.price,
    args.fallbackPrice
  );
}

async function fetchAdminProductVariants(args: {
  merchantId: string;
  parentProduct: ProductPickerVariantParent & { id: string };
}): Promise<AdminProductVariant[]> {
  const parentProductPrice = await fetchParentProductPrice({
    fallbackPrice: args.parentProduct.price,
    merchantId: args.merchantId,
    productId: args.parentProduct.id,
  });
  const { data: structuredVariants, error: structuredVariantsError } =
    await supabase
      .from('product_variants')
      .select(
        'id, attributes, condition, cost_price, images, price_override, primary_image, sku, stock_quantity'
      )
      .eq('merchant_id', args.merchantId)
      .eq('product_id', args.parentProduct.id)
      .eq('is_inventory_anchor', false);

  if (structuredVariantsError) {
    throw new Error(structuredVariantsError.message);
  }

  return buildStructuredVariantPickerItems({
    parentProduct: {
      ...args.parentProduct,
      price: parentProductPrice,
    },
    parentProductId: args.parentProduct.id,
    variants: (structuredVariants as ProductPickerVariantRow[] | null) ?? [],
  });
}

export function useProductPickerVariants(parentProduct: SelectedParentProduct) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useQuery({
    queryKey: ['product-picker-variants', merchantId, parentProduct?.id],
    queryFn: (): Promise<AdminProductVariant[]> => {
      if (!parentProduct || !merchantId) {
        return Promise.resolve([]);
      }

      return fetchAdminProductVariants({
        merchantId,
        parentProduct: parentProduct as ProductPickerVariantParent & {
          id: string;
        },
      });
    },
    enabled: Boolean(parentProduct?.id && merchantId),
    // ⚡ Bolt Performance Optimization: Added staleTime to prevent repeated Supabase queries when remounting the component
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export { fetchAdminProductVariants };
