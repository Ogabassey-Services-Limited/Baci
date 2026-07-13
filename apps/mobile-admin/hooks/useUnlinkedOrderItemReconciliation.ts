import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { formatVariantAttributesSummary } from '@/lib/format-variant-attributes';
import { supabase } from '@/lib/supabase';
import type { ReconciliationProductCandidate } from '@/lib/transaction-reconciliation';
import {
  buildReconciliationSearchTerms,
  dedupeProductRows,
  fetchCandidatePagesInBatches,
  fetchUnlinkedOrderItems,
  getJoinedParent,
  type ProductCandidateRow,
  type UnlinkedOrderItemRow,
  type VariantCandidateRow,
} from './unlinked-order-item-reconciliation-helpers';

export function useUnlinkedOrderItemReconciliation() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  const {
    data: unlinkedItemsData,
    error: unlinkedItemsError,
    isLoading: isLoadingUnlinkedItems,
    refetch: refetchUnlinkedItems,
  } = useQuery({
    enabled: Boolean(merchant?.id),
    queryKey: ['unlinked-order-items', merchant?.id],
    queryFn: () => {
      if (!merchant?.id) {
        throw new Error('Merchant context is not ready');
      }

      return fetchUnlinkedOrderItems(merchant.id);
    },
    // ⚡ Bolt Performance Optimization: Added staleTime to prevent repeated queries when unlinked order items screen is refocused
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const unlinkedItems = (unlinkedItemsData ?? []) as UnlinkedOrderItemRow[];
  const searchTerms = buildReconciliationSearchTerms(unlinkedItems);
  const {
    data: productCandidatesData,
    error: productCandidatesError,
    isLoading: isLoadingProductCandidates,
    refetch: refetchProductCandidates,
  } = useQuery({
    enabled: Boolean(merchant?.id && searchTerms.length > 0),
    queryKey: [
      'transaction-reconciliation-products',
      merchant?.id,
      searchTerms,
    ],
    queryFn: async (): Promise<ReconciliationProductCandidate[]> => {
      if (!merchant?.id) {
        throw new Error('Merchant context is not ready');
      }

      const itemsForSearch =
        unlinkedItems.length > 0
          ? unlinkedItems
          : await fetchUnlinkedOrderItems(merchant.id);
      const activeSearchTerms = buildReconciliationSearchTerms(itemsForSearch);
      if (activeSearchTerms.length === 0) {
        return [];
      }

      const candidatePages = await fetchCandidatePagesInBatches(
        activeSearchTerms,
        merchant.id
      );
      const products = dedupeProductRows(
        candidatePages.flatMap((page) => page.rows)
      );
      if (products.length === 0) {
        return [];
      }

      const productIds = products.map((product) => product.id);
      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select(
          'id, attributes, condition, price_override, products!inner(id, name, price, status, merchant_id)'
        )
        .eq('merchant_id', merchant.id)
        .eq('products.merchant_id', merchant.id)
        .in('product_id', productIds);

      if (variantsError) {
        throw new Error(variantsError.message);
      }

      const productCandidates = ((products ?? []) as ProductCandidateRow[]).map(
        (product) => ({
          name: product.name,
          parentName: null,
          price: Number(product.price ?? 0),
          productId: product.id,
          status: product.status,
          variantId: null,
        })
      );
      const variantCandidates = ((variants ?? []) as VariantCandidateRow[])
        .map((variant) => {
          const parent = getJoinedParent(variant.products);
          const variantSummary =
            formatVariantAttributesSummary(variant.attributes) ||
            variant.condition ||
            'Variant';

          return {
            name: variantSummary,
            parentName: parent?.name ?? null,
            price: Number(variant.price_override ?? parent?.price ?? 0),
            productId: parent?.id ?? '',
            status: parent?.status ?? null,
            variantId: variant.id,
          };
        })
        .filter((candidate) => candidate.productId);

      return [...productCandidates, ...variantCandidates];
    },
    // ⚡ Bolt Performance Optimization: Added staleTime to prevent repeated queries for product candidates
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const linkItemMutation = useMutation({
    mutationFn: async (input: {
      orderItemId: string;
      productId: string;
      variantId: string | null;
    }) => {
      if (!merchant?.id) {
        throw new Error('Merchant context is not ready');
      }

      const { error } = await supabase.rpc(
        'link_transaction_order_item_product',
        {
          p_merchant_id: merchant.id,
          p_order_item_id: input.orderItemId,
          p_product_id: input.productId,
          p_variant_id: input.variantId,
        }
      );

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlinked-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-review'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-detail'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
    },
  });

  const keepCustomMutation = useMutation({
    mutationFn: async (input: { orderItemId: string }) => {
      if (!merchant?.id) {
        throw new Error('Merchant context is not ready');
      }

      const { error } = await supabase.rpc(
        'mark_transaction_order_item_custom',
        {
          p_merchant_id: merchant.id,
          p_order_item_id: input.orderItemId,
        }
      );

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlinked-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-review'] });
    },
  });

  return {
    keepCustomMutation,
    linkItemMutation,
    productCandidatesQuery: {
      data: productCandidatesData,
      error: productCandidatesError,
      isLoading: isLoadingProductCandidates,
      refetch: refetchProductCandidates,
    },
    unlinkedItemsQuery: {
      data: unlinkedItemsData,
      error: unlinkedItemsError,
      isLoading: isLoadingUnlinkedItems,
      refetch: refetchUnlinkedItems,
    },
  };
}
