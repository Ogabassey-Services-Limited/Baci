import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';

export function useUpdateTransactionCostPrice() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: async ({
      costPrice,
      productId,
    }: {
      costPrice: number;
      productId: string;
    }) => {
      if (
        typeof costPrice !== 'number' ||
        !Number.isFinite(costPrice) ||
        costPrice < 0
      ) {
        throw new Error('Cost price must be a non-negative number');
      }
      if (!merchant?.id) {
        throw new Error('Merchant context is not ready');
      }

      // Select the updated row so we can detect the silent-success case
      // where the update matched zero rows (wrong merchant, stale product id,
      // or RLS mismatch) and surface it as a clear error to the caller.
      const { data, error } = await supabase
        .from('products')
        .update({
          cost_price: costPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('merchant_id', merchant.id)
        .select('id');

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        throw new Error(
          'Product not found for this merchant, or you no longer have permission to update it'
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-review'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-detail'] });
      queryClient.invalidateQueries({ queryKey: ['top-selling-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
