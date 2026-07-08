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

  it('formats exact amounts: whole numbers stay compact, cents are kept', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: 'NG' },
    } as unknown as ReturnType<typeof useMerchantSafe>);

    const { result } = renderHook(() => useCurrency());

    expect(result.current.formatCurrencyAuto(1000)).toBe('₦1,000');
    expect(result.current.formatCurrencyAuto(1000.5)).toBe('₦1,000.5');
    expect(result.current.formatCurrencyAuto(1000.55)).toBe('₦1,000.55');
  });

  it('should format currency using merchant country (US)', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: 'US' },
    } as unknown as ReturnType<typeof useMerchantSafe>);

    const { result } = renderHook(() => useCurrency());

    expect(result.current.formatCurrency(1000)).toBe('$1,000.00');
    expect(result.current.currencyCode).toBe('USD');
  });

  it('should default to NGN (platform fallback) if merchant has no country or payout currency', () => {
    vi.mocked(useMerchantSafe).mockReturnValue({
      merchant: { country: null },
    } as unknown as ReturnType<typeof useMerchantSafe>);

    const { result } = renderHook(() => useCurrency());

    // Canonical resolver falls back to NGN (Baci's home market), not USD.
    expect(result.current.formatCurrency(1000)).toBe('₦1,000.00');
    expect(result.current.currencyCode).toBe('NGN');
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

  it('falls back to NGN (platform fallback) when country and payout currency are missing', () => {
    const { result } = renderHook(() => useCurrencyWithCountry(null, null));

    expect(result.current.formatCurrency(1000)).toBe('₦1,000.00');
    expect(result.current.currencyCode).toBe('NGN');
    expect(result.current.currencySymbol).toBe('₦');
  });

  it('uses payout currency when country lookup fails', () => {
    const { result } = renderHook(() => useCurrencyWithCountry('ZZ', 'KES'));

    expect(result.current.formatCurrency(1000)).toContain('1,000.00');
    expect(result.current.currencyCode).toBe('KES');
    // Symbol comes from the canonical CURRENCY_SYMBOLS map (payout, no country).
    expect(result.current.currencySymbol).toBe('KSh');
  });
});
