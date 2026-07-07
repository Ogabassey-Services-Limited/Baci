import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShippingQuote } from '@/types/shipping-quote';

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiPost: mockApiPost,
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: () => ({ formatCurrency: (value: number) => `₦${value}` }),
}));

import { ShippingOptions } from './shipping-options';

const cheapQuote: ShippingQuote = {
  id: 'quote-cheap',
  provider: 'GIGL',
  serviceTier: 'standard',
  carrierName: 'GIG Logistics',
  displayName: 'GIG Logistics',
  estimatedDays: 2,
  price: 1500,
  currency: 'NGN',
  pickupIncluded: true,
  insuranceIncluded: false,
};

const expensiveQuote: ShippingQuote = {
  id: 'quote-expensive',
  provider: 'TOPSHIP',
  serviceTier: 'express',
  carrierName: 'Topship Express',
  displayName: 'Topship Express',
  estimatedDays: 1,
  price: 4000,
  currency: 'NGN',
  pickupIncluded: false,
  insuranceIncluded: true,
};

const quotesResponse = {
  quotes: { featured: [cheapQuote], all: [cheapQuote, expensiveQuote] },
  sessionId: 'session-1',
  expiresAt: '2026-06-12T00:00:00.000Z',
};

const baseProps = {
  merchantId: '11111111-1111-4111-8111-111111111111',
  receiverCity: 'Lagos',
  receiverState: 'Lagos',
  receiverAddress: '1 Marina Road',
  receiverPhone: '08000000000',
  receiverName: 'Ada',
  cartItems: [{ name: 'Pixel 9', quantity: 2, price: 5000 }],
};

describe('ShippingOptions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockApiPost.mockReset();
    mockApiPost.mockResolvedValue(quotesResponse);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prompts for an address before any quotes are fetched', () => {
    render(
      <ShippingOptions {...baseProps} receiverCity="" onSelect={vi.fn()} />
    );

    expect(
      screen.getByText('Enter your address to see shipping options')
    ).toBeInTheDocument();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('fetches quotes after the debounce and auto-selects the cheapest option', async () => {
    const onSelect = vi.fn();

    render(<ShippingOptions {...baseProps} onSelect={onSelect} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith('/api/shipping/quotes', {
      merchantId: '11111111-1111-4111-8111-111111111111',
      receiver: {
        name: 'Ada',
        phone: '08000000000',
        address: '1 Marina Road',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      },
      items: [{ name: 'Pixel 9', quantity: 2, weight: 1, value: 5000 }],
      shipmentType: 'domestic',
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(cheapQuote, 'session-1');
    expect(screen.getByText('GIG Logistics')).toBeInTheDocument();
    expect(screen.getByText('Topship Express')).toBeInTheDocument();
  });

  it('does not refetch quotes when only the onSelect identity changes', async () => {
    const { rerender } = render(
      <ShippingOptions {...baseProps} onSelect={vi.fn()} />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mockApiPost).toHaveBeenCalledTimes(1);

    rerender(<ShippingOptions {...baseProps} onSelect={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
  });

  it('shows a retry message when the quote request fails', async () => {
    mockApiPost.mockRejectedValue(new Error('network down'));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      render(<ShippingOptions {...baseProps} onSelect={vi.fn()} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(
        screen.getByText('Unable to get shipping options. Please try again.')
      ).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
});
