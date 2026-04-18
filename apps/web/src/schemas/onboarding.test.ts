import { describe, expect, it } from 'vitest';
import {
  checkPasswordStrength,
  MIN_ACCEPTABLE_PASSWORD_STRENGTH,
} from '@/lib/utils';
import {
  mobileOnboardingSchema,
  onboardingFormSchema,
  onboardingSchema,
  step1Schema,
  step2Schema,
  step3Schema,
} from './onboarding';

/** Helper to build a valid full onboarding payload. */
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    businessName: 'Test Business',
    businessType: 'retail',
    brandColors: '#ff0000',
    logoUrl: 'https://example.com/logo.png',
    email: 'user@example.com',
    ...overrides,
  };
}

describe('onboardingSchema', () => {
  it('parses a valid complete payload', () => {
    const result = onboardingSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('lowercases and trims email via preprocessor', () => {
    const result = onboardingSchema.safeParse(
      validPayload({ email: '  User@EXAMPLE.COM  ' })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('rejects missing businessName', () => {
    const result = onboardingSchema.safeParse(
      validPayload({ businessName: '' })
    );
    expect(result.success).toBe(false);
  });

  it('rejects businessName shorter than 2 characters', () => {
    const result = onboardingSchema.safeParse(
      validPayload({ businessName: 'A' })
    );
    expect(result.success).toBe(false);
  });

  it('rejects missing businessType', () => {
    const result = onboardingSchema.safeParse(
      validPayload({ businessType: '' })
    );
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = onboardingSchema.safeParse(
      validPayload({ email: 'not-an-email' })
    );
    expect(result.success).toBe(false);
  });

  it('rejects missing logoUrl (required for web)', () => {
    const result = onboardingSchema.safeParse(validPayload({ logoUrl: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects invalid logoUrl', () => {
    const result = onboardingSchema.safeParse(
      validPayload({ logoUrl: 'not-a-url' })
    );
    expect(result.success).toBe(false);
  });

  it('requires otherBusinessType when businessType is "other"', () => {
    const result = onboardingSchema.safeParse(
      validPayload({ businessType: 'other', otherBusinessType: '' })
    );
    expect(result.success).toBe(false);
  });

  it('accepts otherBusinessType when businessType is "other"', () => {
    const result = onboardingSchema.safeParse(
      validPayload({ businessType: 'other', otherBusinessType: 'Crafts' })
    );
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = onboardingSchema.safeParse(
      validPayload({
        password: 'StrongPass1!',
        confirmPassword: 'DifferentPass1!',
      })
    );
    expect(result.success).toBe(false);
  });

  it('rejects prefix-only confirm passwords', () => {
    const result = onboardingSchema.safeParse(
      validPayload({
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass',
      })
    );

    expect(result.success).toBe(false);
  });

  it('rejects short passwords', () => {
    const result = onboardingSchema.safeParse(
      validPayload({ password: 'abc', confirmPassword: 'abc' })
    );
    expect(result.success).toBe(false);
  });

  it('rejects weak passwords before confirmPassword mismatch checks run', () => {
    expect(checkPasswordStrength('weak')).toBeLessThan(
      MIN_ACCEPTABLE_PASSWORD_STRENGTH
    );

    const result = onboardingSchema.safeParse(
      validPayload({
        password: 'weak',
        confirmPassword: 'mismatch',
      })
    );

    expect(result.success).toBe(false);

    const confirmPasswordIssues =
      result.success === false
        ? result.error.issues.filter(
            (issue) => issue.path[0] === 'confirmPassword'
          )
        : [];
    const passwordIssues =
      result.success === false
        ? result.error.issues.filter((issue) => issue.path[0] === 'password')
        : [];

    expect(
      passwordIssues.some((issue) =>
        issue.message.includes('Password is too weak')
      )
    ).toBe(true);
    expect(confirmPasswordIssues).toHaveLength(0);
  });

  it('accepts matching strong passwords', () => {
    const result = onboardingSchema.safeParse(
      validPayload({
        password: 'MyStr0ng!Pass',
        confirmPassword: 'MyStr0ng!Pass',
      })
    );
    expect(result.success).toBe(true);
  });
});

describe('mobileOnboardingSchema', () => {
  it('allows optional logoUrl', () => {
    const result = mobileOnboardingSchema.safeParse({
      businessName: 'Mobile Store',
      businessType: 'fashion',
      brandColors: 'blue',
      email: 'mobile@test.com',
    });
    expect(result.success).toBe(true);
  });
});

describe('onboardingFormSchema', () => {
  it('allows prefix-only confirm passwords while the user is still typing', () => {
    const result = onboardingFormSchema.safeParse(
      validPayload({
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass',
      })
    );

    expect(result.success).toBe(true);
  });

  it('rejects non-prefix confirm password mismatches', () => {
    const result = onboardingFormSchema.safeParse(
      validPayload({
        password: 'StrongPass123!',
        confirmPassword: 'WrongPass456!',
      })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === 'confirmPassword')
      ).toBe(true);
    }
  });
});

describe('step1Schema', () => {
  it('parses valid step 1 data', () => {
    const result = step1Schema.safeParse({
      businessName: 'My Shop',
      businessType: 'electronics',
    });
    expect(result.success).toBe(true);
  });

  it('normalizes slug to lowercase with hyphens', () => {
    const result = step1Schema.safeParse({
      businessName: 'My Shop',
      businessType: 'electronics',
      slug: 'My Cool Store',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe('my-cool-store');
    }
  });

  it('rejects slug shorter than 3 characters', () => {
    const result = step1Schema.safeParse({
      businessName: 'My Shop',
      businessType: 'electronics',
      slug: 'ab',
    });
    expect(result.success).toBe(false);
  });
});

describe('step2Schema', () => {
  it('requires logoUrl', () => {
    const result = step2Schema.safeParse({
      brandColors: 'red',
      logoUrl: '',
    });
    expect(result.success).toBe(false);
  });

  it('parses valid step 2 data', () => {
    const result = step2Schema.safeParse({
      brandColors: '#ff0000',
      logoUrl: 'https://example.com/logo.png',
    });
    expect(result.success).toBe(true);
  });
});

describe('step3Schema', () => {
  it('parses valid email', () => {
    const result = step3Schema.safeParse({
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = step3Schema.safeParse({
      email: 'bad-email',
    });
    expect(result.success).toBe(false);
  });

  it('requires confirmPassword when password is provided', () => {
    const result = step3Schema.safeParse({
      email: 'test@example.com',
      password: 'MyStr0ng!Pass',
    });
    expect(result.success).toBe(false);
  });

  it('rejects prefix-only confirm passwords', () => {
    const result = step3Schema.safeParse({
      email: 'test@example.com',
      password: 'StrongPass123!',
      confirmPassword: 'StrongPass',
    });

    expect(result.success).toBe(false);
  });
});
