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
});
