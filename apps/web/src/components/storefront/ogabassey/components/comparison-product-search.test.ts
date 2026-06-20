import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchComparisonProductSearchResults } from './comparison-product-search';

describe('fetchComparisonProductSearchResults', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('requests product search data scoped to merchant and category with full product details', async () => {
        const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => ({
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

        expect(fetchMock).toHaveBeenCalledTimes(1);

        const firstCall = fetchMock.mock.calls[0];
        expect(firstCall).toBeDefined();

        const [requestUrl, requestInit] = firstCall;
        const url = new URL(String(requestUrl), 'http://localhost');

        expect(url.pathname).toBe('/api/storefront/products');
        expect(url.searchParams.get('q')).toBe('iphone');
        expect(url.searchParams.get('limit')).toBe('5');
        expect(url.searchParams.get('compact')).toBe('false');
        expect(url.searchParams.get('merchant_id')).toBe('merchant-1');
        expect(url.searchParams.get('category')).toBe('smartphones');
        expect(requestInit).toEqual({ signal });
    });

    it('forwards typo comparison searches to the same merchant-scoped storefront API', async () => {
        const fetchMock = vi.fn(
            async (_input: string | URL | Request, _init?: RequestInit) => ({
                ok: true,
                status: 200,
                json: async () => ({
                    products: [
                        {
                            id: 'candidate-product',
                            name: 'iPhone 16 Pro',
                            price: 1200000,
                        },
                    ],
                }),
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        const signal = new AbortController().signal;
        const results = await fetchComparisonProductSearchResults({
            query: 'iphnoe',
            mainProduct: {
                id: 'main-product',
                merchantId: 'merchant-1',
                category: 'Smartphones',
                categorySlug: 'smartphones',
            },
            comparisonProducts: [],
            signal,
        });

        const firstCall = fetchMock.mock.calls[0];
        expect(firstCall).toBeDefined();

        const [requestUrl, requestInit] = firstCall;
        const url = new URL(String(requestUrl), 'http://localhost');

        expect(url.pathname).toBe('/api/storefront/products');
        expect(url.searchParams.get('q')).toBe('iphnoe');
        expect(url.searchParams.get('merchant_id')).toBe('merchant-1');
        expect(url.searchParams.get('category')).toBe('smartphones');
        expect(url.searchParams.get('compact')).toBe('false');
        expect(requestInit).toEqual({ signal });
        expect(results).toEqual([
            { id: 'candidate-product', name: 'iPhone 16 Pro', price: 1200000 },
        ]);
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
