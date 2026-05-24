import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';

interface UpdateTransactionReviewDetailsInput {
  costPrice: number;
  orderId: string;
  orderItemId: string;
  productId: string | null;
  supplierName: string;
  transactionDateIso: string;
  updateProductDefault: boolean;
  variantId: string | null;
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isFutureCalendarDay(date: Date) {
  return getLocalDateKey(date) > getLocalDateKey(new Date());
}

function getClientTimeZone(): string | null {
  const resolvedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (typeof resolvedTimeZone !== 'string') {
    return null;
  }

  const trimmedTimeZone = resolvedTimeZone.trim();
  return trimmedTimeZone.length > 0 ? trimmedTimeZone : null;
}

export function useUpdateTransactionCostPrice() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: async ({
      costPrice,
      orderId,
      orderItemId,
      productId,
      supplierName,
      transactionDateIso,
      updateProductDefault,
      variantId,
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
      if (!orderId.trim() || !orderItemId.trim()) {
        throw new Error('Transaction and line item are required');
      }
      if (updateProductDefault && !productId?.trim()) {
        throw new Error('Product is required to update the catalog default');
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

      const clientTimeZone = getClientTimeZone();

      const { error } = await supabase.rpc(
        'update_transaction_review_details',
        {
          p_cost_price: costPrice,
          p_client_timezone: clientTimeZone,
          p_merchant_id: merchant.id,
          p_order_id: orderId.trim(),
          p_order_item_id: orderItemId.trim(),
          p_product_id: productId?.trim() || null,
          p_supplier_name: supplierName,
          p_transaction_date: parsedTransactionDate.toISOString(),
          p_update_product_default: updateProductDefault,
          p_variant_id: variantId?.trim() || null,
        }
      );

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
