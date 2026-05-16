import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';

interface UpdateTransactionReviewDetailsInput {
  costPrice: number;
  orderId: string;
  productId: string;
  supplierName: string;
  transactionDateIso: string;
}

function getUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isFutureCalendarDay(date: Date) {
  return getUtcDateKey(date) > getUtcDateKey(new Date());
}

export function useUpdateTransactionCostPrice() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: async ({
      costPrice,
      orderId,
      productId,
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
      if (isFutureCalendarDay(parsedTransactionDate)) {
        throw new Error('Transaction date cannot be in the future.');
      }

      const { error } = await supabase.rpc('update_transaction_review_details', {
        p_cost_price: costPrice,
        p_merchant_id: merchant.id,
        p_order_id: orderId.trim(),
        p_product_id: productId.trim(),
        p_supplier_name: supplierName,
        p_transaction_date: parsedTransactionDate.toISOString(),
      });

      if (error) {
        throw new Error(error.message);
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
