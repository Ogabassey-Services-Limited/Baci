import { useEffect, useState } from 'react';
import type { Product } from '../types';
import { fetchComparisonProductSearchResults } from './comparison-product-search';
import type { SearchResultProduct } from './comparison-search-types';

const SEARCH_ERROR_MESSAGE = 'Could not load products. Try again.';

interface UseComparisonProductSearchOptions {
    mainProduct: Product;
    comparisonProducts: Product[];
}

export function useComparisonProductSearch({
    mainProduct,
    comparisonProducts,
}: UseComparisonProductSearchOptions) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResultProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    useEffect(() => {
        const trimmedQuery = query.trim();

        if (!trimmedQuery || trimmedQuery.length < 2) {
            return;
        }

        const controller = new AbortController();
        let isCurrentSearch = true;

        const searchProducts = () => {
            setLoading(true);
            setSearchError(null);
            fetchComparisonProductSearchResults({
                query: trimmedQuery,
                mainProduct,
                comparisonProducts,
                signal: controller.signal,
            })
                .then((filtered) => {
                    if (!isCurrentSearch) {
                        return;
                    }

                    setResults(filtered);
                    setSearchError(null);
                })
                .catch((err: unknown) => {
                    if (!isCurrentSearch || (err instanceof Error && err.name === 'AbortError')) {
                        return;
                    }

                    console.error('Search failed', err);
                    setResults([]);
                    setSearchError(SEARCH_ERROR_MESSAGE);
                })
                .finally(() => {
                    if (isCurrentSearch) {
                        setLoading(false);
                    }
                });
        };

        const timeout = setTimeout(searchProducts, 300);
        return () => {
            isCurrentSearch = false;
            clearTimeout(timeout);
            controller.abort();
        };
    }, [query, mainProduct.id, mainProduct.merchantId, mainProduct.category, mainProduct.categorySlug, comparisonProducts]);

    const handleQueryChange = (nextQuery: string) => {
        setQuery(nextQuery);

        const trimmedNextQuery = nextQuery.trim();
        if (!trimmedNextQuery || trimmedNextQuery.length < 2) {
            setResults([]);
            setSearchError(null);
            setLoading(false);
        }
    };

    const resetSearch = () => {
        setQuery('');
        setResults([]);
        setSearchError(null);
        setLoading(false);
    };

    const clearSearchError = () => {
        setSearchError(null);
    };

    return {
        query,
        results,
        loading,
        searchError,
        handleQueryChange,
        resetSearch,
        clearSearchError,
    };
}
