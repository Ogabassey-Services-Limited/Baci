import { describe, expect, it } from 'vitest';
import { resolveAirportShippingAddress } from './resolve-airport-shipping-address';

describe('resolveAirportShippingAddress', () => {
  it('uses the saved destination for a provider-backed airport quote', () => {
    expect(
      resolveAirportShippingAddress({
        airportType: 'delivery',
        isProviderBacked: true,
        manualAddress: '',
        manualCity: '',
        manualState: '',
        savedAddress: '1 Airport Road, Port Harcourt, Rivers',
      })
    ).toEqual({
      address: '1 Airport Road, Port Harcourt, Rivers',
      city: 'Port Harcourt',
      state: 'Rivers',
    });
  });

  it('keeps the local airport fallback when no provider quote is selected', () => {
    expect(
      resolveAirportShippingAddress({
        airportType: 'pickup',
        isProviderBacked: false,
        manualAddress: '',
        manualCity: '',
        manualState: '',
        savedAddress: '1 Airport Road, Port Harcourt, Rivers',
      })
    ).toEqual({
      address: 'Airport Pickup',
      city: 'Airport',
      state: 'Nigeria',
    });
  });
});
