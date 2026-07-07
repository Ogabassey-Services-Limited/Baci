import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWallet } from './use-wallet';

describe('useWallet', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useWallet({ userId: undefined, merchantSlug: undefined }),
    );

    expect(result.current.walletBalance).toBe(0);
    expect(result.current.walletLoading).toBe(false);
    expect(result.current.payWithWallet).toBe(false);
    expect(typeof result.current.setPayWithWallet).toBe('function');
    expect(typeof result.current.setWalletBalance).toBe('function');
  });

  it('should not fetch when userId is undefined', () => {
    renderHook(() => useWallet({ userId: undefined, merchantSlug: 'test-merchant' }));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not fetch when merchantSlug is undefined', () => {
    renderHook(() => useWallet({ userId: 'user-123', merchantSlug: undefined }));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should fetch wallet balance with correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ balance: 1000 }),
    });

    renderHook(() => useWallet({ userId: 'user-123', merchantSlug: 'test-merchant' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/storefront/customer/wallet?merchant=test-merchant',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  it('should set balance and enable payWithWallet when balance > 0', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ balance: 1500 }),
    });

    const { result } = renderHook(() =>
      useWallet({ userId: 'user-123', merchantSlug: 'test-merchant' }),
    );

    await waitFor(() => {
      expect(result.current.walletBalance).toBe(1500);
      expect(result.current.payWithWallet).toBe(true);
      expect(result.current.walletLoading).toBe(false);
    });
  });

  it('should set balance to 0 and not enable payWithWallet when balance is 0', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ balance: 0 }),
    });

    const { result } = renderHook(() =>
      useWallet({ userId: 'user-123', merchantSlug: 'test-merchant' }),
    );

    await waitFor(() => {
      expect(result.current.walletBalance).toBe(0);
      expect(result.current.payWithWallet).toBe(false);
      expect(result.current.walletLoading).toBe(false);
    });
  });

  it('should handle non-numeric balance values', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ balance: 'invalid' }),
    });

    const { result } = renderHook(() =>
      useWallet({ userId: 'user-123', merchantSlug: 'test-merchant' }),
    );

    await waitFor(() => {
      expect(result.current.walletBalance).toBe(0);
      expect(result.current.payWithWallet).toBe(false);
    });
  });

  it('should log error on failed fetch', async () => {
    const error = new Error('Network error');
    mockFetch.mockRejectedValueOnce(error);

    const { result } = renderHook(() =>
      useWallet({ userId: 'user-123', merchantSlug: 'test-merchant' }),
    );

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Failed to fetch wallet balance:', error);
      expect(result.current.walletLoading).toBe(false);
    });
  });

  it('should not log error on AbortError', async () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    renderHook(() => useWallet({ userId: 'user-123', merchantSlug: 'test-merchant' }));

    await waitFor(() => {
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  it('should abort fetch on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockFetch.mockImplementationOnce((url: string, options?: RequestInit) => {
      capturedSignal = options?.signal as AbortSignal | undefined;
      return new Promise(() => {});
    });

    const { unmount } = renderHook(() =>
      useWallet({ userId: 'user-123', merchantSlug: 'test-merchant' }),
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    unmount();

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(true);
  });

  it('should refetch when userId changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 500 }),
    });

    const { rerender } = renderHook(
      ({ userId, merchantSlug }) => useWallet({ userId, merchantSlug }),
      { initialProps: { userId: 'user-1', merchantSlug: 'merchant-1' } },
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    rerender({ userId: 'user-2', merchantSlug: 'merchant-1' });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });

  it('should expose the funding account and consent flag from the wallet response', async () => {
    const fundingAccount = {
      accountName: 'OGB / JOHN DOE',
      accountNumber: '9012345678',
      bankName: 'Wema Bank',
      provider: 'paystack',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        balance: 1500,
        fundingAccount,
        requiresFundingAccountConsent: false,
        walletDvaEnabled: true,
      }),
    });

    const { result } = renderHook(() =>
      useWallet({ userId: 'user-123', merchantSlug: 'test-merchant' }),
    );

    await waitFor(() => {
      expect(result.current.fundingAccount).toEqual(fundingAccount);
      expect(result.current.requiresFundingAccountConsent).toBe(false);
      expect(result.current.walletDvaEnabled).toBe(true);
    });
  });

  it('should flip the consent flag off when setFundingAccount stores a new account', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        balance: 0,
        fundingAccount: null,
        requiresFundingAccountConsent: true,
      }),
    });

    const { result } = renderHook(() =>
      useWallet({ userId: 'user-123', merchantSlug: 'test-merchant' }),
    );

    await waitFor(() => {
      expect(result.current.requiresFundingAccountConsent).toBe(true);
    });

    const account = {
      accountName: null,
      accountNumber: '9012345678',
      bankName: 'Wema Bank',
      provider: 'paystack',
    };
    await waitFor(() => {
      result.current.setFundingAccount(account);
      expect(result.current.fundingAccount).toEqual(account);
      expect(result.current.requiresFundingAccountConsent).toBe(false);
    });
  });

  it('should refetch when refreshWallet is called', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 500 }),
    });

    const { result } = renderHook(() =>
      useWallet({ userId: 'user-123', merchantSlug: 'test-merchant' }),
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    result.current.refreshWallet();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });

  it('should refetch when merchantSlug changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ balance: 500 }),
    });

    const { rerender } = renderHook(
      ({ userId, merchantSlug }) => useWallet({ userId, merchantSlug }),
      { initialProps: { userId: 'user-1', merchantSlug: 'merchant-1' } },
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    rerender({ userId: 'user-1', merchantSlug: 'merchant-2' });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/storefront/customer/wallet?merchant=merchant-2',
      expect.any(Object),
    );
  });
});
