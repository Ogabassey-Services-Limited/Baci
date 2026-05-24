import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { formatVariantAttributesSummary } from '@/lib/format-variant-attributes';
import {
  type AdminProductSearchPage,
  fetchAdminProductSearchRows,
} from '@/lib/product-search';
import { supabase } from '@/lib/supabase';
import type { ReconciliationProductCandidate } from '@/lib/transaction-reconciliation';

interface ProductCandidateRow {
  id: string;
  name: string;
  price: number | null;
  status: string | null;
}

interface UnlinkedOrderItemRow {
  id: string;
  name: string | null;
  price: number | null;
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

const RECONCILIATION_PRODUCT_COLUMNS = 'id, name, price, status';
const RECONCILIATION_SEARCH_BATCH_SIZE = 4;
const RECONCILIATION_SEARCH_PAGE_SIZE = 20;

function getJoinedParent(value: VariantCandidateRow['products']) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function buildReconciliationSearchTerms(items: UnlinkedOrderItemRow[]) {
  const terms = new Set<string>();

  for (const item of items) {
    const normalizedName = (item.name ?? '')
      .replace(/\[[^\]]+\]/g, ' ')
      .replace(/\bimei\b[:\s-]*\d+/gi, ' ')
      .replace(/\bserial\b[:\s-]*[\w-]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalizedName.length >= 2) {
      terms.add(normalizedName);
    }
  }

  return [...terms];
}

function dedupeProductRows(rows: ProductCandidateRow[]) {
  const productsById = new Map<string, ProductCandidateRow>();
  for (const row of rows) {
    productsById.set(row.id, row);
  }

  return [...productsById.values()];
}

async function fetchCandidatePagesInBatches(
  searchTerms: string[],
  merchantId: string
) {
  const pages: Array<AdminProductSearchPage<ProductCandidateRow>> = [];

  for (
    let index = 0;
    index < searchTerms.length;
    index += RECONCILIATION_SEARCH_BATCH_SIZE
  ) {
    const batch = searchTerms.slice(
      index,
      index + RECONCILIATION_SEARCH_BATCH_SIZE
    );
    const batchPages = await Promise.all(
      batch.map((searchTerm) =>
        fetchAdminProductSearchRows<ProductCandidateRow>({
          cursor: 0,
          filters: { search: searchTerm },
          merchantId,
          pageSize: RECONCILIATION_SEARCH_PAGE_SIZE,
          selectColumns: RECONCILIATION_PRODUCT_COLUMNS,
        })
      )
    );

    pages.push(...batchPages);
  }

  return pages;
}

async function fetchUnlinkedOrderItems(merchantId: string) {
  const { data, error } = await supabase
    .from('order_items')
    .select(
      'id, name, price, quantity, cost_price, supplier_name, product_match_status, orders!inner(id, order_number, merchant_id, customer_name, payment_status, created_at)'
    )
    .eq('orders.merchant_id', merchantId)
    .eq('orders.payment_status', 'paid')
    .is('product_id', null)
    .neq('product_match_status', 'custom')
    .order('created_at', { referencedTable: 'orders', ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as UnlinkedOrderItemRow[];
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

      return fetchUnlinkedOrderItems(merchant.id);
    },
  });

  const unlinkedItems = (unlinkedItemsQuery.data ??
    []) as UnlinkedOrderItemRow[];
  const searchTerms = buildReconciliationSearchTerms(unlinkedItems);
  const productCandidatesQuery = useQuery({
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
    productCandidatesQuery,
    unlinkedItemsQuery,
  };
}
