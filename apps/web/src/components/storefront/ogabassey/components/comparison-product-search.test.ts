import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchComparisonProductSearchResults } from './comparison-product-search';

describe('fetchComparisonProductSearchResults', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('requests compact product search data scoped to merchant and category', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ products: [] }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        const signal = new AbortController().signal;

        await fetchComparisonProductSearchResults({
            query: 'iphone',
            mainProduct: {
                id: 'main-product',
                merchantId: 'merchant-1',
                category: 'Smartphones',
                categorySlug: 'smartphones',
            },
            comparisonProducts: [],
            signal,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/storefront/products?q=iphone&limit=5&compact=false&merchant_id=merchant-1&category=smartphones',
            { signal }
        );
    });

    it('filters the current product and already selected comparison products', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                products: [
                    { id: 'main-product', name: 'Main' },
                    { id: 'selected-product', name: 'Selected' },
                    { id: 'candidate-product', name: 'Candidate' },
                ],
            }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        const results = await fetchComparisonProductSearchResults({
            query: 'phone',
            mainProduct: {
                id: 'main-product',
                merchantId: 'merchant-1',
                category: 'Smartphones',
                categorySlug: 'smartphones',
            },
            comparisonProducts: [{ id: 'selected-product' }],
            signal: new AbortController().signal,
        });

        expect(results).toEqual([{ id: 'candidate-product', name: 'Candidate' }]);
    });

    it('throws when the product search response is not OK', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: false,
            status: 503,
            json: async () => ({ products: [] }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(
            fetchComparisonProductSearchResults({
                query: 'pixel',
                mainProduct: {
                    id: 'main-product',
                    merchantId: 'merchant-1',
                    category: 'Smartphones',
                    categorySlug: 'smartphones',
                },
                comparisonProducts: [],
                signal: new AbortController().signal,
            })
        ).rejects.toThrow('Product search failed with status 503');
    });
});
