import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useShipping } from './use-shipping';

describe('useShipping station pickup quotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('does not auto-select a station-pickup quote for door delivery', async () => {
    const stationQuote = {
      id: 'station-quote',
      provider: 'GIGL',
      serviceTier: 'station',
      carrierName: 'GIG Logistics',
      displayName: 'Pickup Stations (GIGL)',
      estimatedDays: 3,
      price: 4200,
      currency: 'NGN',
      pickupIncluded: true,
      insuranceIncluded: true,
      isStationPickup: true,
    };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ states: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ locations: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ quotes: { all: [stationQuote] } }),
      });

    const { result } = renderHook(() =>
      useShipping({
        deliveryMethod: 'door',
        isNewAddressMode: true,
        newAddressState: 'Rivers',
        newAddressCity: 'Port Harcourt',
        newAddressStreet: '123 Aba Road',
        customerPhone: '',
        firstName: '',
        lastName: '',
        customerEmail: '',
        selectedAddressId: 0,
        addresses: [],
        cart: [],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingQuotes).toBe(false);
    });

    expect(result.current.shippingQuotes).toEqual([stationQuote]);
    expect(result.current.selectedQuoteId).toBe('');
  });
});
