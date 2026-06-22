import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { useStorefrontScopedRoute } from './use-storefront-scoped-route';

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: vi.fn(),
}));

describe('useStorefrontScopedRoute', () => {
  it('returns a function that scopes routes to the current merchant basePath', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      basePath: '/test-store',
    } as any);
    const { result } = renderHook(() => useStorefrontScopedRoute());

    expect(result.current('/products')).toBe('/test-store/products');
  });

  it('handles empty merchant context', () => {
    vi.mocked(useMerchantSafe).mockReturnValue(null);
    const { result } = renderHook(() => useStorefrontScopedRoute());

    expect(result.current('/products')).toBe('/products');
  });
});
