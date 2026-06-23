import { describe, expect, it } from 'vitest';
import {
  forgotPasswordSchema,
  loginSchema,
  merchantPasswordlessSendSchema,
  merchantPasswordlessVerifySchema,
  sendCodeSchema,
  verifyCodeSchema,
} from './auth';

describe('loginSchema', () => {
  it('accepts a valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Please enter a valid email address.'
      );
    }
  });

  it('allows existing short passwords to reach Supabase validation', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Please enter your password.'
      );
    }
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    const result = forgotPasswordSchema.safeParse({
      email: 'user@example.com',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'nope' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Please enter a valid email address.'
      );
    }
  });

  it('rejects a missing email field', () => {
    const result = forgotPasswordSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe('sendCodeSchema', () => {
  it('defaults storefront OTP sends to the web audience', () => {
    const result = sendCodeSchema.safeParse({
      email: 'customer@example.com',
      merchantSlug: 'ogabassey',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        audience: 'storefront-web',
        email: 'customer@example.com',
        merchantSlug: 'ogabassey',
      });
    }
  });

  it('accepts native audience and captcha token for shared endpoint clients', () => {
    const result = sendCodeSchema.safeParse({
      audience: 'native',
      captchaToken: 'captcha-token',
      email: 'customer@example.com',
      merchantSlug: 'ogabassey',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid storefront OTP send inputs', () => {
    const longEmail = `${'a'.repeat(245)}@example.com`;

    expect(
      sendCodeSchema.safeParse({
        captchaToken: 'x'.repeat(4097),
        email: 'customer@example.com',
        merchantSlug: 'ogabassey',
      }).success
    ).toBe(false);
    expect(
      sendCodeSchema.safeParse({
        email: 'customer@example.com',
        merchantSlug: '',
      }).success
    ).toBe(false);
    expect(
      sendCodeSchema.safeParse({
        email: longEmail,
        merchantSlug: 'ogabassey',
      }).success
    ).toBe(false);
    expect(
      sendCodeSchema.safeParse({
        email: 'not-an-email',
        merchantSlug: 'ogabassey',
      }).success
    ).toBe(false);
  });
});

describe('verifyCodeSchema', () => {
  it('accepts native OTP verification with a six-digit token', () => {
    const result = verifyCodeSchema.safeParse({
      audience: 'native',
      email: 'customer@example.com',
      merchantSlug: 'ogabassey',
      token: '123456',
    });

    expect(result.success).toBe(true);
  });

  it('rejects non-six-digit storefront OTP tokens', () => {
    for (const token of ['12345', '1234567', 'abcdef', '12a456']) {
      expect(
        verifyCodeSchema.safeParse({
          email: 'customer@example.com',
          merchantSlug: 'ogabassey',
          token,
        }).success
      ).toBe(false);
    }
  });

  it('rejects invalid storefront OTP verification inputs', () => {
    expect(
      verifyCodeSchema.safeParse({
        email: 'customer@example.com',
        merchantSlug: '',
        token: '123456',
      }).success
    ).toBe(false);
    expect(
      verifyCodeSchema.safeParse({
        email: 'not-an-email',
        merchantSlug: 'ogabassey',
        token: '123456',
      }).success
    ).toBe(false);
  });
});

describe('merchantPasswordlessSendSchema', () => {
  it('accepts a valid email with optional redirect target', () => {
    const result = merchantPasswordlessSendSchema.safeParse({
      email: 'merchant@example.com',
      redirectTo: '/dashboard/orders',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a valid email without redirect target', () => {
    const result = merchantPasswordlessSendSchema.safeParse({
      email: 'merchant@example.com',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid email formats', () => {
    const result = merchantPasswordlessSendSchema.safeParse({
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);
  });
});

describe('merchantPasswordlessVerifySchema', () => {
  it('accepts a valid email, six-digit token, and optional redirect target', () => {
    const result = merchantPasswordlessVerifySchema.safeParse({
      email: 'merchant@example.com',
      redirectTo: '/dashboard/orders',
      token: '123456',
    });

    expect(result.success).toBe(true);
  });

  it('rejects non-six-digit tokens', () => {
    for (const token of ['12345', '1234567', 'abcdef', '12a456']) {
      expect(
        merchantPasswordlessVerifySchema.safeParse({
          email: 'merchant@example.com',
          token,
        }).success
      ).toBe(false);
    }
  });
});
