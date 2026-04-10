import {
  EmailSchema,
  NigerianPhoneSchema,
  OptionalNigerianPhoneSchema,
  OtpSchema,
  PasswordSchema,
} from './auth-schemas';

describe('EmailSchema', () => {
  it('rejects empty and invalid email inputs', () => {
    expect(EmailSchema.safeParse('').success).toBe(false);
    expect(EmailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('rejects overly long email values', () => {
    const localPart = 'a'.repeat(250);
    expect(EmailSchema.safeParse(`${localPart}@example.com`).success).toBe(
      false
    );
  });

  it('accepts valid email input', () => {
    expect(EmailSchema.safeParse('customer@example.com').success).toBe(true);
  });
});

describe('OtpSchema', () => {
  it('accepts a 6-digit numeric code', () => {
    expect(OtpSchema.safeParse('123456').success).toBe(true);
  });

  it('rejects non-numeric and wrong-length codes', () => {
    expect(OtpSchema.safeParse('12AB56').success).toBe(false);
    expect(OtpSchema.safeParse('12345').success).toBe(false);
    expect(OtpSchema.safeParse('1234567').success).toBe(false);
  });
});

describe('PasswordSchema', () => {
  it('accepts values at min and max length boundaries', () => {
    expect(PasswordSchema.safeParse('a'.repeat(8)).success).toBe(true);
    expect(PasswordSchema.safeParse('a'.repeat(100)).success).toBe(true);
  });

  it('rejects values outside the boundary limits', () => {
    expect(PasswordSchema.safeParse('short7').success).toBe(false);
    expect(PasswordSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });

  it('accepts mixed character sets', () => {
    expect(PasswordSchema.safeParse('Str0ng!Pass#2026').success).toBe(true);
  });
});

describe('NigerianPhoneSchema', () => {
  it('accepts supported Nigerian phone formats', () => {
    const accepted = [
      '08012345678',
      '+2348012345678',
      '2348012345678',
      '8012345678',
      '080-1234-5678',
      '(080) 1234 5678',
    ];

    for (const phone of accepted) {
      expect(NigerianPhoneSchema.safeParse(phone).success).toBe(true);
    }
  });

  it('rejects invalid Nigerian phone values', () => {
    expect(NigerianPhoneSchema.safeParse('12345').success).toBe(false);
    expect(NigerianPhoneSchema.safeParse('+1118012345678').success).toBe(false);
  });
});

describe('OptionalNigerianPhoneSchema', () => {
  it('parses empty strings to undefined', () => {
    const result = OptionalNigerianPhoneSchema.safeParse('');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeUndefined();
    }
  });

  it('accepts valid phone values and undefined', () => {
    expect(OptionalNigerianPhoneSchema.safeParse('08012345678').success).toBe(
      true
    );
    expect(OptionalNigerianPhoneSchema.safeParse(undefined).success).toBe(true);
  });

  it('rejects invalid phone values', () => {
    const result = OptionalNigerianPhoneSchema.safeParse('not-a-phone');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});
