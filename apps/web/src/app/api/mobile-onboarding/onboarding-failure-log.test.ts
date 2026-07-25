import { afterEach, describe, expect, it, vi } from 'vitest';
import { logOnboardingFailure } from './onboarding-failure-log';

/** Shape of a supabase-js PostgrestError: an Error carrying code/details/hint. */
function postgrestError(code: string, message: string, details?: string) {
  return Object.assign(new Error(message), {
    code,
    details: details ?? null,
    hint: null,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logOnboardingFailure', () => {
  it('keeps the Postgres code that the old catch-all discarded', () => {
    // Arrange — the exact error that broke mobile signup for three days.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    logOnboardingFailure(
      postgrestError(
        '42501',
        'new row violates row-level security policy for table "merchants"'
      ),
      { accountCreated: true }
    );

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
    logOnboardingFailure(postgrestError('42P17', 'recursion'));
    logOnboardingFailure(new Error('socket hang up'));

    // Assert — a drain can alert on the label without parsing payloads.
    expect(errorSpy.mock.calls[0][0]).toBe(
      'mobile-onboarding deployment_fault'
    );
    expect(errorSpy.mock.calls[1][0]).toBe(
      'mobile-onboarding unexpected_error'
    );
  });

  it('records which provisioning stage failed', () => {
    // Arrange
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    logOnboardingFailure(postgrestError('42501', 'denied'), {
      stage: 'domain_provisioning',
      merchantId: 'merch-1',
    });

    // Assert
    expect(JSON.parse(errorSpy.mock.calls[0][1] as string)).toMatchObject({
      stage: 'domain_provisioning',
      merchantId: 'merch-1',
    });
  });

  describe('PII', () => {
    it('keeps the failing row out of the log', () => {
      // Arrange: Postgres puts the offending row in DETAIL for
      // not-null/check/unique violations — here that is the signing-up user.
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      logOnboardingFailure(
        postgrestError(
          '23502',
          'null value in column "email" violates not-null constraint',
          'Failing row contains (7d3f, victim@example.com, +2348012345678).'
        ),
        { accountCreated: true }
      );

      // Assert
      const logged = errorSpy.mock.calls[0][1] as string;
      expect(logged).not.toContain('victim@example.com');
      expect(logged).not.toContain('Failing row contains');
      // ...while the diagnosis is still there.
      expect(JSON.parse(logged).pgCode).toBe('23502');
    });
  });

  describe('non-Error throws', () => {
    it('survives a thrown string without losing the log line', () => {
      // Arrange
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      logOnboardingFailure('boom');

      // Assert
      expect(JSON.parse(errorSpy.mock.calls[0][1] as string)).toMatchObject({
        message: 'boom',
        name: 'string',
      });
    });
  });
});
