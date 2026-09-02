import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getFundingAccount: vi.fn(),
  getOrRequestFunding: vi.fn(),
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
    getOrRequestMerchantWalletFundingAccount: api.getOrRequestFunding,
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
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, reject, resolve };
}

describe('useOrderGiglShipping polling lifecycle', () => {
  beforeEach(() => {
    for (const mock of Object.values(api)) mock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime('2026-09-01T17:00:00.000Z');
    api.getQuote.mockResolvedValue(quoteResult);
    api.getFundingAccount.mockResolvedValue(null);
    api.getOrRequestFunding.mockResolvedValue({
      account: null,
      status: 'pending',
    });
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

  it('clears the polling state when backgrounding interrupts wallet polling', async () => {
    api.getWallet.mockResolvedValue({
      availableBalance: 1000,
      currency: 'NGN',
    });
    const { result } = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-1' }),
      { wrapper }
    );
    await flushPromises();

    act(() => result.current.startTransferPoll());
    expect(result.current.state).toBe('polling');
    act(() => appState.listener('background'));
    expect(result.current.state).toBe('ready');
    act(() => appState.listener('active'));
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

  it('restarts an aborted quote load after the app returns to the foreground', async () => {
    const pending = deferred<typeof quoteResult>();
    const activeQuote = {
      ...quoteResult,
      quote: { ...quoteResult.quote, price: 12000 },
    };
    api.getQuote
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(activeQuote);
    const { result } = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-1' }),
      { wrapper }
    );
    await flushPromises();
    expect(result.current.state).toBe('loading');

    act(() => appState.listener('background'));
    expect(result.current.state).toBe('ready');
    act(() => appState.listener('active'));
    await flushPromises();

    expect(api.getQuote).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('ready');
    expect(result.current.quote?.price).toBe(12000);
    pending.resolve({
      ...quoteResult,
      quote: { ...quoteResult.quote, price: 9000 },
    });
    await flushPromises();
    expect(result.current.quote?.price).toBe(12000);
  });

  it('ignores an old funding rejection after switching orders and starting a new request', async () => {
    const oldRequest = deferred<{ account: null; status: 'pending' }>();
    const currentRequest = deferred<{ account: null; status: 'pending' }>();
    api.getOrRequestFunding
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);
    const { result, rerender } = renderHook(
      ({ orderId }) => useOrderGiglShipping({ enabled: true, orderId }),
      { initialProps: { orderId: 'order-1' }, wrapper }
    );
    await flushPromises();

    let oldFunding!: Promise<void>;
    act(() => {
      oldFunding = result.current.startFunding();
    });
    rerender({ orderId: 'order-2' });
    await flushPromises();
    let currentFunding!: Promise<void>;
    act(() => {
      currentFunding = result.current.startFunding();
    });
    expect(api.getOrRequestFunding).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('funding');

    oldRequest.reject(new Error('old order funding failed'));
    await flushPromises();
    expect(result.current.state).toBe('funding');
    expect(result.current.error).toBeNull();

    currentRequest.resolve({ account: null, status: 'pending' });
    await act(async () => {
      await Promise.all([oldFunding, currentFunding]);
    });
    expect(result.current.state).toBe('funding_pending');
  });

  it('clears order-scoped quote, wallet, and funding state before a new order loads', async () => {
    const replacement = deferred<typeof quoteResult>();
    api.getQuote.mockResolvedValueOnce({
      ...quoteResult,
      availableBalance: 11000,
      shortfall: 0,
      canBook: true,
    });
    api.getQuote.mockReturnValueOnce(replacement.promise);
    const { result, rerender } = renderHook(
      ({ orderId }) => useOrderGiglShipping({ enabled: true, orderId }),
      { initialProps: { orderId: 'order-1' }, wrapper }
    );
    await flushPromises();
    expect(result.current.quote).not.toBeNull();
    expect(result.current.wallet?.canBook).toBe(true);

    rerender({ orderId: 'order-2' });

    expect(result.current.quote).toBeNull();
    expect(result.current.wallet).toBeNull();
    expect(result.current.fundingAccount).toBeNull();
    replacement.resolve(quoteResult);
    await flushPromises();
  });

  it('uses the current order when resuming after switching orders', async () => {
    const replacement = deferred<typeof quoteResult>();
    const resumed = deferred<typeof quoteResult>();
    api.getQuote
      .mockResolvedValueOnce(quoteResult)
      .mockReturnValueOnce(replacement.promise)
      .mockReturnValueOnce(resumed.promise);
    const { result, rerender } = renderHook(
      ({ orderId }) => useOrderGiglShipping({ enabled: true, orderId }),
      { initialProps: { orderId: 'order-1' }, wrapper }
    );
    await flushPromises();

    rerender({ orderId: 'order-2' });
    act(() => appState.listener('background'));
    act(() => appState.listener('active'));

    expect(api.getQuote).toHaveBeenCalledTimes(3);
    expect(api.getQuote.mock.calls[1]?.[0]).toBe('order-2');
    expect(api.getQuote.mock.calls[2]?.[0]).toBe('order-2');

    replacement.resolve(quoteResult);
    resumed.resolve({
      ...quoteResult,
      quote: { ...quoteResult.quote, price: 12000 },
    });
    await flushPromises();
    expect(result.current.quote?.price).toBe(12000);
  });
});
