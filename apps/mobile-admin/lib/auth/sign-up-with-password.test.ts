import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runPasswordSignUp } from './sign-up-with-password';

const mocks = vi.hoisted(() => ({
  checkPasswordBreach: vi.fn(),
  signUp: vi.fn(),
  trackAuthTelemetry: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signUp: mocks.signUp } },
}));

vi.mock('@/lib/auth/check-password-breach', () => ({
  checkPasswordBreach: mocks.checkPasswordBreach,
}));

vi.mock('@/services/auth-telemetry', () => ({
  trackAuthTelemetry: mocks.trackAuthTelemetry,
}));

// This flow's whole point is that supabase.auth.signUp creates ONLY an auth
// user and NO merchant. That holds only while handle_new_user() stays a no-op
// (no auth.users trigger inserts a merchant). If that regresses, an invitee
// would own a store and get_user_merchant_context would pin them to it.

function makeOptions(overrides: Record<string, unknown> = {}) {
  return {
    email: 'staff@example.com',
    password: 'sup3r-secret-pw',
    getCurrentUserId: vi.fn(() => undefined),
    onResetUserStores: vi.fn().mockResolvedValue(undefined),
    setState: vi.fn(),
    ...overrides,
  };
}

describe('runPasswordSignUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkPasswordBreach.mockResolvedValue({ isBreached: false });
  });

  it('rejects a breached password before creating the auth account', async () => {
    mocks.checkPasswordBreach.mockResolvedValue({
      count: 12_345,
      isBreached: true,
    });

    const result = await runPasswordSignUp(makeOptions());

    expect(result.error).toMatch(/12,345 known data breaches/i);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('commits the session and resets stores for a brand-new user', async () => {
    const session = { access_token: 't' };
    const user = { id: 'user-1', identities: [{ id: 'i' }] };
    mocks.signUp.mockResolvedValue({ data: { session, user }, error: null });
    const opts = makeOptions();

    const result = await runPasswordSignUp(opts);

    expect(result).toEqual({ error: null, sessionEstablished: true });
    expect(opts.setState).toHaveBeenCalledWith(
      expect.objectContaining({ isAuthenticated: true, session, user })
    );
    expect(opts.onResetUserStores).toHaveBeenCalledTimes(1);
  });

  it('does not reset stores when the signed-up user is already the current user', async () => {
    const session = { access_token: 't' };
    const user = { id: 'user-1', identities: [{ id: 'i' }] };
    mocks.signUp.mockResolvedValue({ data: { session, user }, error: null });
    const opts = makeOptions({ getCurrentUserId: vi.fn(() => 'user-1') });

    const result = await runPasswordSignUp(opts);

    expect(result).toEqual({ error: null, sessionEstablished: true });
    expect(opts.onResetUserStores).not.toHaveBeenCalled();
  });

  it('returns the error message when signUp throws', async () => {
    mocks.signUp.mockRejectedValue(new Error('network exploded'));

    const result = await runPasswordSignUp(makeOptions());

    expect(result).toEqual({ error: 'network exploded' });
  });

  it('passes sentence-cased first, last, and full names as user metadata', async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        session: { access_token: 't' },
        user: { id: 'u', identities: [{}] },
      },
      error: null,
    });

    await runPasswordSignUp(
      makeOptions({
        firstName: 'aDA',
        lastName: 'lOVELACE',
        fullName: 'aDA lOVELACE',
      })
    );

    expect(mocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          data: {
            first_name: 'Ada',
            last_name: 'Lovelace',
            full_name: 'Ada Lovelace',
          },
        },
      })
    );
  });

  it('awaits prior-user cache clearing before committing and resolving signup', async () => {
    const session = { access_token: 't' };
    const user = { id: 'new-user', identities: [{ id: 'i' }] };
    const reset = Promise.withResolvers<void>();
    const opts = makeOptions({
      getCurrentUserId: vi.fn(() => 'prior-user'),
      onResetUserStores: vi.fn(() => reset.promise),
    });
    mocks.signUp.mockResolvedValue({ data: { session, user }, error: null });

    let resolved = false;
    const resultPromise = runPasswordSignUp(opts).then((result) => {
      resolved = true;
      return result;
    });
    await vi.waitFor(() => expect(opts.onResetUserStores).toHaveBeenCalled());

    expect(resolved).toBe(false);
    expect(opts.setState).not.toHaveBeenCalledWith(
      expect.objectContaining({ isAuthenticated: true })
    );

    reset.resolve();
    await expect(resultPromise).resolves.toEqual({
      error: null,
      sessionEstablished: true,
    });
    expect(opts.setState).toHaveBeenCalledWith(
      expect.objectContaining({ isAuthenticated: true, user })
    );
  });

  it('reports accountExists when identities is empty (confirmation on)', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'u', identities: [] } },
      error: null,
    });
    const opts = makeOptions();

    const result = await runPasswordSignUp(opts);

    expect(result).toEqual({ error: null, accountExists: true });
    expect(opts.setState).not.toHaveBeenCalledWith(
      expect.objectContaining({ isAuthenticated: true })
    );
  });

  it('reports accountExists on an "already registered" error', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'User already registered' },
    });

    const result = await runPasswordSignUp(makeOptions());

    expect(result).toEqual({ error: null, accountExists: true });
  });

  it('flags needsEmailConfirmation for a new user with no session', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'u', identities: [{ id: 'i' }] } },
      error: null,
    });

    const result = await runPasswordSignUp(makeOptions());

    expect(result).toEqual({ error: null, needsEmailConfirmation: true });
  });

  it('returns a friendly message when rate limited', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: {
        message:
          'For security purposes, you can only request this after 55 seconds',
        status: 429,
      },
    });

    const result = await runPasswordSignUp(makeOptions());

    expect(result.error).toMatch(/too many attempts/i);
  });

  it('passes through other errors', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Password should be at least 6 characters' },
    });

    const result = await runPasswordSignUp(makeOptions());

    expect(result).toEqual({
      error: 'Password should be at least 6 characters',
    });
  });
});
