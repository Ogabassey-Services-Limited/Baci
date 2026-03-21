import { isValidIMEI, ProductRowSchema } from './validation';

describe('isValidIMEI', () => {
  it('accepts a valid IMEI (Luhn check passes)', () => {
    // Known valid IMEI: 490154203237518
    expect(isValidIMEI('490154203237518')).toBe(true);
  });

  it('accepts another valid IMEI', () => {
    expect(isValidIMEI('356938035643809')).toBe(true);
  });

  it('rejects an IMEI with invalid checksum', () => {
    // Change the last digit of a valid IMEI
    expect(isValidIMEI('490154203237519')).toBe(false);
  });

  it('rejects a string that is too short', () => {
    expect(isValidIMEI('49015420323')).toBe(false);
  });

  it('rejects a string that is too long', () => {
    expect(isValidIMEI('4901542032375180')).toBe(false);
  });

  it('rejects a string with non-digit characters', () => {
    expect(isValidIMEI('49015420323751a')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidIMEI('')).toBe(false);
  });

  it('rejects a string with spaces', () => {
    expect(isValidIMEI('490 154 203 237')).toBe(false);
  });
});

describe('ProductRowSchema', () => {
  it('accepts legacy object-map variant attributes', () => {
    const result = ProductRowSchema.safeParse({
      id: '4bfca2e0-5d93-4cdf-b9fc-0b0fd3753e0f',
      name: 'Iphone 13 Pro 128gb Premium Used',
      slug: 'iphone-13-pro-128gb-premium-used',
      price: 552000,
      images: null,
      has_variants: false,
      variant_attributes: {},
      status: 'active',
    });

    expect(result.success).toBe(true);
  });

  it('accepts array-based variant attributes', () => {
    const result = ProductRowSchema.safeParse({
      id: '953ba6ff-3e83-403a-a07c-8c5ff54ede98',
      name: 'iPhone 13 Pro',
      slug: 'iphone-13-pro',
      price: 825000,
      images: ['https://cdn.example.com/iphone-13-pro-gold.avif'],
      has_variants: true,
      variant_attributes: [
        {
          param: 'storage',
          options: ['128GB', '256GB', '512GB'],
        },
      ],
      status: 'active',
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed array-based variant attributes', () => {
    const result = ProductRowSchema.safeParse({
      id: '953ba6ff-3e83-403a-a07c-8c5ff54ede98',
      name: 'iPhone 13 Pro',
      slug: 'iphone-13-pro',
      price: 825000,
      images: ['https://cdn.example.com/iphone-13-pro-gold.avif'],
      has_variants: true,
      variant_attributes: [
        {
          param: 123,
          options: '128GB',
        },
      ],
      status: 'active',
    });

    expect(result.success).toBe(false);
  });
});
