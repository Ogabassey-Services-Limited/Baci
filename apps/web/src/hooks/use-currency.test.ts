/**
 * Additional tests for use-currency hook.
 * Comprehensive tests exist in use-currency.test.tsx.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: { country: 'NG', currency: 'NGN' },
  })),
}));

vi.mock('@/lib/currency', () => ({
  getCurrencyConfig: vi.fn(() => ({
    code: 'NGN',
    symbol: '₦',
    locale: 'en-NG',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  })),
  getCurrencyCode: vi.fn(() => 'NGN'),
  getCurrencySymbol: vi.fn(() => '₦'),
  formatCurrencyWithConfig: vi.fn(
    (amount: number) => `₦${amount.toLocaleString()}`
  ),
}));

import { useCurrency } from './use-currency';

describe('useCurrency', () => {
  it('returns currency formatting functions', () => {
    const { result } = renderHook(() => useCurrency());
    expect(result.current.formatCurrency).toBeTypeOf('function');
    expect(result.current.currencyCode).toBe('NGN');
    expect(result.current.currencySymbol).toBe('₦');
  });

  it('formatCurrency formats amounts correctly', () => {
    const { result } = renderHook(() => useCurrency());
    const formatted = result.current.formatCurrency(5000);
    expect(formatted).toContain('5,000');
  });
});
