import { describe, expect, it } from 'vitest';
import { isPaypalMerchantCountry } from './paypal-merchant-countries';

describe('isPaypalMerchantCountry', () => {
  it.each([
    'GB',
    'US',
    'IE',
    'DE',
    'CA',
    'AU',
  ])('allows %s — PayPal pays merchants there', (country) => {
    expect(isPaypalMerchantCountry(country)).toBe(true);
  });

  it.each([
    'NG',
    'GH',
    'UG',
    'TZ',
    'RW',
  ])('refuses %s — PayPal is effectively send-only, so a merchant there can never be paid', (country) => {
    expect(isPaypalMerchantCountry(country)).toBe(false);
  });

  it('allows ZA and KE — PayPal does pay out there', () => {
    // Their currencies (ZAR/KES) are not PayPal currencies, but that is the
    // CURRENCY gate's job. Blocking them by country would refuse a merchant PayPal
    // is perfectly willing to pay, if they price in USD.
    expect(isPaypalMerchantCountry('ZA')).toBe(true);
    expect(isPaypalMerchantCountry('KE')).toBe(true);
  });

  it('fails closed on a missing or unknown country', () => {
    // An unset country is not evidence of eligibility. Offering PayPal to a
    // merchant who cannot be paid is worse than offering nothing.
    expect(isPaypalMerchantCountry(null)).toBe(false);
    expect(isPaypalMerchantCountry(undefined)).toBe(false);
    expect(isPaypalMerchantCountry('')).toBe(false);
    expect(isPaypalMerchantCountry('XX')).toBe(false);
  });

  it('normalizes case and whitespace', () => {
    expect(isPaypalMerchantCountry('gb')).toBe(true);
    expect(isPaypalMerchantCountry(' us ')).toBe(true);
  });
});
