import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getFundingAccount: vi.fn(),
  getQuote: vi.fn(),
  getWallet: vi.fn(),
  requestFundingAccount: vi.fn(),
}));
const appState = vi.hoisted(() => ({
  listener: (() => undefined) as (state: string) => void,
}));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      appState.listener = listener;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock('@/lib/order-gigl-shipping', () => {
  class TestShippingError extends Error {}
  return {
    getMerchantWalletFundingAccount: api.getFundingAccount,
    getMerchantWalletSummary: api.getWallet,
    getOrRequestMerchantWalletFundingAccount: async () => null,
    getOrderGiglQuote: api.getQuote,
    OrderGiglShippingError: TestShippingError,
    requestMerchantWalletFundingAccount: api.requestFundingAccount,
  };
});

import { useOrderGiglShipping } from './useOrderGiglShipping';

const quoteResult = {
  quote: {
    id: 'b2152ea0-831d-4387-b4c1-5dcf29a74c54',
    provider: 'GIGL' as const,
    serviceTier: 'Express',
    carrierName: 'GIG Logistics',
    displayName: 'Door Delivery',
    estimatedDays: 2,
    price: 11000,
    currency: 'NGN' as const,
    pickupIncluded: true,
    insuranceIncluded: false,
    expiresAt: '2026-09-01T18:00:00.000Z',
  },
  availableBalance: 1000,
  shortfall: 10000,
  canBook: false,
};

function wrapper({ children }: PropsWithChildren) {
  return createElement(
    QueryClientProvider,
    { client: new QueryClient() },
    children
  );
}
async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('useOrderGiglShipping polling lifecycle', () => {
  beforeEach(() => {
    for (const mock of Object.values(api)) mock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime('2026-09-01T17:00:00.000Z');
    api.getQuote.mockResolvedValue(quoteResult);
    api.getFundingAccount.mockResolvedValue(null);
    appState.listener = () => undefined;
  });

  it('polls every three seconds and stops when wallet covers the quote', async () => {
    api.getQuote.mockResolvedValueOnce(quoteResult).mockResolvedValueOnce({
      ...quoteResult,
      availableBalance: 11000,
      shortfall: 0,
      canBook: true,
    });
    api.getWallet
      .mockResolvedValueOnce({ availableBalance: 5000, currency: 'NGN' })
      .mockResolvedValueOnce({ availableBalance: 11000, currency: 'NGN' });
    const { result } = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-1' }),
      { wrapper }
    );
    await flushPromises();
    act(() => result.current.startTransferPoll());
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(api.getWallet).toHaveBeenCalledTimes(2);
    expect(api.getQuote).toHaveBeenCalledTimes(2);
    expect(result.current.wallet?.canBook).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(api.getWallet).toHaveBeenCalledTimes(2);
  });

  it('keeps booking disabled when the replacement quote costs more', async () => {
    api.getQuote.mockResolvedValueOnce(quoteResult).mockResolvedValueOnce({
      ...quoteResult,
      quote: {
        ...quoteResult.quote,
        price: 12000,
        expiresAt: '2026-09-01T19:00:00.000Z',
      },
      availableBalance: 11000,
      shortfall: 1000,
      canBook: false,
    });
    api.getWallet.mockResolvedValue({
      availableBalance: 11000,
      currency: 'NGN',
    });
    const { result } = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-1' }),
      { wrapper }
    );
    await flushPromises();
    act(() => result.current.startTransferPoll());
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.quote?.price).toBe(12000);
    expect(result.current.wallet).toMatchObject({
      canBook: false,
      shortfall: 1000,
    });
  });

  it('stops polling at 60 seconds and when disabled', async () => {
    api.getWallet.mockResolvedValue({
      availableBalance: 1000,
      currency: 'NGN',
    });
    const { result, rerender } = renderHook(
      ({ enabled }) => useOrderGiglShipping({ enabled, orderId: 'order-1' }),
      { initialProps: { enabled: true }, wrapper }
    );
    await flushPromises();
    act(() => result.current.startTransferPoll());
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(api.getWallet).toHaveBeenCalledTimes(20);
    rerender({ enabled: false });
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(api.getWallet).toHaveBeenCalledTimes(20);
  });

  it('does not overlap a slow wallet request with later ticks', async () => {
    const slow = deferred<{ availableBalance: number; currency: 'NGN' }>();
    api.getWallet.mockReturnValueOnce(slow.promise).mockResolvedValue({
      availableBalance: 1000,
      currency: 'NGN',
    });
    const { result } = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-1' }),
      { wrapper }
    );
    await flushPromises();
    act(() => result.current.startTransferPoll());
    await act(() => vi.advanceTimersByTimeAsync(12_000));
    expect(api.getWallet).toHaveBeenCalledOnce();
    slow.resolve({ availableBalance: 1000, currency: 'NGN' });
    await flushPromises();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(api.getWallet).toHaveBeenCalledTimes(2);
  });

  it('ignores an old generation response after polling restarts', async () => {
    const old = deferred<{ availableBalance: number; currency: 'NGN' }>();
    api.getWallet.mockReturnValueOnce(old.promise).mockResolvedValue({
      availableBalance: 1000,
      currency: 'NGN',
    });
    const { result } = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-1' }),
      { wrapper }
    );
    await flushPromises();
    act(() => result.current.startTransferPoll());
    await act(() => vi.advanceTimersByTimeAsync(3000));
    act(() => result.current.startTransferPoll());
    old.resolve({ availableBalance: 11000, currency: 'NGN' });
    await flushPromises();
    expect(api.getQuote).toHaveBeenCalledOnce();
    expect(result.current.wallet?.availableBalance).toBe(1000);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(api.getWallet).toHaveBeenCalledTimes(2);
  });

  it('ignores an in-flight sufficient response after app backgrounding', async () => {
    const pending = deferred<{ availableBalance: number; currency: 'NGN' }>();
    api.getWallet.mockReturnValue(pending.promise);
    const { result } = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-1' }),
      { wrapper }
    );
    await flushPromises();
    act(() => result.current.startTransferPoll());
    await act(() => vi.advanceTimersByTimeAsync(3000));
    act(() => appState.listener('background'));
    pending.resolve({ availableBalance: 11000, currency: 'NGN' });
    await flushPromises();
    expect(api.getQuote).toHaveBeenCalledOnce();
    expect(result.current.wallet).toMatchObject({
      availableBalance: 1000,
      canBook: false,
    });
  });

  it('ignores an in-flight replacement quote after app backgrounding', async () => {
    const replacement = deferred<typeof quoteResult>();
    api.getQuote
      .mockResolvedValueOnce(quoteResult)
      .mockReturnValueOnce(replacement.promise);
    api.getWallet.mockResolvedValue({
      availableBalance: 11000,
      currency: 'NGN',
    });
    const { result } = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-1' }),
      { wrapper }
    );
    await flushPromises();
    act(() => result.current.startTransferPoll());
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(api.getQuote).toHaveBeenCalledTimes(2);
    act(() => appState.listener('background'));
    replacement.resolve({
      ...quoteResult,
      quote: { ...quoteResult.quote, price: 12000 },
      availableBalance: 11000,
      shortfall: 1000,
    });
    await flushPromises();
    expect(result.current.quote?.price).toBe(11000);
    expect(result.current.wallet?.canBook).toBe(false);
  });

  it('ignores in-flight responses after disable and unmount', async () => {
    const disabled = deferred<{ availableBalance: number; currency: 'NGN' }>();
    const unmounted = deferred<{ availableBalance: number; currency: 'NGN' }>();
    api.getWallet
      .mockReturnValueOnce(disabled.promise)
      .mockReturnValueOnce(unmounted.promise);
    const first = renderHook(
      ({ enabled }) => useOrderGiglShipping({ enabled, orderId: 'order-1' }),
      { initialProps: { enabled: true }, wrapper }
    );
    await flushPromises();
    act(() => first.result.current.startTransferPoll());
    await act(() => vi.advanceTimersByTimeAsync(3000));
    first.rerender({ enabled: false });
    disabled.resolve({ availableBalance: 11000, currency: 'NGN' });
    await flushPromises();
    expect(api.getQuote).toHaveBeenCalledOnce();
    expect(first.result.current.wallet?.canBook).toBe(false);

    const second = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-2' }),
      { wrapper }
    );
    await flushPromises();
    act(() => second.result.current.startTransferPoll());
    await act(() => vi.advanceTimersByTimeAsync(3000));
    second.unmount();
    unmounted.resolve({ availableBalance: 11000, currency: 'NGN' });
    await flushPromises();
    expect(api.getQuote).toHaveBeenCalledTimes(2);
  });
});
