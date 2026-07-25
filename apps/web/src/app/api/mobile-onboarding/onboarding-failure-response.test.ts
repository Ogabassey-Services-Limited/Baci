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
  describe('observability', () => {
    it('logs the Postgres code that the old catch-all discarded', async () => {
      // Arrange — the exact error that broke mobile signup for three days.
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const rlsRejection = postgrestError(
        '42501',
        'new row violates row-level security policy for table "merchants"'
      );

      // Act
      buildOnboardingFailureResponse(rlsRejection, { accountCreated: true });

      // Assert
      const [label, payload] = errorSpy.mock.calls[0] as [string, string];
      expect(label).toBe('mobile-onboarding deployment_fault');
      expect(JSON.parse(payload)).toMatchObject({
        accountCreated: true,
        pgCode: '42501',
      });
    });

    it('labels a policy/grant fault distinctly from an ordinary error', () => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      buildOnboardingFailureResponse(postgrestError('42P17', 'recursion'), {
        accountCreated: false,
      });
      buildOnboardingFailureResponse(new Error('socket hang up'), {
        accountCreated: false,
      });

      // Assert — a drain can alert on the first label without parsing payloads.
      expect(errorSpy.mock.calls[0][0]).toBe(
        'mobile-onboarding deployment_fault'
      );
      expect(errorSpy.mock.calls[1][0]).toBe(
        'mobile-onboarding unexpected_error'
      );
    });

    it('does not leak the database message or details to the client', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const res = buildOnboardingFailureResponse(
        postgrestError('42501', 'new row violates row-level security policy'),
        { accountCreated: false }
      );
      const body = await res.json();

      // Assert
      expect(JSON.stringify(body)).not.toContain('row-level security');
      expect(JSON.stringify(body)).not.toContain('Failing row contains');
    });
  });

  describe('recovery', () => {
    it('tells a caller whose account was created to sign in', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const res = buildOnboardingFailureResponse(
        postgrestError('42501', 'rls'),
        { accountCreated: true }
      );
      const body = await res.json();

      // Assert
      expect(res.status).toBe(500);
      expect(body.code).toBe('account_created_store_setup_failed');
      expect(body.error).toMatch(/sign in/i);
    });

    it('stays a plain 500 when no account was created', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act — failure before signUp ran: there is nothing to recover into.
      const res = buildOnboardingFailureResponse(new Error('bad json'), {
        accountCreated: false,
      });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(500);
      expect(body.code).toBe('onboarding_failed');
      expect(body.error).toBe('Internal Server Error');
    });
  });

  describe('non-Error throws', () => {
    it('survives a thrown string without losing the log line', () => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const res = buildOnboardingFailureResponse('boom', {
        accountCreated: false,
      });

      // Assert
      expect(res.status).toBe(500);
      expect(JSON.parse(errorSpy.mock.calls[0][1] as string)).toMatchObject({
        message: 'boom',
        name: 'string',
      });
    });
  });
});
