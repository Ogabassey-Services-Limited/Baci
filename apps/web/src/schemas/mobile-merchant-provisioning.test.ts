import { MERCHANT_COUNTRIES } from '@baci/shared/constants';
import { describe, expect, it } from 'vitest';
import { mobileMerchantProvisioningSchema } from './mobile-merchant-provisioning';

const validInput = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: '+234 801 234 5678',
  businessName: 'Analytical Engines',
  businessType: 'technology',
  country: 'NG',
  slug: 'analytical-engines',
  slugIsCustom: true,
  logoUrl: 'https://cdn.usebaci.com/logo.png',
  brandColors: {
    primary: '#111111',
    background: '#ffffff',
    accent: 'rgb(245, 158, 11)',
  },
};

describe('mobileMerchantProvisioningSchema', () => {
  it('normalizes the business name and sanitizes bounded profile fields', () => {
    const result = mobileMerchantProvisioningSchema.parse({
      ...validInput,
      firstName: '  Ada  ',
      lastName: '  Lovelace  ',
      phone: '+234 abc 801-234',
      businessName: '  Analytical   Engines  ',
    });

    expect(result).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+234  801-234',
      businessName: 'Analytical Engines',
    });
  });

  it.each(MERCHANT_COUNTRIES)('accepts supported merchant country $code', ({
    code,
  }) => {
    expect(
      mobileMerchantProvisioningSchema.safeParse({
        ...validInput,
        country: code,
      }).success
    ).toBe(true);
  });

  it('rejects a country outside the merchant onboarding catalog', () => {
    expect(
      mobileMerchantProvisioningSchema.safeParse({
        ...validInput,
        country: 'AR',
      }).success
    ).toBe(false);
  });

  it.each([
    'email',
    'password',
    'confirmPassword',
    'userId',
    'merchantId',
    'rootDomain',
    'signupSource',
    'payoutCurrency',
    'unknown',
  ])('rejects caller-owned authority field %s', (field) => {
    expect(
      mobileMerchantProvisioningSchema.safeParse({
        ...validInput,
        [field]: 'caller-value',
      }).success
    ).toBe(false);
  });

  it('requires Other details only when Other is selected', () => {
    expect(
      mobileMerchantProvisioningSchema.safeParse({
        ...validInput,
        businessType: 'other',
        otherBusinessType: undefined,
      }).success
    ).toBe(false);
    expect(
      mobileMerchantProvisioningSchema.safeParse({
        ...validInput,
        businessType: 'other',
        otherBusinessType: 'Consulting',
      }).success
    ).toBe(true);
  });

  it('allows an overlong automatic slug so the RPC can truncate and de-duplicate it', () => {
    expect(
      mobileMerchantProvisioningSchema.safeParse({
        ...validInput,
        slug: `a${'b'.repeat(62)}c`,
        slugIsCustom: false,
      }).success
    ).toBe(true);
  });

  it('accepts documented lower and upper boundaries', () => {
    expect(
      mobileMerchantProvisioningSchema.safeParse({
        ...validInput,
        firstName: 'a',
        lastName: 'b',
        phone: '1'.repeat(32),
        businessName: 'ab',
        businessType: 'x',
        slug: 'abc',
        logoUrl: `https://x.test/${'a'.repeat(2033)}`,
        brandColors: {
          primary: `#${'a'.repeat(6)}`,
          background: '#fff',
          accent: '#fff',
        },
      }).success
    ).toBe(true);
  });

  it.each([
    { firstName: 'a'.repeat(101) },
    { lastName: 'b'.repeat(101) },
    { phone: '1'.repeat(33) },
    { businessName: 'b'.repeat(201) },
    { businessType: 'b'.repeat(101) },
    { otherBusinessType: 'b'.repeat(101) },
    { slug: `a${'b'.repeat(62)}c` },
    { logoUrl: `https://x.test/${'a'.repeat(2034)}` },
  ])('rejects an over-limit field %#', (override) => {
    expect(
      mobileMerchantProvisioningSchema.safeParse({
        ...validInput,
        businessType:
          'otherBusinessType' in override ? 'other' : validInput.businessType,
        ...override,
      }).success
    ).toBe(false);
  });

  it('rejects invalid or over-limit CSS color values', () => {
    expect(
      mobileMerchantProvisioningSchema.safeParse({
        ...validInput,
        brandColors: { ...validInput.brandColors, primary: 'not-a-color' },
      }).success
    ).toBe(false);
    expect(
      mobileMerchantProvisioningSchema.safeParse({
        ...validInput,
        brandColors: {
          ...validInput.brandColors,
          primary: `#${'a'.repeat(64)}`,
        },
      }).success
    ).toBe(false);
  });
});
