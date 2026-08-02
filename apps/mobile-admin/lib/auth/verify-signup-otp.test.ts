import type { Session, User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: mocks.verifyOtp,
    },
  },
}));

import { runSignupOtpVerification } from './verify-signup-otp';

function createSession(userId = 'verified-user'): Session {
  const user: User = {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-28T00:00:00.000Z',
    id: userId,
    user_metadata: {},
  };

  return {
    access_token: `access-${userId}`,
    expires_in: 3600,
    refresh_token: `refresh-${userId}`,
    token_type: 'bearer',
    user,
  };
}

describe('runSignupOtpVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses signup OTP only, awaits cross-user reset, then commits the exact session', async () => {
    const session = createSession();
    const reset = Promise.withResolvers<void>();
    const setState = vi.fn();
    mocks.verifyOtp.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    const verification = runSignupOtpVerification({
      email: 'merchant@example.com',
      getCurrentUserId: () => 'prior-user',
      onResetUserStores: () => reset.promise,
      setState,
      token: '123456',
    });

    await vi.waitFor(() => {
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        email: 'merchant@example.com',
        token: '123456',
        type: 'signup',
      });
    });
    expect(setState).not.toHaveBeenCalled();

    reset.resolve();

    await expect(verification).resolves.toEqual({
      error: null,
      sessionEstablished: true,
    });
    expect(setState).toHaveBeenCalledWith({
      isAuthenticated: true,
      isInitialized: true,
      isLoading: false,
      session,
      user: session.user,
    });
    expect(mocks.verifyOtp).toHaveBeenCalledOnce();
  });

  it('does not authenticate when Supabase omits the session or user', async () => {
    const setState = vi.fn();
    mocks.verifyOtp.mockResolvedValue({
      data: { session: null, user: createSession().user },
      error: null,
    });

    await expect(
      runSignupOtpVerification({
        email: 'merchant@example.com',
        getCurrentUserId: () => undefined,
        onResetUserStores: vi.fn(),
        setState,
        token: '123456',
      })
    ).resolves.toEqual({
      error:
        'Email verification did not finish. Request a new code and try again.',
    });
    expect(setState).not.toHaveBeenCalled();
  });

  it('returns an actionable message for an invalid or expired signup code', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('Token has expired or is invalid'),
    });

    await expect(
      runSignupOtpVerification({
        email: 'merchant@example.com',
        getCurrentUserId: () => undefined,
        onResetUserStores: vi.fn(),
        setState: vi.fn(),
        token: '000000',
      })
    ).resolves.toEqual({
      error:
        'That verification code is invalid or expired. Request a new code and try again.',
    });
  });
});
