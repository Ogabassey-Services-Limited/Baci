import { describe, expect, it, vi } from 'vitest';
import { resolveOnboardingUser } from './resolve-onboarding-user';

describe('resolveOnboardingUser', () => {
  it('reuses the authenticated user when the email matches the submission', async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1', email: 'merchant@example.com' } },
    });
    const client = {
      auth: {
        getUser,
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      },
    };

    await expect(
      resolveOnboardingUser({
        supabase: client as never,
        email: 'merchant@example.com',
        password: 'StrongP@ss123!',
        redirectUrl: 'https://usebaci.com/onboarding',
        businessName: 'Merchant',
        onNewSession: () => undefined,
      })
    ).resolves.toMatchObject({ user: { id: 'user-1' } });
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('gives generic login guidance without exposing a changed session identity', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'other-user', email: 'other@example.com' } },
        }),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      },
    };

    const result = await resolveOnboardingUser({
      supabase: client as never,
      email: 'merchant@example.com',
      password: 'StrongP@ss123!',
      redirectUrl: 'https://usebaci.com/onboarding',
      businessName: 'Merchant',
      onNewSession: () => undefined,
    });

    expect(result).toEqual({
      status: 'message',
      message: 'Please sign in with the account used for this store setup.',
    });
    expect(JSON.stringify(result)).not.toContain('other@example.com');
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('normalizes obscured existing-account and no-session responses to safe login guidance', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid login credentials' },
        }),
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: 'hidden-user' }, session: null },
          error: null,
        }),
        signOut: vi.fn(),
      },
    };

    await expect(
      resolveOnboardingUser({
        supabase: client as never,
        email: 'merchant@example.com',
        password: 'StrongP@ss123!',
        redirectUrl: 'https://usebaci.com/onboarding',
        businessName: 'Merchant',
        onNewSession: () => undefined,
      })
    ).resolves.toEqual({
      status: 'message',
      message: 'An account may already exist. Please log in to continue.',
    });
  });

  it('does not surface provider authentication errors to unauthenticated callers', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'upstream provider details' },
        }),
        signUp: vi.fn(),
        signOut: vi.fn(),
      },
    };

    await expect(
      resolveOnboardingUser({
        supabase: client as never,
        email: 'merchant@example.com',
        password: 'StrongP@ss123!',
        redirectUrl: 'https://usebaci.com/onboarding',
        businessName: 'Merchant',
        onNewSession: () => undefined,
      })
    ).resolves.toEqual({
      status: 'message',
      message: 'Could not verify your account. Please try again.',
    });
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('does not mutate authentication when session verification fails', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'session verification unavailable' },
        }),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      },
    };

    await expect(
      resolveOnboardingUser({
        supabase: client as never,
        email: 'merchant@example.com',
        password: 'StrongP@ss123!',
        redirectUrl: 'https://usebaci.com/onboarding',
        businessName: 'Merchant',
        onNewSession: () => undefined,
      })
    ).resolves.toEqual({
      status: 'message',
      message: 'Could not verify your account. Please try again.',
    });
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('returns generic verification guidance for a non-duplicate signup failure', async () => {
    const client = {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid login credentials' },
        }),
        signUp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'signup provider unavailable' },
        }),
        signOut: vi.fn(),
      },
    };

    await expect(
      resolveOnboardingUser({
        supabase: client as never,
        email: 'merchant@example.com',
        password: 'StrongP@ss123!',
        redirectUrl: 'https://usebaci.com/onboarding',
        businessName: 'Merchant',
        onNewSession: () => undefined,
      })
    ).resolves.toEqual({
      status: 'message',
      message: 'Could not verify your account. Please try again.',
    });
  });

  it('uses the stable duplicate-account code for existing-account guidance', async () => {
    const client = {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid login credentials' },
        }),
        signUp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { code: 'user_already_exists', message: 'opaque error' },
        }),
        signOut: vi.fn(),
      },
    };

    await expect(
      resolveOnboardingUser({
        supabase: client as never,
        email: 'merchant@example.com',
        password: 'StrongP@ss123!',
        redirectUrl: 'https://usebaci.com/onboarding',
        businessName: 'Merchant',
        onNewSession: () => undefined,
      })
    ).resolves.toEqual({
      status: 'message',
      message: 'An account may already exist. Please log in to continue.',
    });
  });
});
