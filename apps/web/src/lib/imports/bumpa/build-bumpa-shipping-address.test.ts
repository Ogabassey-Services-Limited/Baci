import { describe, expect, it } from 'vitest';
import { buildBumpaShippingAddress } from './build-bumpa-shipping-address';

describe('buildBumpaShippingAddress', () => {
  it('prefers best address columns over shipping and customer columns', () => {
    expect(
      buildBumpaShippingAddress({
        best_address_full: '10 Marina, Lagos, Nigeria',
        best_address_street: '10 Marina',
        best_address_city: 'Marina',
        best_address_state: 'Lagos',
        bumpa_shipping_full_address: '20 Admiralty Way, Lagos, Nigeria',
        bumpa_shipping_street: '20 Admiralty Way',
        bumpa_shipping_city: 'Lekki',
        bumpa_shipping_state: 'Lagos',
        bumpa_customer_full_address: '12 Allen Ave, Ikeja, Nigeria',
        bumpa_customer_city: 'Ikeja',
      })
    ).toMatchObject({
      fullAddress: '10 Marina, Lagos, Nigeria',
      address: '10 Marina',
      city: 'Marina',
      state: 'Lagos',
    });
  });

  it('falls back to customer address columns and defaults the source', () => {
    expect(
      buildBumpaShippingAddress({
        bumpa_customer_full_address: '12 Allen Ave, Ikeja, Nigeria',
        bumpa_customer_city: 'Ikeja',
        bumpa_customer_state: 'Lagos',
      })
    ).toEqual({
      fullAddress: '12 Allen Ave, Ikeja, Nigeria',
      address: null,
      city: 'Ikeja',
      state: 'Lagos',
      country: null,
      postalCode: null,
      source: 'bumpa_import',
    });
  });

  it('returns null when sparse address fields sanitize to empty values', () => {
    expect(
      buildBumpaShippingAddress({
        best_address_full: '   ',
        bumpa_shipping_city: '',
      })
    ).toBeNull();
  });
});
