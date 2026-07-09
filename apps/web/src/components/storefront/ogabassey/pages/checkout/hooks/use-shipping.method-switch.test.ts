import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useShipping } from './use-shipping';

const cart = [{ name: 'iPhone 13', price: 500_000, quantity: 1 }];
type ShippingProps = Parameters<typeof useShipping>[0];
const baseProps: ShippingProps = {
  addresses: [],
  cart,
  customerEmail: 'customer@example.com',
  customerPhone: '08012345678',
  deliveryMethod: 'door',
  firstName: 'Ada',
  isNewAddressMode: true,
  lastName: 'Lovelace',
  newAddressCity: 'Port Harcourt',
  newAddressState: 'Rivers',
  newAddressStreet: '1 Airport Road',
  selectedAddressId: 0,
};

describe('useShipping method switching', () => {
  beforeEach(() => {
    global.fetch = vi.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url === '/api/shipping/quotes') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              quotes: {
                all: [
                  {
                    carrierName: 'GIG Logistics',
                    currency: 'NGN',
                    displayName: 'GIG Logistics - Home Delivery',
                    estimatedDays: 3,
                    id: 'road-quote',
                    insuranceIncluded: true,
                    pickupIncluded: true,
                    price: 5659,
                    provider: 'GIGL',
                    serviceTier: 'Standard',
                  },
                ],
              },
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ locations: [], states: [] }), {
          status: 200,
        }),
      );
    }) as typeof fetch;
  });

  it('reuses same-address road quotes after switching to air and back', async () => {
    const { rerender, result } = renderHook(
      (props: ShippingProps) => useShipping(props),
      { initialProps: baseProps },
    );

    await waitFor(() => expect(result.current.selectedQuoteId).toBe('road-quote'));

    rerender({ ...baseProps, deliveryMethod: 'airport' });
    await waitFor(() => expect(result.current.selectedQuoteId).toBe('road-quote'));
    expect(
      vi.mocked(global.fetch).mock.calls.filter(([url]) => url === '/api/shipping/quotes'),
    ).toHaveLength(1);
    rerender(baseProps);

    await waitFor(() => expect(result.current.selectedQuoteId).toBe('road-quote'));
    const quoteRequests = vi
      .mocked(global.fetch)
      .mock.calls.filter(([url]) => url === '/api/shipping/quotes');
    expect(quoteRequests).toHaveLength(1);
  });
});
