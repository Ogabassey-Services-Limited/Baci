import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCurrency } from './use-currency';
import { useMerchantSafe } from './use-merchant-client';

// Mock useMerchantSafe
vi.mock('./use-merchant-client', () => ({
  useMerchantSafe: vi.fn(),
}));

describe('useCurrency', () => {
  it('should format currency using merchant country (NG)', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: 'NG' },
    } as any);

    const { result } = renderHook(() => useCurrency());

    expect(result.current.formatCurrency(1000)).toBe('₦1,000.00');
    expect(result.current.currencyCode).toBe('NGN');
    expect(result.current.currencySymbol).toBe('₦');
    expect(result.current.formatCurrencyCompact(1000)).toBe('₦1,000');
  });

  it('should format currency using merchant country (US)', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: 'US' },
    } as any);

    const { result } = renderHook(() => useCurrency());

    expect(result.current.formatCurrency(1000)).toBe('$1,000.00');
    expect(result.current.currencyCode).toBe('USD');
  });

  it('should default to USD if merchant has no country', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: null },
    } as any);

    const { result } = renderHook(() => useCurrency());

    expect(result.current.formatCurrency(1000)).toBe('$1,000.00');
    expect(result.current.currencyCode).toBe('USD');
  });
});
