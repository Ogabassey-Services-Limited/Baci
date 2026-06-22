import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCurrency, useCurrencyWithCountry } from './use-currency';
import { useMerchantSafe } from './use-merchant-client';

vi.mock('./use-merchant-client', () => ({
  useMerchantSafe: vi.fn(),
}));

describe('useCurrency', () => {
  it('should format currency using merchant country (NG)', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: 'NG' },
    } as unknown as ReturnType<typeof useMerchantSafe>);

    const { result } = renderHook(() => useCurrency());

    expect(result.current.formatCurrency(1000)).toBe('₦1,000.00');
    expect(result.current.currencyCode).toBe('NGN');
    expect(result.current.currencySymbol).toBe('₦');
    expect(result.current.formatCurrencyCompact(1000)).toBe('₦1,000');
  });

  it('should format currency using merchant country (US)', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: 'US' },
    } as unknown as ReturnType<typeof useMerchantSafe>);

    const { result } = renderHook(() => useCurrency());

    expect(result.current.formatCurrency(1000)).toBe('$1,000.00');
    expect(result.current.currencyCode).toBe('USD');
  });

  it('should default to USD if merchant has no country or payout currency', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: null },
    } as unknown as ReturnType<typeof useMerchantSafe>);

    const { result } = renderHook(() => useCurrency());

    expect(result.current.formatCurrency(1000)).toBe('$1,000.00');
    expect(result.current.currencyCode).toBe('USD');
  });

  it('should use payout currency when merchant country is missing', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: null, payout_currency: 'NGN' },
    } as unknown as ReturnType<typeof useMerchantSafe>);

    const { result } = renderHook(() => useCurrency());

    expect(result.current.formatCurrency(1000)).toBe('₦1,000.00');
    expect(result.current.currencyCode).toBe('NGN');
    expect(result.current.currencySymbol).toBe('₦');
  });
});

describe('useCurrencyWithCountry', () => {
  it('uses payout currency when country is missing', () => {
    const { result } = renderHook(() => useCurrencyWithCountry(null, 'NGN'));
    expect(result.current.formatCurrency(1000)).toBe('₦1,000.00');
    expect(result.current.currencyCode).toBe('NGN');
    expect(result.current.currencySymbol).toBe('₦');
  });

  it('falls back to USD when country and payout currency are missing', () => {
    const { result } = renderHook(() => useCurrencyWithCountry(null, null));

    expect(result.current.formatCurrency(1000)).toBe('$1,000.00');
    expect(result.current.currencyCode).toBe('USD');
    expect(result.current.currencySymbol).toBe('$');
  });

  it('uses payout currency when country lookup fails', () => {
    const { result } = renderHook(() => useCurrencyWithCountry('ZZ', 'KES'));

    expect(result.current.formatCurrency(1000)).toContain('1,000.00');
    expect(result.current.currencyCode).toBe('KES');
    expect(result.current.currencySymbol).toBe('Ksh');
  });
});
