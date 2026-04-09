import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { useMerchant } from '@/hooks/useMerchant';
import {
  type ProductMatchCandidate,
  rankProductMatches,
} from '@/lib/product-matching';
import { fetchAdminProductSuggestionCandidates } from '@/lib/product-search';

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
  const data =
    await fetchAdminProductSuggestionCandidates<ProductMatchCandidate>({
      excludeProductId: args.excludeProductId,
      limit: 12,
      merchantId: args.merchantId,
      productName: trimmed,
      selectColumns: PRODUCT_SUGGESTION_COLUMNS,
    });

  return rankProductMatches(trimmed, data, {
    excludeProductId: args.excludeProductId,
    limit: 4,
  });
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
