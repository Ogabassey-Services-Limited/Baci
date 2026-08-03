import { AuthSessionMissingError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { resolveOnboardingUser } from './resolve-onboarding-user';

const input = {
  businessName: 'Merchant',
  email: 'merchant@example.com',
  password: 'StrongP@ss123!',
  redirectUrl: 'https://usebaci.com/onboarding',
};

describe('resolveOnboardingUser session-missing authentication', () => {
  it('continues with password sign-in after Supabase reports a missing session', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new AuthSessionMissingError(),
        }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: 'signed-in-user' } },
          error: null,
        }),
        signOut: vi.fn(),
        signUp: vi.fn(),
      },
    };

    const result = await resolveOnboardingUser({
      ...input,
      onNewSession: vi.fn(),
      supabase: client as never,
    });

    expect(result).toEqual({
      status: 'resolved',
      user: { id: 'signed-in-user' },
    });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
    });
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('continues to signup after missing session and invalid sign-in credentials', async () => {
    const onNewSession = vi.fn();
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new AuthSessionMissingError(),
        }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid login credentials' },
        }),
        signOut: vi.fn(),
        signUp: vi.fn().mockResolvedValue({
          data: {
            session: { access_token: 'new-session' },
            user: { id: 'new-user' },
          },
          error: null,
        }),
      },
    };

    const result = await resolveOnboardingUser({
      ...input,
      onNewSession,
      supabase: client as never,
    });

    expect(result).toEqual({ status: 'resolved', user: { id: 'new-user' } });
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: input.email,
      options: { emailRedirectTo: input.redirectUrl },
      password: input.password,
    });
    expect(onNewSession).toHaveBeenCalledOnce();
  });

  it('fails closed for non-session getUser errors', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('auth unavailable'),
        }),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        signUp: vi.fn(),
      },
    };

    await expect(
      resolveOnboardingUser({
        ...input,
        onNewSession: vi.fn(),
        supabase: client as never,
      })
    ).resolves.toEqual({
      status: 'message',
      message: 'Could not verify your account. Please try again.',
    });
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });
});
