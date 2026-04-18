import { describe, expect, it } from 'vitest';
import { buildMerchantTrustProfile } from './build-merchant-trust-profile';

const merchantFixture = {
  business_name: 'Ogabassey',
  support_email: 'support@ogabassey.com',
  support_phone: '+2348000000000',
  social_media: { instagram: '@ogabassey', twitter: '@ogabasseyhq' },
  business_address: '12 Allen Avenue, Ikeja, Lagos',
  legal_entity_name: 'Ogabassey Gadgets Ltd',
  registered_address: {
    street: '12 Allen Avenue',
    city: 'Ikeja',
    state: 'Lagos',
    country: 'Nigeria',
  },
  tax_identification_number: 'TIN-123',
  pages: { privacy: 'Privacy copy', contact: 'Contact copy' },
  trust_profile: {
    founded_year: 2018,
    customer_service: {
      whatsapp_number: '+2348111111111',
      hours_summary: 'Mon-Sat, 8am-6pm',
      timezone: 'Africa/Lagos',
      response_time_summary: 'Within 2 business hours',
    },
    return_policy: {
      summary: 'Returns accepted for defective items.',
      window_days: 7,
      return_method: 'mail',
      return_fees: 'free',
    },
    shipping_policy: {
      summary: 'Nationwide delivery available.',
      regions: ['NG'],
      handling_days_min: 0,
      handling_days_max: 1,
      transit_days_min: 1,
      transit_days_max: 5,
      shipping_fee_type: 'calculated',
    },
    warranty_policy: { summary: 'Manufacturer warranty applies.' },
  },
} as const;

describe('buildMerchantTrustProfile', () => {
  it('assembles trust data from merchant columns and trust_profile fields', () => {
    const result = buildMerchantTrustProfile(
      merchantFixture,
      'https://ogabassey.com'
    );

    expect(result).toMatchObject({
      supportEmail: 'support@ogabassey.com',
      supportPhone: '+2348000000000',
      socialLinks: {
        instagram: 'https://instagram.com/ogabassey',
        twitter: 'https://x.com/ogabasseyhq',
      },
      businessAddress: '12 Allen Avenue, Ikeja, Lagos',
      registeredAddress: {
        street: '12 Allen Avenue',
        city: 'Ikeja',
        state: 'Lagos',
        country: 'Nigeria',
      },
      legalEntityName: 'Ogabassey Gadgets Ltd',
      taxIdentificationNumber: 'TIN-123',
      foundedYear: 2018,
      customerServiceHours: {
        summary: 'Mon-Sat, 8am-6pm',
        timezone: 'Africa/Lagos',
        responseTimeSummary: 'Within 2 business hours',
      },
      returnPolicy: {
        summary: 'Returns accepted for defective items.',
        windowDays: 7,
        returnMethod: 'mail',
        returnFees: 'free',
        localRoute: '/returns',
      },
      shippingPolicy: {
        summary: 'Nationwide delivery available.',
        regions: ['NG'],
        handlingDaysMin: 0,
        handlingDaysMax: 1,
        transitDaysMin: 1,
        transitDaysMax: 5,
        shippingFeeType: 'calculated',
        localRoute: '/shipping',
      },
      warrantyPolicy: {
        summary: 'Manufacturer warranty applies.',
        localRoute: '/warranty',
      },
      derivedLinks: {
        contact: 'https://ogabassey.com/contact',
        privacy: 'https://ogabassey.com/privacy-policy',
        returns: 'https://ogabassey.com/returns',
        shipping: 'https://ogabassey.com/shipping',
        warranty: 'https://ogabassey.com/warranty',
      },
    });
  });

  it('returns a sparse profile for an empty trust payload', () => {
    const result = buildMerchantTrustProfile(
      {
        business_name: 'Ogabassey',
        trust_profile: {},
      },
      'https://ogabassey.com'
    );

    expect(result).toEqual({
      socialLinks: {},
      derivedLinks: {},
    });
  });
});
