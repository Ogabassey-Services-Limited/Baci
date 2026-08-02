import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOnboardingFailureResponse } from './onboarding-failure-response';

/** Shape of a supabase-js PostgrestError: an Error carrying code/details/hint. */
function postgrestError(code: string, message: string) {
  return Object.assign(new Error(message), {
    code,
    details: 'Failing row contains (...)',
    hint: null,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildOnboardingFailureResponse', () => {
  describe('recovery', () => {
    it('tells a caller whose account was created to sign in', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const res = buildOnboardingFailureResponse(
        postgrestError('42501', 'rls'),
        { accountExists: true }
      );
      const body = await res.json();

      // Assert
      expect(res.status).toBe(500);
      expect(body.code).toBe('account_created_store_setup_failed');
      expect(body.error).toMatch(/sign in/i);
    });

    it('ignores a caller-supplied message once an account exists', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act — the recovery instruction is the actionable thing to say, so a
      // step-specific message must not replace it.
      const res = buildOnboardingFailureResponse(
        postgrestError('42501', 'rls'),
        { accountExists: true, message: 'Failed to check existing account.' }
      );
      const body = await res.json();

      // Assert
      expect(body.code).toBe('account_created_store_setup_failed');
      expect(body.error).not.toBe('Failed to check existing account.');
    });
  });

  describe('no account created', () => {
    it('stays a plain 500 by default', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const res = buildOnboardingFailureResponse(new Error('bad json'), {
        accountExists: false,
      });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(500);
      expect(body.code).toBe('onboarding_failed');
      expect(body.error).toBe('Internal Server Error');
    });

    it('keeps a step-specific message when one is supplied', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const res = buildOnboardingFailureResponse(new Error('db down'), {
        accountExists: false,
        message: 'Failed to check existing account.',
      });
      const body = await res.json();

      // Assert
      expect(body.error).toBe('Failed to check existing account.');
      expect(body.code).toBe('onboarding_failed');
    });
  });

  it('does not leak the database message or details to the client', async () => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    const res = buildOnboardingFailureResponse(
      postgrestError('42501', 'new row violates row-level security policy'),
      { accountExists: false }
    );
    const body = await res.json();

    // Assert
    expect(JSON.stringify(body)).not.toContain('row-level security');
    expect(JSON.stringify(body)).not.toContain('Failing row contains');
  });
});
