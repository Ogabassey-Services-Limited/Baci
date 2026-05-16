import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import { mergeSupplierMetadata } from '@/lib/transaction-review';

interface UpdateTransactionReviewDetailsInput {
  costPrice: number;
  orderId: string;
  productId: string;
  productMetadata: Record<string, unknown> | null;
  supplierName: string;
  transactionDateIso: string;
}

export function useUpdateTransactionCostPrice() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: async ({
      costPrice,
      orderId,
      productId,
      productMetadata,
      supplierName,
      transactionDateIso,
    }: UpdateTransactionReviewDetailsInput) => {
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
      if (!orderId.trim() || !productId.trim()) {
        throw new Error('Transaction and product are required');
      }
      if (!transactionDateIso.trim()) {
        throw new Error('Enter a valid transaction date.');
      }

      const parsedTransactionDate = new Date(transactionDateIso);
      if (Number.isNaN(parsedTransactionDate.getTime())) {
        throw new Error('Enter a valid transaction date.');
      }
      if (parsedTransactionDate.getTime() > Date.now()) {
        throw new Error('Transaction date cannot be in the future.');
      }

      // Select the updated row so we can detect the silent-success case
      // where the update matched zero rows (wrong merchant, stale product id,
      // or RLS mismatch) and surface it as a clear error to the caller.
      const { data, error } = await supabase
        .from('products')
        .update({
          cost_price: costPrice,
          metadata: mergeSupplierMetadata(productMetadata, supplierName),
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

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .update({
          transaction_date: parsedTransactionDate.toISOString(),
        })
        .eq('id', orderId)
        .eq('merchant_id', merchant.id)
        .select('id');

      if (orderError) {
        throw new Error(orderError.message);
      }

      if (!orderData || orderData.length === 0) {
        throw new Error(
          'Transaction not found for this merchant, or you no longer have permission to update it'
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
