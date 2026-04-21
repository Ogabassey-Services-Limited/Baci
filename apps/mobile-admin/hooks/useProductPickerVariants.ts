import { useQuery } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import type { SelectedParentProduct } from '@/components/orders/new-order.types';
import {
  type AdminProductVariant,
  buildStructuredVariantPickerItems,
  type ProductPickerVariantParent,
  type ProductPickerVariantRow,
} from '@/lib/product-picker-variant-rows';
import { supabase } from '@/lib/supabase';

async function fetchAdminProductVariants(args: {
  merchantId: string;
  parentProduct: ProductPickerVariantParent & { id: string };
}): Promise<AdminProductVariant[]> {
  const { data: structuredVariants, error: structuredVariantsError } =
    await supabase
      .from('product_variants')
      .select(
        'id, attributes, condition, cost_price, images, price_override, primary_image, sku, stock_quantity'
      )
      .eq('merchant_id', args.merchantId)
      .eq('product_id', args.parentProduct.id);

  if (structuredVariantsError) {
    throw new Error(structuredVariantsError.message);
  }

  return buildStructuredVariantPickerItems({
    parentProduct: args.parentProduct,
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
  });
}

export { fetchAdminProductVariants };
