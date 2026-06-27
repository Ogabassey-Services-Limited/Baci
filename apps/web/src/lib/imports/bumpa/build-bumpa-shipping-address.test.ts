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

  it('accepts raw snake_case Bumpa rich export shipping and customer columns', () => {
    expect(
      buildBumpaShippingAddress({
        shipping_full_address: '25 Admiralty Way, Lekki, Lagos, Nigeria',
        shipping_street: '25 Admiralty Way',
        shipping_city: 'Lekki',
        shipping_state: 'Lagos',
        shipping_country: 'Nigeria',
        shipping_zip: '105102',
        customer_full_address: '12 Allen Ave, Ikeja, Lagos, Nigeria',
        customer_city: 'Ikeja',
      })
    ).toEqual({
      fullAddress: '25 Admiralty Way, Lekki, Lagos, Nigeria',
      address: '25 Admiralty Way',
      city: 'Lekki',
      state: 'Lagos',
      country: 'Nigeria',
      postalCode: '105102',
      source: 'bumpa_import',
    });
  });

  it('prefers raw shipping columns over bumpa customer columns', () => {
    expect(
      buildBumpaShippingAddress({
        bumpa_customer_full_address: '12 Allen Ave, Ikeja, Lagos, Nigeria',
        bumpa_customer_street: '12 Allen Ave',
        bumpa_customer_city: 'Ikeja',
        bumpa_customer_state: 'Lagos',
        bumpa_customer_country: 'Nigeria',
        bumpa_customer_zip: '100001',
        shipping_full_address: '25 Admiralty Way, Lekki, Lagos, Nigeria',
        shipping_street: '25 Admiralty Way',
        shipping_city: 'Lekki',
        shipping_state: 'Lagos Island',
        shipping_country: 'NG',
        shipping_zip: '105102',
      })
    ).toEqual({
      fullAddress: '25 Admiralty Way, Lekki, Lagos, Nigeria',
      address: '25 Admiralty Way',
      city: 'Lekki',
      state: 'Lagos Island',
      country: 'NG',
      postalCode: '105102',
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
