import type { Product } from '../types';
import type { SearchResultProduct } from './comparison-search-types';

interface FetchComparisonProductSearchResultsParams {
    query: string;
    mainProduct: Pick<Product, 'id' | 'merchantId' | 'category' | 'categorySlug'>;
    comparisonProducts: Array<Pick<Product, 'id'>>;
    signal: AbortSignal;
}

interface ProductSearchResponse {
    products?: SearchResultProduct[];
}

export async function fetchComparisonProductSearchResults({
    query,
    mainProduct,
    comparisonProducts,
    signal,
}: FetchComparisonProductSearchResultsParams) {
    const categorySlug = mainProduct.categorySlug || mainProduct.category;
    const params = new URLSearchParams({
        q: query,
        limit: '5',
        compact: 'false',
    });

    if (mainProduct.merchantId) {
        params.append('merchant_id', mainProduct.merchantId);
    }

    if (categorySlug) {
        params.append('category', categorySlug);
    }

    const res = await fetch(`/api/storefront/products?${params.toString()}`, { signal });

    if (!res.ok) {
        throw new Error(`Product search failed with status ${res.status}`);
    }

    const data = (await res.json()) as ProductSearchResponse;

    return (data.products || []).filter((product) =>
        String(product.id) !== String(mainProduct.id) &&
        !comparisonProducts.some((comparisonProduct) =>
            String(comparisonProduct.id) === String(product.id)
        )
    );
}
