import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { loadAddresses } from './load-addresses';
import type { Address } from './types';

const mockSingle =
  jest.fn<
    () => Promise<{ data: { saved_addresses: Address[] }; error: Error | null }>
  >();
const mockQuery = {
  eq: jest.fn(),
  single: mockSingle,
};
const mockFrom = jest.fn(() => ({
  select: jest.fn(() => mockQuery),
}));
const mockLogError = jest.fn();
const mockNormalizeSavedAddresses = jest.fn(
  (addresses: Address[]) => addresses
);

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: (...args: unknown[]) => mockLogError(...args),
  }),
}));

jest.mock('@/lib/saved-addresses', () => ({
  normalizeSavedAddresses: (addresses: Address[]) =>
    mockNormalizeSavedAddresses(addresses),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => mockFrom(),
  },
}));

describe('loadAddresses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.eq.mockReturnValue(mockQuery);
  });

  it('loads, normalizes, sorts, and applies saved addresses', async () => {
    const setAddresses = jest.fn();
    const setError = jest.fn();
    const setIsLoading = jest.fn();
    const setIsRefreshing = jest.fn();

    mockSingle.mockResolvedValue({
      data: {
        saved_addresses: [
          { id: 'secondary', is_default: false } as Address,
          { id: 'primary', is_default: true } as Address,
        ],
      },
      error: null,
    });

    await loadAddresses({
      customerId: 'customer-1',
      isMountedRef: { current: true },
      merchantId: 'merchant-1',
      setAddresses,
      setError,
      setIsLoading,
      setIsRefreshing,
      settleLoading: true,
      settleRefreshing: true,
    });

    expect(setAddresses).toHaveBeenCalledWith([
      { id: 'primary', is_default: true },
      { id: 'secondary', is_default: false },
    ]);
    expect(setError).toHaveBeenCalledWith(null);
    expect(setIsLoading).toHaveBeenCalledWith(false);
    expect(setIsRefreshing).toHaveBeenCalledWith(false);
  });

  it('sets the fallback error message when the fetch fails', async () => {
    const setAddresses = jest.fn();
    const setError = jest.fn();
    const setIsLoading = jest.fn();
    const setIsRefreshing = jest.fn();

    mockSingle.mockResolvedValue({
      data: { saved_addresses: [] },
      error: new Error('fetch failed'),
    });

    await loadAddresses({
      customerId: 'customer-1',
      isMountedRef: { current: true },
      merchantId: 'merchant-1',
      setAddresses,
      setError,
      setIsLoading,
      setIsRefreshing,
      settleLoading: true,
    });

    expect(setAddresses).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Failed to load addresses');
    expect(setIsLoading).toHaveBeenCalledWith(false);
    expect(mockLogError).toHaveBeenCalled();
  });

  it('settles flags and skips the query when auth context is missing', async () => {
    const setAddresses = jest.fn();
    const setError = jest.fn();
    const setIsLoading = jest.fn();
    const setIsRefreshing = jest.fn();

    await loadAddresses({
      customerId: undefined,
      isMountedRef: { current: true },
      merchantId: null,
      setAddresses,
      setError,
      setIsLoading,
      setIsRefreshing,
      settleLoading: true,
      settleRefreshing: true,
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(setAddresses).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(setIsLoading).toHaveBeenCalledWith(false);
    expect(setIsRefreshing).toHaveBeenCalledWith(false);
  });
});
