import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { useMerchant } from '@/hooks/useMerchant';
import {
  type ProductMatchCandidate,
  rankProductMatches,
} from '@/lib/product-matching';
import { supabase } from '@/lib/supabase';

const PRODUCT_SUGGESTION_COLUMNS = 'id,name,sku,price,category';

async function fetchProductNameSuggestions(args: {
  merchantId: string | undefined;
  productName: string;
  excludeProductId?: string;
}) {
  const trimmed = args.productName.trim();
  if (!args.merchantId || !trimmed || trimmed.length < 2) {
    return [];
  }

  let query = supabase
    .from('products')
    .select(PRODUCT_SUGGESTION_COLUMNS)
    .eq('merchant_id', args.merchantId)
    .is('parent_product_id', null)
    .textSearch('search_vector', trimmed, {
      type: 'websearch',
      config: 'english',
    })
    .order('created_at', { ascending: false })
    .limit(12);

  if (args.excludeProductId) {
    query = query.neq('id', args.excludeProductId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return rankProductMatches(
    args.productName,
    (data ?? []) as ProductMatchCandidate[],
    {
      excludeProductId: args.excludeProductId,
      limit: 4,
    }
  );
}

export function useProductNameSuggestions(args: {
  productName: string;
  excludeProductId?: string;
  enabled?: boolean;
}) {
  const { merchant } = useMerchant();
  const debouncedProductName = useDebounce(args.productName, 250);

  return useQuery({
    queryKey: [
      'product-name-suggestions',
      merchant?.id,
      debouncedProductName,
      args.excludeProductId,
    ],
    queryFn: () =>
      fetchProductNameSuggestions({
        merchantId: merchant?.id,
        productName: debouncedProductName,
        excludeProductId: args.excludeProductId,
      }),
    enabled:
      (args.enabled ?? true) &&
      !!merchant?.id &&
      debouncedProductName.trim().length >= 2,
    staleTime: 1000 * 30,
  });
}
