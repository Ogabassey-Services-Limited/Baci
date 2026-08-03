import { beforeEach, describe, expect, it } from 'vitest';
import {
  getActionMocks,
  makeFormData,
  prevState,
  sendMagicLink,
  setupActionMocks,
  submitOnboarding,
  validFields,
} from './actions.test-support';

const mocks = getActionMocks();

describe('onboarding action authentication boundaries', () => {
  beforeEach(setupActionMocks);

  it('returns a rate-limit error before touching auth or the database', async () => {
    mocks.ensureActionRateLimit.mockResolvedValueOnce(false);

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Too many onboarding attempts');
    expect(mocks.ensureActionRateLimit).toHaveBeenCalledWith(
      'onboarding-submit',
      { requests: 5, windowMs: 900_000 }
    );
    expect(mocks.adminFrom).not.toHaveBeenCalled();
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid form data', async () => {
    const result = await submitOnboarding(
      prevState,
      makeFormData({ email: 'bad' })
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Form is incomplete');
  });

  it('returns a rate-limit error without sending an OTP email', async () => {
    mocks.ensureActionRateLimit.mockResolvedValueOnce(false);

    const result = await sendMagicLink('merchant@example.com');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Too many magic link requests');
    expect(mocks.ensureActionRateLimit).toHaveBeenCalledWith('magic-link', {
      requests: 3,
      windowMs: 60_000,
    });
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it('returns an error for an empty email without sending an OTP email', async () => {
    const result = await sendMagicLink('');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Email is required.');
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it('rejects an invalid email without sending an OTP email', async () => {
    const result = await sendMagicLink('not-an-email');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Please enter a valid email address.');
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it('rejects an overlong email without sending an OTP email', async () => {
    const result = await sendMagicLink(`${'a'.repeat(250)}@example.com`);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Email address is too long.');
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends the magic link with the onboarding redirect on success', async () => {
    const result = await sendMagicLink('merchant@example.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Magic link sent');
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'merchant@example.com',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: 'https://usebaci.com/onboarding?fromMagicLink=true',
      },
    });
  });

  it('returns a generic failed result for Supabase OTP errors', async () => {
    mocks.signInWithOtp.mockResolvedValueOnce({
      error: new Error('OTP rate limit reached'),
    });

    const result = await sendMagicLink('merchant@example.com');

    expect(result.success).toBe(false);
    expect(result.message).toBe(
      'Unable to send magic link. Please try again later.'
    );
  });
});
