import { describe, expect, it } from 'vitest';
import { onboardingMagicLinkSchema } from './onboarding-magic-link';

describe('onboardingMagicLinkSchema', () => {
  it('accepts a valid email address', () => {
    const result = onboardingMagicLinkSchema.safeParse({
      email: 'merchant@example.com',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('merchant@example.com');
    }
  });

  it('rejects a malformed email address', () => {
    const result = onboardingMagicLinkSchema.safeParse({ email: 'not-email' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Please enter a valid email address.'
      );
    }
  });

  it('rejects an empty email address', () => {
    const result = onboardingMagicLinkSchema.safeParse({ email: '' });

    expect(result.success).toBe(false);
  });

  it('rejects an email address longer than 254 characters', () => {
    const longEmail = `${'a'.repeat(250)}@example.com`;

    const result = onboardingMagicLinkSchema.safeParse({ email: longEmail });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Email address is too long.'
      );
    }
  });

  it('rejects a missing email field', () => {
    const result = onboardingMagicLinkSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
