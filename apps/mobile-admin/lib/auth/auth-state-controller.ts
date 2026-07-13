import type { Session, User } from '@supabase/supabase-js';
import {
  classifyAuthError,
  getAuthErrorCode,
} from '@/lib/auth/auth-error-classification';
import {
  type AuthStatePatch,
  getClearedAuthState,
  getSessionAuthState,
} from '@/lib/auth/commit-auth-state';

type AuthStoreSnapshot = {
  user: User | null;
};

type SupabaseAuthForController = {
  getClaims: () => Promise<{ data: unknown; error: unknown }>;
  getSession: () => Promise<{
    data: { session: Session | null };
    error: unknown;
  }>;
  getUser: () => Promise<{
    data: { user: User | null };
    error: unknown;
  }>;
  onAuthStateChange: (
    callback: (event: string, session: Session | null) => void
  ) => {
    data: {
      subscription: {
        unsubscribe: () => void;
      };
    };
  };
  signOut: (options: { scope: 'local' }) => Promise<{ error: unknown }>;
};

type AuthStateControllerParams = {
  auth: SupabaseAuthForController;
  getState: () => AuthStoreSnapshot;
  resetUserStores: () => Promise<void>;
  setState: (state: Partial<AuthStatePatch>) => void;
};

export type AuthStateController = {
  clearLocalAuthState: (options?: { resetStores?: boolean }) => Promise<void>;
  initialize: () => () => void;
};

export function createAuthStateController({
  auth,
  getState,
  resetUserStores,
  setState,
}: AuthStateControllerParams): AuthStateController {
  let validationEpoch = 0;

  function nextEpoch(): number {
    validationEpoch += 1;
    return validationEpoch;
  }

  function isCurrent(epoch: number): boolean {
    return epoch === validationEpoch;
  }

  function resetUserStoresInBackground(): void {
    void resetUserStores().catch((error) => {
      console.warn('[AuthStore] resetUserStores failed', error);
    });
  }

  async function clearLocalAuthState(options?: {
    resetStores?: boolean;
  }): Promise<void> {
    nextEpoch();
    setState(getClearedAuthState());

    if (options?.resetStores !== false) {
      await resetUserStores();
    }
  }

  async function clearTerminalValidationFailure(
    epoch: number,
    error: unknown
  ): Promise<void> {
    if (!isCurrent(epoch)) {
      return;
    }

    console.warn('[AuthStore] Terminal auth validation failure', {
      code: getAuthErrorCode(error),
    });

    try {
      const { error: signOutError } = await auth.signOut({ scope: 'local' });
      if (signOutError) {
        console.warn('[AuthStore] Terminal auth cleanup sign-out failed', {
          code: getAuthErrorCode(signOutError),
        });
      }
    } catch (signOutError) {
      console.warn('[AuthStore] Terminal auth cleanup sign-out failed', {
        code: getAuthErrorCode(signOutError),
      });
    }

    if (!isCurrent(epoch)) {
      return;
    }

    await clearLocalAuthState();
  }

  async function validatePersistedSession(
    session: Session,
    epoch: number
  ): Promise<void> {
    try {
      const claimsResult = await auth.getClaims();
      if (!isCurrent(epoch)) {
        return;
      }

      if (
        claimsResult.error &&
        classifyAuthError(claimsResult.error) === 'terminal'
      ) {
        await clearTerminalValidationFailure(epoch, claimsResult.error);
        return;
      }

      const userResult = await auth.getUser();
      if (!isCurrent(epoch)) {
        return;
      }

      if (userResult.error) {
        if (classifyAuthError(userResult.error) === 'terminal') {
          await clearTerminalValidationFailure(epoch, userResult.error);
        }
        return;
      }

      if (!userResult.data.user) {
        await clearTerminalValidationFailure(epoch, {
          code: 'missing_user',
          message: 'Server validation returned no user for persisted session.',
        });
        return;
      }

      setState({
        user: userResult.data.user,
        session,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });
    } catch (error) {
      if (isCurrent(epoch) && classifyAuthError(error) === 'terminal') {
        await clearTerminalValidationFailure(epoch, error);
      }
    }
  }

  function commitAndValidatePersistedSession(
    session: Session,
    epoch: number
  ): void {
    setState(getSessionAuthState(session));
    setTimeout(() => {
      void validatePersistedSession(session, epoch);
    }, 0);
  }

  let startupSessionHandled = false;

  function handleAuthEvent(event: string, session: Session | null): void {
    if (event === 'INITIAL_SESSION' && startupSessionHandled) {
      return;
    }

    const epoch = nextEpoch();

    if (event === 'SIGNED_OUT' || !session) {
      if (getState().user) {
        resetUserStoresInBackground();
      }
      setState(getClearedAuthState());
      return;
    }

    const currentUserId = getState().user?.id;
    const nextUserId = session.user.id;

    if (
      (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
      nextUserId &&
      currentUserId &&
      currentUserId !== nextUserId
    ) {
      resetUserStoresInBackground();
    }

    if (event === 'INITIAL_SESSION') {
      startupSessionHandled = true;
      commitAndValidatePersistedSession(session, epoch);
      return;
    }

    setState(getSessionAuthState(session));
  }

  async function initializeFromStoredSession(): Promise<void> {
    if (startupSessionHandled) {
      return;
    }

    try {
      const {
        data: { session },
        error,
      } = await auth.getSession();

      if (startupSessionHandled) {
        return;
      }

      if (error && classifyAuthError(error) === 'terminal') {
        await clearLocalAuthState();
        return;
      }

      if (!session) {
        setState(getClearedAuthState());
        return;
      }

      startupSessionHandled = true;
      const epoch = nextEpoch();
      commitAndValidatePersistedSession(session, epoch);
    } catch {
      if (startupSessionHandled) {
        return;
      }

      setState(getClearedAuthState());
    }
  }

  return {
    clearLocalAuthState,
    initialize: () => {
      startupSessionHandled = false;
      const {
        data: { subscription },
      } = auth.onAuthStateChange((event, session) => {
        handleAuthEvent(event, session);
      });

      void initializeFromStoredSession();

      return () => subscription.unsubscribe();
    },
  };
}
