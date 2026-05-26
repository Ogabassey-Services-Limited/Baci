import { describe, expect, it } from 'vitest';
import {
  toAgenticBuyer,
  toAgenticFulfillmentAddress,
} from '@/lib/agentic/ucp-request-adapter-utils';

describe('ucp request adapter utils', () => {
  it('normalizes UCP addresses into agentic fulfillment addresses', () => {
    expect(
      toAgenticFulfillmentAddress({
        address_country: 'NG',
        address_locality: 'Lagos',
        address_region: 'Lagos',
        phone_number: '08012345678',
        street_address: '12 Broad Street',
      })
    ).toEqual({
      address: '12 Broad Street',
      city: 'Lagos',
      country: 'NG',
      country_code: 'NG',
      phone: '08012345678',
      state: 'Lagos',
    });
  });

  it('derives buyers from existing body fields before billing fallbacks', () => {
    expect(
      toAgenticBuyer({
        billingAddress: { email: 'billing@example.com', name: 'Billing User' },
        body: {
          buyer: {
            email: 'buyer@example.com',
            first_name: 'Buyer',
            last_name: 'One',
            phone_number: '08012345678',
          },
        },
      })
    ).toEqual({
      email: 'buyer@example.com',
      first_name: 'Buyer',
      last_name: 'One',
      phone_number: '08012345678',
    });
  });
});
