import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockMaybeSingle =
  jest.fn<() => Promise<{ data: unknown; error: unknown }>>();
const mockAbortSignal = jest.fn();
const mockTrackError = jest.fn();
const mockWithSupabaseRetry = jest.fn();

const mockQueryBuilder: Record<string, unknown> = {};
mockQueryBuilder.select = jest.fn(() => mockQueryBuilder);
mockQueryBuilder.eq = jest.fn(() => mockQueryBuilder);
mockQueryBuilder.abortSignal = jest.fn((signal: unknown) => {
  mockAbortSignal(signal);
  return mockQueryBuilder;
});
mockQueryBuilder.maybeSingle = () => mockMaybeSingle();

jest.mock('@/lib/api', () => ({
  withSupabaseRetry: (operation: () => Promise<unknown>, options?: unknown) =>
    mockWithSupabaseRetry(operation, options),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockQueryBuilder),
  },
}));

jest.mock('@/services/analytics', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

import { fetchCheckoutSavedAddresses } from './fetch-checkout-saved-addresses';

describe('fetchCheckoutSavedAddresses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithSupabaseRetry.mockImplementation((...args: unknown[]) => {
      const operation = args[0] as () => Promise<unknown>;
      return operation();
    });
  });

  it('returns saved addresses sorted default-first', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        saved_addresses: [
          { id: 'addr-1', is_default: false },
          { id: 'addr-2', is_default: true },
        ],
      },
      error: null,
    });

    const addresses = await fetchCheckoutSavedAddresses({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(addresses.map((address) => address.id)).toEqual([
      'addr-2',
      'addr-1',
    ]);
    expect(mockTrackError).not.toHaveBeenCalled();
  });

  it('de-duplicates saved addresses that repeat the same id', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        saved_addresses: [
          { id: 'addr-1', is_default: false, city: 'Lagos' },
          { id: 'addr-1', is_default: false, city: 'Abuja' },
          { id: 'addr-2', is_default: true },
        ],
      },
      error: null,
    });

    const addresses = await fetchCheckoutSavedAddresses({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    // Default-first sort, then de-dupe: addr-2 (default), then the first addr-1.
    expect(addresses.map((address) => address.id)).toEqual([
      'addr-2',
      'addr-1',
    ]);
    expect(addresses.filter((address) => address.id === 'addr-1')).toHaveLength(
      1
    );
    expect(mockTrackError).not.toHaveBeenCalled();
  });

  it('treats a missing customer row as an empty state, not an error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const addresses = await fetchCheckoutSavedAddresses({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(addresses).toEqual([]);
    expect(mockTrackError).not.toHaveBeenCalled();
  });

  it('passes the abort signal to the query and retries via withSupabaseRetry', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { saved_addresses: [] },
      error: null,
    });
    const controller = new AbortController();

    await fetchCheckoutSavedAddresses({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      signal: controller.signal,
    });

    expect(mockAbortSignal).toHaveBeenCalledWith(controller.signal);
    expect(mockWithSupabaseRetry).toHaveBeenCalledWith(expect.any(Function), {
      maxRetries: 2,
    });
  });

  it('fails open to [] and reports a classified error on API failure', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'JWT expired', code: 'PGRST301' },
    });

    const addresses = await fetchCheckoutSavedAddresses({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(addresses).toEqual([]);
    expect(mockTrackError).toHaveBeenCalledWith(
      'checkout_saved_addresses_fetch',
      'JWT expired',
      expect.objectContaining({
        error_category: 'auth',
        error_retryable: false,
        request_surface: 'checkout',
      })
    );
  });

  it('fails open without reporting when the caller aborted the request', async () => {
    const controller = new AbortController();
    mockWithSupabaseRetry.mockImplementation(() => {
      // Unmount happened mid-retry: the signal fired, then the helper
      // surfaced an earlier retryable result / threw.
      controller.abort();
      throw new Error('TypeError: Network request failed');
    });

    const addresses = await fetchCheckoutSavedAddresses({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      signal: controller.signal,
    });

    expect(addresses).toEqual([]);
    expect(mockTrackError).not.toHaveBeenCalled();
  });

  it('reports an unrequested abort as a retryable network failure', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'AbortError: Aborted', code: '' },
    });

    const addresses = await fetchCheckoutSavedAddresses({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(addresses).toEqual([]);
    expect(mockTrackError).toHaveBeenCalledWith(
      'checkout_saved_addresses_fetch',
      'AbortError: Aborted',
      expect.objectContaining({ error_category: 'network' })
    );
  });

  it('fails open and classifies network failures thrown by the retry helper', async () => {
    mockWithSupabaseRetry.mockImplementation(() => {
      throw new Error('TypeError: Network request failed');
    });

    const addresses = await fetchCheckoutSavedAddresses({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
    });

    expect(addresses).toEqual([]);
    expect(mockTrackError).toHaveBeenCalledWith(
      'checkout_saved_addresses_fetch',
      'TypeError: Network request failed',
      expect.objectContaining({ error_category: 'network' })
    );
  });
});
