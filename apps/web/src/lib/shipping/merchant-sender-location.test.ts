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

  it('preserves numeric registered postal codes', () => {
    const sender = buildMerchantSenderInfo({
      businessAddress: '2 Olaide Tomori Street, Ikeja, Lagos',
      businessName: 'Merchant',
      phone: '08000000000',
      registeredAddress: {
        city: 'Ikeja',
        country: 'Nigeria',
        postal_code: 100001,
        state: 'Lagos',
        street: '2 Olaide Tomori Street',
      },
      stateCode: 'LA',
    });

    expect(sender.postalCode).toBe('100001');
  });
});

describe('bugfix: legacy free-text-only merchant address', () => {
  it('does not default Abuja merchants to Lagos when business_address ends in a postal code', () => {
    const sender = buildMerchantSenderInfo({
      businessAddress: '29 Yedseram Crescent, Maitama, 904101',
      businessName: 'Merchant',
      phone: '08000000000',
      registeredAddress: null,
      stateCode: null,
    });

    expect(sender).toMatchObject({
      city: 'Maitama',
      state: 'Abuja',
    });
    expect(sender.state).not.toBe('Lagos');
  });
});
