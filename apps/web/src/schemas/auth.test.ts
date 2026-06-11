import { describe, expect, it } from 'vitest';
import { forgotPasswordSchema, loginSchema } from './auth';

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
