import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrency } from '@/hooks/useCurrency';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    formatCurrency: vi.fn(),
    formatCurrencyCompactNotation: vi.fn(),
    getCurrencySymbol: vi.fn(),
    useMerchant: vi.fn(),
  },
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: mocks.useMerchant,
}));

vi.mock('@/lib/utils', () => ({
  formatCurrency: mocks.formatCurrency,
  formatCurrencyCompactNotation: mocks.formatCurrencyCompactNotation,
  getCurrencySymbol: mocks.getCurrencySymbol,
}));

describe('useCurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrencySymbol.mockImplementation((currency: string) =>
      currency === 'USD' ? '$' : '₦'
    );
    mocks.formatCurrency.mockImplementation(
      (amount: number, options: Partial<Intl.NumberFormatOptions>, currency: string) =>
        `${currency}:${amount}:${JSON.stringify(options ?? {})}`
    );
    mocks.formatCurrencyCompactNotation.mockImplementation(
      (amount: number, currency: string) => `${currency}:compact:${amount}`
    );
  });

  it('uses the merchant payout currency when available', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: { payout_currency: ' USD ' },
    });

    const { result } = renderHook(() => useCurrency());

    expect(result.current.currency).toBe('USD');
    expect(result.current.symbol).toBe('$');
    expect(mocks.getCurrencySymbol).toHaveBeenCalledWith('USD');
  });

  it('falls back to NGN when the merchant currency is missing', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: { payout_currency: null },
    });

    const { result } = renderHook(() => useCurrency());

    expect(result.current.currency).toBe('NGN');
    expect(result.current.symbol).toBe('₦');
  });

  it('delegates formatting helpers with the resolved currency', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: { payout_currency: 'KES' },
    });

    const { result } = renderHook(() => useCurrency());

    expect(result.current.format(12500, { maximumFractionDigits: 0 })).toBe(
      'KES:12500:{"maximumFractionDigits":0}'
    );
    expect(result.current.formatCompact(12500)).toBe('KES:compact:12500');
    expect(mocks.formatCurrency).toHaveBeenCalledWith(
      12500,
      { maximumFractionDigits: 0 },
      'KES'
    );
    expect(mocks.formatCurrencyCompactNotation).toHaveBeenCalledWith(
      12500,
      'KES'
    );
  });
});
