import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
import { tryRefreshStoreReadiness } from '@/lib/try-refresh-store-readiness';
import { productQueryKeys } from './product-query-keys';
import type { Product, ProductStatus } from './products.types';
import { updateProductStatus } from './products-data';
import { useMerchant } from './useMerchant';

type ProductMutationContext = { merchantId: string | undefined };

export function useUpdateProductStatus() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation<
    Product,
    Error,
    { productId: string; status: ProductStatus },
    ProductMutationContext
  >({
    mutationFn: ({ productId, status }) => {
      if (!merchant?.id) throw new Error('No merchant');
      return updateProductStatus(productId, status, merchant.id);
    },
    mutationKey: ['updateProductStatus'],
    onMutate: () => ({ merchantId: merchant?.id }),
    onSuccess: async (_data, { productId }, context) => {
      const merchantId = context?.merchantId;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: productQueryKeys.list(merchantId),
        }),
        queryClient.invalidateQueries({
          queryKey: productQueryKeys.detail(merchantId, productId),
        }),
        ...(merchantId
          ? [
              tryRefreshStoreReadiness(() =>
                invalidateStoreReadiness(queryClient, merchantId)
              ),
            ]
          : []),
      ]);
    },
  });
}
