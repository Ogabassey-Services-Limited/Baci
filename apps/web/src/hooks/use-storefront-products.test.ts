import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStorefrontProducts } from '@/hooks/use-storefront-products';

const sampleProduct = {
  id: 'prod-1',
  name: 'Test Product',
  price: 100,
};

describe('useStorefrontProducts', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stays idle and performs no fetch when no store slug is provided', () => {
    const { result } = renderHook(() => useStorefrontProducts({}));

    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches and exposes products for a store slug', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ products: [sampleProduct] }),
    } as Response);

    const { result } = renderHook(() =>
      useStorefrontProducts({ storeSlug: 'ogabassey' })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.products).toEqual([sampleProduct]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces an error and clears products when the request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
    } as Response);

    const { result } = renderHook(() =>
      useStorefrontProducts({ storeSlug: 'ogabassey' })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.products).toEqual([]);
  });

  it('resets to the idle state when the slug transitions to empty', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ products: [sampleProduct] }),
    } as Response);

    const { result, rerender } = renderHook(
      ({ storeSlug }: { storeSlug?: string }) =>
        useStorefrontProducts({ storeSlug }),
      { initialProps: { storeSlug: 'ogabassey' as string | undefined } }
    );

    await waitFor(() =>
      expect(result.current.products).toEqual([sampleProduct])
    );

    rerender({ storeSlug: undefined });

    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
