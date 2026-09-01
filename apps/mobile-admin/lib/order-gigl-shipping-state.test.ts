import { describe, expect, it } from 'vitest';
import {
  isOrderGiglQuoteFresh,
  toCompleteOrderGiglReceiver,
  toOrderGiglAddressDraft,
} from './order-gigl-shipping-state';

const quote = {
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
};

describe('order GIG shipping state', () => {
  it('treats quotes inside the submit safety window as stale', () => {
    expect(
      isOrderGiglQuoteFresh(quote, Date.parse('2026-09-01T17:59:29Z'))
    ).toBe(true);
    expect(
      isOrderGiglQuoteFresh(quote, Date.parse('2026-09-01T17:59:30Z'))
    ).toBe(false);
  });

  it('never invents missing address fields', () => {
    const draft = toOrderGiglAddressDraft({
      address: '1 Allen',
      phone: '0801',
    });
    expect(draft).toEqual({ address: '1 Allen', phone: '0801' });
    expect(toCompleteOrderGiglReceiver(draft)).toBeUndefined();
  });
});
