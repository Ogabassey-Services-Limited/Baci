import type { Session, User } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthStateController } from './auth-state-controller';

function createSession(userId = 'user-1'): Session {
  const user: User = {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-06T00:00:00.000Z',
    id: userId,
    user_metadata: {},
  };

  return {
    access_token: `access-token-${userId}`,
    expires_at: 1_900_000_000,
    expires_in: 3600,
    refresh_token: `refresh-token-${userId}`,
    token_type: 'bearer',
    user,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

type AuthStateChangeCallback = (event: string, session: Session | null) => void;

describe('createAuthStateController', () => {
  const auth = {
    getClaims: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
  };
  const resetUserStores = vi.fn();
  const setState = vi.fn();
  let currentUser: User | null = null;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    currentUser = null;
    auth.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    auth.signOut.mockResolvedValue({ error: null });
    resetUserStores.mockResolvedValue(undefined);
    auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    consoleWarn.mockRestore();
  });

  function buildController() {
    return createAuthStateController({
      auth,
      getState: () => ({ user: currentUser }),
      resetUserStores,
      setState,
    });
  }

  function getLatestListener() {
    const listener = auth.onAuthStateChange.mock.calls.at(-1)?.[0] as
      | AuthStateChangeCallback
      | undefined;

    expect(listener).toBeDefined();
    return listener as AuthStateChangeCallback;
  }

  it('commits local session before server validation resolves', async () => {
    const session = createSession();
    const validation = deferred<{ data: { user: User }; error: null }>();
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    auth.getUser.mockReturnValue(validation.promise);
    const controller = buildController();

    controller.initialize();
    await vi.waitFor(() => {
      expect(setState).toHaveBeenCalledWith(
        expect.objectContaining({ isAuthenticated: true, session })
      );
    });

    validation.resolve({ data: { user: session.user }, error: null });
  });

  it('ignores stale validation after sign-out changes the epoch', async () => {
    const session = createSession();
    const validation = deferred<{ data: { user: User }; error: null }>();
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    auth.getUser.mockReturnValue(validation.promise);
    const controller = buildController();

    controller.initialize();
    const listener = getLatestListener();
    await vi.waitFor(() => {
      expect(setState).toHaveBeenCalledWith(
        expect.objectContaining({ isAuthenticated: true })
      );
    });

    listener?.('SIGNED_OUT', null);
    validation.resolve({ data: { user: session.user }, error: null });

    await vi.waitFor(() => {
      expect(setState).toHaveBeenLastCalledWith(
        expect.objectContaining({ isAuthenticated: false })
      );
    });
  });

  it('validates an INITIAL_SESSION event without getSession canceling it', async () => {
    const session = createSession();
    const storedSession = deferred<{
      data: { session: Session | null };
      error: null;
    }>();
    const validation = deferred<{ data: { user: User }; error: null }>();
    auth.getSession.mockReturnValue(storedSession.promise);
    auth.getUser.mockReturnValue(validation.promise);
    const controller = buildController();

    controller.initialize();
    const listener = getLatestListener();
    listener?.('INITIAL_SESSION', session);
    validation.resolve({ data: { user: session.user }, error: null });
    storedSession.resolve({ data: { session }, error: null });

    await vi.waitFor(() => {
      expect(setState).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          session,
          user: session.user,
        })
      );
      expect(auth.getUser).toHaveBeenCalledTimes(1);
    });
  });

  it('defers persisted session validation until after the auth callback returns', async () => {
    const session = createSession();
    const storedSession = deferred<{
      data: { session: Session | null };
      error: null;
    }>();
    auth.getSession.mockReturnValue(storedSession.promise);
    auth.getUser.mockResolvedValue({
      data: { user: session.user },
      error: null,
    });
    const controller = buildController();

    controller.initialize();
    const listener = getLatestListener();
    listener?.('INITIAL_SESSION', session);

    expect(auth.getClaims).not.toHaveBeenCalled();
    expect(auth.getUser).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(auth.getClaims).toHaveBeenCalledTimes(1);
      expect(auth.getUser).toHaveBeenCalledTimes(1);
    });

    storedSession.resolve({ data: { session }, error: null });
  });

  it('clears auth state when claims validation returns a terminal error', async () => {
    const session = createSession();
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    auth.getClaims.mockResolvedValue({
      data: null,
      error: { code: 'refresh_token_not_found' },
    });
    const controller = buildController();

    controller.initialize();

    await vi.waitFor(() => {
      expect(setState).toHaveBeenLastCalledWith(
        expect.objectContaining({ isAuthenticated: false })
      );
    });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(resetUserStores).toHaveBeenCalledTimes(1);
  });

  it('clears auth state when getUser returns a terminal error', async () => {
    const session = createSession();
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'user_not_found' },
    });
    const controller = buildController();

    controller.initialize();

    await vi.waitFor(() => {
      expect(setState).toHaveBeenLastCalledWith(
        expect.objectContaining({ isAuthenticated: false })
      );
    });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(resetUserStores).toHaveBeenCalledTimes(1);
  });

  it('clears auth state when server validation returns no user', async () => {
    const session = createSession();
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const controller = buildController();

    controller.initialize();

    await vi.waitFor(() => {
      expect(setState).toHaveBeenLastCalledWith(
        expect.objectContaining({ isAuthenticated: false })
      );
    });
    expect(resetUserStores).toHaveBeenCalledTimes(1);
  });

  it('resets user stores when a SIGNED_IN event switches users', () => {
    currentUser = createSession('user-1').user;
    const nextSession = createSession('user-2');
    const controller = buildController();

    controller.initialize();
    const listener = getLatestListener();
    listener?.('SIGNED_IN', nextSession);

    expect(resetUserStores).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({
        isAuthenticated: true,
        session: nextSession,
        user: nextSession.user,
      })
    );
  });

  it('does not reset user stores for a cold-start INITIAL_SESSION restore', async () => {
    const session = createSession('user-1');
    auth.getUser.mockResolvedValue({
      data: { user: session.user },
      error: null,
    });
    const controller = buildController();

    controller.initialize();
    const listener = getLatestListener();
    listener?.('INITIAL_SESSION', session);

    expect(resetUserStores).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(setState).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
          session,
          user: session.user,
        })
      );
    });
    expect(resetUserStores).not.toHaveBeenCalled();
  });

  it('logs background reset failures without interrupting sign-out state clearing', async () => {
    const resetError = new Error('reset failed');
    currentUser = createSession().user;
    resetUserStores.mockRejectedValueOnce(resetError);
    const controller = buildController();

    controller.initialize();
    const listener = getLatestListener();
    listener?.('SIGNED_OUT', null);

    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({ isAuthenticated: false })
    );
    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith(
        '[AuthStore] resetUserStores failed',
        resetError
      );
    });
  });
});
