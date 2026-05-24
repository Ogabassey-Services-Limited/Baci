import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { formatVariantAttributesSummary } from '@/lib/format-variant-attributes';
import { supabase } from '@/lib/supabase';
import type { ReconciliationProductCandidate } from '@/lib/transaction-reconciliation';

interface ProductCandidateRow {
  id: string;
  name: string;
  price: number | null;
  status: string | null;
}

interface VariantCandidateRow {
  attributes: unknown;
  condition: string | null;
  id: string;
  price_override: number | null;
  products:
    | {
        id: string;
        merchant_id: string;
        name: string;
        price: number | null;
        status: string | null;
      }
    | Array<{
        id: string;
        merchant_id: string;
        name: string;
        price: number | null;
        status: string | null;
      }>
    | null;
}

function getJoinedParent(value: VariantCandidateRow['products']) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function useUnlinkedOrderItemReconciliation() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  const unlinkedItemsQuery = useQuery({
    enabled: Boolean(merchant?.id),
    queryKey: ['unlinked-order-items', merchant?.id],
    queryFn: async () => {
      if (!merchant?.id) {
        throw new Error('Merchant context is not ready');
      }

      const { data, error } = await supabase
        .from('order_items')
        .select(
          'id, name, price, quantity, cost_price, supplier_name, product_match_status, orders!inner(id, order_number, merchant_id, customer_name, payment_status, created_at)'
        )
        .eq('orders.merchant_id', merchant.id)
        .eq('orders.payment_status', 'paid')
        .is('product_id', null)
        .neq('product_match_status', 'custom')
        .order('created_at', { referencedTable: 'orders', ascending: false })
        .limit(100);

      if (error) {
        throw new Error(error.message);
      }

      return data ?? [];
    },
  });

  const productCandidatesQuery = useQuery({
    enabled: Boolean(merchant?.id),
    queryKey: ['transaction-reconciliation-products', merchant?.id],
    queryFn: async (): Promise<ReconciliationProductCandidate[]> => {
      if (!merchant?.id) {
        throw new Error('Merchant context is not ready');
      }

      const [
        { data: products, error: productsError },
        { data: variants, error: variantsError },
      ] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, price, status')
          .eq('merchant_id', merchant.id)
          .limit(200),
        supabase
          .from('product_variants')
          .select(
            'id, attributes, condition, price_override, products!inner(id, name, price, status, merchant_id)'
          )
          .eq('merchant_id', merchant.id)
          .eq('products.merchant_id', merchant.id)
          .limit(200),
      ]);

      if (productsError) {
        throw new Error(productsError.message);
      }

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

      const { error } = await supabase
        .from('order_items')
        .update({ product_match_status: 'custom' })
        .eq('id', input.orderItemId)
        .is('product_id', null);

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
    productCandidatesQuery,
    unlinkedItemsQuery,
  };
}
