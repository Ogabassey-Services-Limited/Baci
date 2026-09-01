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

vi.mock('@/lib/order-gigl-shipping', () => {
  class TestShippingError extends Error {}
  return {
    getMerchantWalletFundingAccount: api.getFundingAccount,
    getMerchantWalletSummary: api.getWallet,
    getOrderGiglQuote: api.getQuote,
    OrderGiglShippingError: TestShippingError,
    requestMerchantWalletFundingAccount: api.requestFundingAccount,
  };
});

import { useOrderGiglShipping } from './useOrderGiglShipping';

const result = {
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

describe('useOrderGiglShipping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    api.getQuote.mockResolvedValue(result);
    api.getFundingAccount.mockResolvedValue(null);
  });

  it('does not request while the sheet method step is closed', () => {
    renderHook(
      () => useOrderGiglShipping({ enabled: false, orderId: 'order-1' }),
      { wrapper }
    );
    expect(api.getQuote).not.toHaveBeenCalled();
  });

  it('requests a quote only when enabled and exposes the shortfall', async () => {
    const { result: hook } = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-1' }),
      { wrapper }
    );
    await flushPromises();
    expect(hook.current.quote?.price).toBe(11000);
    expect(hook.current.wallet).toMatchObject({
      availableBalance: 1000,
      canBook: false,
      shortfall: 10000,
    });
  });

  it('renders only server-reported missing fields and retries with completed address', async () => {
    api.getQuote
      .mockRejectedValueOnce({
        code: 'ORDER_SHIPPING_ADDRESS_INCOMPLETE',
        missing: ['city', 'state'],
        message: 'Incomplete',
      })
      .mockResolvedValueOnce(result);
    const { result: hook } = renderHook(
      () =>
        useOrderGiglShipping({
          enabled: true,
          initialAddress: { address: '1 Allen', phone: '0801' },
          orderId: 'order-1',
        }),
      { wrapper }
    );
    await flushPromises();
    expect(hook.current.missingFields).toEqual(['city', 'state']);
    act(() => {
      hook.current.updateAddressField('city', 'Ikeja');
      hook.current.updateAddressField('state', 'Lagos');
    });
    await act(() => hook.current.requestQuote());
    expect(api.getQuote).toHaveBeenLastCalledWith(
      'order-1',
      { address: '1 Allen', city: 'Ikeja', state: 'Lagos', phone: '0801' },
      expect.any(AbortSignal)
    );
  });

  it('requires explicit funding consent and exposes pending then active DVA', async () => {
    api.requestFundingAccount.mockResolvedValueOnce({
      account: null,
      status: 'pending',
    });
    const { result: hook } = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-1' }),
      { wrapper }
    );
    await flushPromises();
    expect(hook.current.quote).not.toBeNull();
    await act(() => hook.current.startFunding());
    expect(api.requestFundingAccount).toHaveBeenCalledOnce();
    expect(hook.current.state).toBe('funding_pending');
  });

  it('polls every three seconds and stops when wallet covers the quote', async () => {
    api.getWallet
      .mockResolvedValueOnce({ availableBalance: 5000, currency: 'NGN' })
      .mockResolvedValueOnce({ availableBalance: 11000, currency: 'NGN' });
    const { result: hook } = renderHook(
      () => useOrderGiglShipping({ enabled: true, orderId: 'order-1' }),
      { wrapper }
    );
    await flushPromises();
    expect(hook.current.quote).not.toBeNull();
    act(() => hook.current.startTransferPoll());
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(api.getWallet).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(api.getWallet).toHaveBeenCalledTimes(2);
    expect(hook.current.wallet?.canBook).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(api.getWallet).toHaveBeenCalledTimes(2);
  });

  it('stops polling after 60 seconds and when disabled', async () => {
    api.getWallet.mockResolvedValue({
      availableBalance: 1000,
      currency: 'NGN',
    });
    const { result: hook, rerender } = renderHook(
      ({ enabled }) => useOrderGiglShipping({ enabled, orderId: 'order-1' }),
      { initialProps: { enabled: true }, wrapper }
    );
    await flushPromises();
    expect(hook.current.quote).not.toBeNull();
    act(() => hook.current.startTransferPoll());
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(api.getWallet).toHaveBeenCalledTimes(20);
    rerender({ enabled: false });
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(api.getWallet).toHaveBeenCalledTimes(20);
  });
});
