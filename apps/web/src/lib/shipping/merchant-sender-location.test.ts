import { describe, expect, it } from 'vitest';
import { buildMerchantSenderInfo } from './merchant-sender-location';

describe('buildMerchantSenderInfo', () => {
  it('uses the structured city and state code instead of a postal code', () => {
    const sender = buildMerchantSenderInfo({
      businessAddress: '2 Olaide Tomori Street, Ikeja, 100001',
      businessName: 'Ogabassey',
      phone: '08000000000',
      registeredAddress: {
        city: 'Ikeja',
        country: 'Nigeria',
        postal_code: '100001',
        state: null,
        street: '2 Olaide Tomori Street',
      },
      stateCode: 'LA',
    });

    expect(sender).toMatchObject({
      city: 'Ikeja',
      country: 'Nigeria',
      countryCode: 'NG',
      state: 'Lagos',
    });
  });

  it('normalizes the FCT subdivision code for GIGL station matching', () => {
    const sender = buildMerchantSenderInfo({
      businessAddress: '29 Yedseram Crescent, Maitama, 904101',
      businessName: 'Merchant',
      phone: '08000000000',
      registeredAddress: {
        city: 'Maitama',
        country: 'Nigeria',
        postal_code: '904101',
        state: null,
      },
      stateCode: 'FC',
    });

    expect(sender.state).toBe('Abuja');
  });
});
