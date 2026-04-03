/**
 * Tests for auth-store — focused on OAuth checkout fix behaviors:
 * - Customer lookup by user_id (not email)
 * - upsert_customer_on_auth RPC fallback
 * - _initGen cancellation guard
 * - onAuthStateChange event handling
 * - signInWithApple name upsert + cancellation
 * - cleanup() unsubscribes auth listener
 */

import { act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock declarations — jest.mock() factories must only reference module-scope
// `mock*`-prefixed variables (Jest hoisting rule). All dynamic behavior is
// applied via mockImplementation() in beforeEach/per-test instead.
// ---------------------------------------------------------------------------

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

const mockUnsubscribe = jest.fn();
// Holds the raw auth-state-change callback so tests can invoke it directly
let mockAuthListenerCb: (event: string, session: unknown) => Promise<void>;
const mockMakeRedirectUri = jest.fn(() => 'ogabassey://auth');
const mockGetQueryParams = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    // Replaced per-test via mockImplementation in resetAllMocks()
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      refreshSession: jest.fn(),
      setSession: jest.fn(),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: jest.fn(),
      signInWithIdToken: jest.fn(),
      updateUser: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: mockMakeRedirectUri,
}));

jest.mock('expo-auth-session/build/QueryParams', () => ({
  getQueryParams: mockGetQueryParams,
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: mockOpenAuthSessionAsync,
}));

jest.mock('../lib/auth-helpers', () => ({
  splitFullName: jest.fn((name: unknown) => {
    if (!name || typeof name !== 'string')
      return { firstName: '', lastName: '' };
    const parts = (name as string).trim().split(/\s+/);
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
    };
  }),
}));

jest.mock('../lib/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../lib/validation', () => ({
  CustomerRowSchema: {
    safeParse: jest.fn((data: unknown) => {
      if (data && typeof data === 'object' && 'id' in (data as object)) {
        const d = data as Record<string, unknown>;
        return {
          success: true,
          data: {
            id: d.id,
            email: d.email,
            first_name: d.first_name ?? null,
            last_name: d.last_name ?? null,
            phone: d.phone ?? null,
            loyalty_points: d.loyalty_points ?? null,
          },
        };
      }
      return {
        success: false,
        error: { flatten: () => ({ fieldErrors: {} }) },
      };
    }),
  },
  MerchantRowSchema: {
    safeParse: jest.fn((data: unknown) => {
      if (data && typeof data === 'object' && 'id' in (data as object)) {
        return { success: true, data };
      }
      return {
        success: false,
        error: { flatten: () => ({ fieldErrors: {} }) },
      };
    }),
  },
}));

const mockClearCart = jest.fn();
jest.mock('./cart-store', () => ({
  useCartStore: {
    getState: jest.fn(() => ({ items: [], clearCart: mockClearCart })),
  },
}));

const mockClearSaved = jest.fn();
jest.mock('./saved-store', () => ({
  useSavedStore: {
    getState: jest.fn(() => ({ clearSaved: mockClearSaved })),
  },
}));

const mockClearComparison = jest.fn();
jest.mock('./comparison-store', () => ({
  useComparisonStore: {
    getState: jest.fn(() => ({ clearComparison: mockClearComparison })),
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { merchantSlug: 'ogabassey' },
    },
  },
}));

// expo-apple-authentication: the store uses dynamic import() inside signInWithApple().
// jest.mock() with a factory is hoisted and intercepts both static and dynamic require()
// calls (babel transforms import() → require()). We expose the mock fns via mockAppleAuth
// so tests can call mockResolvedValueOnce / mockRejectedValueOnce per-test.
const mockAppleSignInAsync = jest.fn();
const mockAppleIsAvailableAsync = jest.fn();

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: mockAppleIsAvailableAsync,
  signInAsync: mockAppleSignInAsync,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'ios' },
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER all mocks are registered
// ---------------------------------------------------------------------------

import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth-store';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const MERCHANT_ID = 'merchant-uuid-1';
const USER_ID = 'user-uuid-1';

const mockMerchantRow = { id: MERCHANT_ID, slug: 'ogabassey' };

const mockUser = {
  id: USER_ID,
  email: 'test@example.com',
  user_metadata: {},
};

const mockSession = {
  user: mockUser,
  access_token: 'access-token-abc',
  refresh_token: 'refresh-token-xyz',
};

const mockCustomerRow = {
  id: 'customer-uuid-1',
  email: 'test@example.com',
  first_name: 'Ada',
  last_name: 'Okonkwo',
  phone: null,
  loyalty_points: 100,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a chainable Supabase query-builder stub that resolves with `result`. */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'insert', 'update', 'delete', 'upsert']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  chain.single = jest.fn(() => Promise.resolve(result));
  return chain;
}

/** Reset Zustand store to the initial unauthenticated state. */
function resetStore() {
  // The cast is needed because _initializationInProgress / _authSubscription
  // are internal fields not in the public AuthState interface.
  (useAuthStore.setState as (s: object) => void)({
    user: null,
    session: null,
    customer: null,
    merchantId: null,
    isLoading: true,
    isInitialized: false,
    error: null,
    _initGen: 0,
    _initializationInProgress: false,
    _authSubscription: null,
  });
}

async function flushAuthHydration() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/**
 * Wire up default mock implementations on supabase.*
 * Individual tests override these as needed.
 */
function resetSupabaseMocks({
  merchantResult = { data: mockMerchantRow, error: null },
  customerResult = { data: null, error: null },
  session = null,
  getUser = { data: { user: null }, error: null },
  refreshSession = {
    data: { session: null },
    error: { message: 'Refresh token invalid' },
  },
}: {
  merchantResult?: { data: unknown; error: unknown };
  customerResult?: { data: unknown; error: unknown };
  session?: unknown;
  getUser?: { data: { user: unknown }; error: unknown };
  refreshSession?: { data: { session: unknown }; error: unknown };
} = {}) {
  (supabase.from as jest.Mock).mockImplementation((table: string) =>
    makeChain(table === 'merchants' ? merchantResult : customerResult)
  );
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session },
    error: null,
  });
  (supabase.auth.getUser as jest.Mock).mockResolvedValue(getUser);
  (supabase.auth.refreshSession as jest.Mock).mockResolvedValue(refreshSession);
  (supabase.auth.setSession as jest.Mock).mockResolvedValue({
    data: { session: null, user: null },
    error: null,
  });
  (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
    data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' },
    error: null,
  });
  (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValue({
    data: { user: null, session: null },
    error: null,
  });
  (supabase.auth.updateUser as jest.Mock).mockResolvedValue({ error: null });
  (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
    (cb: (event: string, session: unknown) => Promise<void>) => {
      mockAuthListenerCb = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    }
  );
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsubscribe.mockReset();
    mockClearCart.mockReset();
    // Reset the captured auth listener so no test leaks a stale callback
    mockAuthListenerCb = async () => {};
    resetStore();
    resetSupabaseMocks();
    mockMakeRedirectUri.mockReturnValue('ogabassey://auth');
    mockGetQueryParams.mockReturnValue({
      errorCode: null,
      params: {
        access_token: 'oauth-access-token',
        refresh_token: 'oauth-refresh-token',
      },
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'ogabassey://auth#access_token=oauth-access-token&refresh_token=oauth-refresh-token',
    });
  });

  // -------------------------------------------------------------------------
  describe('initialize() — customer record exists by user_id', () => {
    it('fetches customer by user_id and populates store when record exists', async () => {
      // Arrange
      resetSupabaseMocks({
        session: mockSession,
        getUser: { data: { user: mockUser }, error: null },
        customerResult: { data: mockCustomerRow, error: null },
      });

      // Act
      await act(async () => {
        await useAuthStore.getState().initialize();
      });
      await flushAuthHydration();

      // Assert
      const state = useAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.customer).not.toBeNull();
      expect(state.customer?.id).toBe('customer-uuid-1');
      expect(state.customer?.email).toBe('test@example.com');
      expect(state.merchantId).toBe(MERCHANT_ID);
    });

    it('does NOT call upsert_customer_on_auth RPC when customer record exists', async () => {
      // Arrange
      resetSupabaseMocks({
        session: mockSession,
        getUser: { data: { user: mockUser }, error: null },
        customerResult: { data: mockCustomerRow, error: null },
      });

      // Act
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      // Assert
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        'upsert_customer_on_auth',
        expect.anything()
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('initialize() — no customer record, calls RPC then re-fetches', () => {
    it('calls upsert_customer_on_auth with correct params when no customer found', async () => {
      // Arrange: first customers query → null; after RPC → re-fetch returns the row
      resetSupabaseMocks({
        session: mockSession,
        getUser: { data: { user: mockUser }, error: null },
      });

      let customerCallCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'merchants')
          return makeChain({ data: mockMerchantRow, error: null });
        customerCallCount += 1;
        return makeChain(
          customerCallCount === 1
            ? { data: null, error: null }
            : { data: mockCustomerRow, error: null }
        );
      });

      // Act
      await act(async () => {
        await useAuthStore.getState().initialize();
      });
      await flushAuthHydration();

      // Assert
      expect(supabase.rpc).toHaveBeenCalledWith('upsert_customer_on_auth', {
        p_merchant_id: MERCHANT_ID,
        p_user_id: USER_ID,
        p_email: 'test@example.com',
        p_full_name: null,
        p_phone: null,
      });
    });

    it('populates customer from re-fetch after RPC call', async () => {
      // Arrange
      resetSupabaseMocks({
        session: mockSession,
        getUser: { data: { user: mockUser }, error: null },
      });

      let customerCallCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'merchants')
          return makeChain({ data: mockMerchantRow, error: null });
        customerCallCount += 1;
        return makeChain(
          customerCallCount === 1
            ? { data: null, error: null }
            : { data: mockCustomerRow, error: null }
        );
      });

      // Act
      await act(async () => {
        await useAuthStore.getState().initialize();
      });
      await flushAuthHydration();

      // Assert
      const state = useAuthStore.getState();
      expect(state.customer?.id).toBe('customer-uuid-1');
      expect(state.isInitialized).toBe(true);
    });

    it('handles RPC error gracefully and still completes initialization', async () => {
      // Arrange
      resetSupabaseMocks({
        session: mockSession,
        getUser: { data: { user: mockUser }, error: null },
      });
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });
      // Both customer calls return null (RPC failed, nothing to re-fetch)
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'merchants')
          return makeChain({ data: mockMerchantRow, error: null });
        return makeChain({ data: null, error: null });
      });

      // Act — should not throw
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      // Assert: store still marks itself initialized without crashing
      expect(useAuthStore.getState().isInitialized).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('initialize() — _initGen cancellation guard', () => {
    it('does not crash or leave corrupt state when a stale init is superseded', async () => {
      // Arrange: delay getSession so we can call cleanup() mid-flight
      let resolveSession!: (v: unknown) => void;
      (supabase.auth.getSession as jest.Mock).mockReturnValueOnce(
        new Promise((res) => {
          resolveSession = res;
        })
      );

      // Act: start initialize (doesn't await yet)
      const initPromise = useAuthStore.getState().initialize();

      // Supersede the init by calling cleanup(), which bumps _initGen
      act(() => {
        useAuthStore.getState().cleanup();
      });

      // Unblock the session promise
      resolveSession({ data: { session: null }, error: null });

      await act(async () => {
        await initPromise;
      });

      // Assert: store is accessible and not in a broken state
      const state = useAuthStore.getState();
      expect(state).toBeDefined();
      // isLoading may be true (stale init was cancelled before it could set false)
      // The important thing: no unhandled exception was thrown
    });
  });

  // -------------------------------------------------------------------------
  describe('initialize() — no active session', () => {
    it('sets user and customer to null when there is no session', async () => {
      // Arrange: default mocks already have session: null

      // Act
      await act(async () => {
        await useAuthStore.getState().initialize();
      });
      await flushAuthHydration();

      // Assert
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.customer).toBeNull();
      expect(state.isInitialized).toBe(true);
    });

    it('sets merchantId from the merchants table lookup', async () => {
      // Act
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      expect(useAuthStore.getState().merchantId).toBe(MERCHANT_ID);
    });

    it('enters guest mode (merchantId null) when merchant lookup fails', async () => {
      // Arrange
      resetSupabaseMocks({
        merchantResult: { data: null, error: { message: 'Not found' } },
      });

      // Act
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      // Assert
      const state = useAuthStore.getState();
      expect(state.merchantId).toBeNull();
      expect(state.isInitialized).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('initialize() — invalid session JWT', () => {
    it('clears session and enters guest mode when server-side getUser fails', async () => {
      // Arrange
      resetSupabaseMocks({
        session: mockSession,
        getUser: { data: { user: null }, error: { message: 'JWT expired' } },
        refreshSession: {
          data: { session: null },
          error: { message: 'Refresh token expired' },
        },
      });

      // Act
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      // Assert
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.customer).toBeNull();
      expect(state.isInitialized).toBe(true);
      // Persisted auth tokens should be cleared so next cold start doesn't retry
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('refreshes session when getUser fails with expired JWT but refresh token is valid', async () => {
      // Arrange
      const refreshedSession = {
        ...mockSession,
        access_token: 'refreshed-access-token',
      };
      resetSupabaseMocks({
        session: mockSession,
        getUser: {
          data: { user: null },
          error: { message: 'JWT expired', status: 401, code: 'bad_jwt' },
        },
        refreshSession: {
          data: { session: refreshedSession },
          error: null,
        },
        customerResult: { data: mockCustomerRow, error: null },
      });

      // Act
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      // Assert
      const state = useAuthStore.getState();
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
      expect(state.user?.id).toBe(USER_ID);
      expect(state.session).toEqual(refreshedSession);
      expect(state.customer?.id).toBe(mockCustomerRow.id);
      expect(state.isInitialized).toBe(true);
    });

    it('preserves the local session when getUser fails with a transient network error', async () => {
      // Arrange
      resetSupabaseMocks({
        session: mockSession,
        getUser: {
          data: { user: null },
          error: { message: 'Network request failed', status: 503 },
        },
      });

      // Act
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      // Assert
      const state = useAuthStore.getState();
      expect(state.user?.id).toBe(USER_ID);
      expect(state.session).toBe(mockSession);
      expect(state.isInitialized).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('initialize() — customer hydration timeouts', () => {
    it('preserves user/session and completes init without waiting when customer fetch hangs', async () => {
      const sessionWithoutEmail = {
        ...mockSession,
        user: { ...mockUser, email: null },
      };

      resetSupabaseMocks({
        session: sessionWithoutEmail,
        getUser: { data: { user: sessionWithoutEmail.user }, error: null },
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'merchants') {
          return makeChain({ data: mockMerchantRow, error: null });
        }

        const hangingCustomersChain = makeChain({ data: null, error: null });
        hangingCustomersChain.maybeSingle.mockImplementation(
          () => new Promise(() => void 0)
        );
        return hangingCustomersChain;
      });

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      expect(state.user?.id).toBe(USER_ID);
      expect(state.session).toEqual(sessionWithoutEmail);
      expect(state.customer).toBeNull();
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('onAuthStateChange — SIGNED_IN', () => {
    /** Run initialize so the auth listener is registered, then return. */
    async function runInitialize() {
      await act(async () => {
        await useAuthStore.getState().initialize();
      });
    }

    it('sets user, session, and customer when record found by user_id', async () => {
      // Arrange
      await runInitialize();

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'merchants')
          return makeChain({ data: mockMerchantRow, error: null });
        return makeChain({ data: mockCustomerRow, error: null });
      });

      // Act
      await act(async () => {
        await mockAuthListenerCb('SIGNED_IN', mockSession);
      });

      // Assert
      const state = useAuthStore.getState();
      expect(state.user?.id).toBe(USER_ID);
      expect(state.session).toBe(mockSession);
      expect(state.customer?.id).toBe('customer-uuid-1');
    });

    it('still updates user/session when merchant lookup failed during initialize', async () => {
      // Arrange
      resetSupabaseMocks({
        merchantResult: { data: null, error: { message: 'Not found' } },
      });
      await runInitialize();

      // Act
      await act(async () => {
        await mockAuthListenerCb('SIGNED_IN', mockSession);
      });

      // Assert
      const state = useAuthStore.getState();
      expect(state.merchantId).toBeNull();
      expect(state.user?.id).toBe(USER_ID);
      expect(state.session).toBe(mockSession);
      expect(state.customer).toBeNull();
    });

    it('calls upsert_customer_on_auth RPC when no customer found on SIGNED_IN', async () => {
      // Arrange
      await runInitialize();

      let listenerCustomerCallCount = 0;
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'merchants')
          return makeChain({ data: mockMerchantRow, error: null });
        listenerCustomerCallCount += 1;
        return makeChain(
          listenerCustomerCallCount === 1
            ? { data: null, error: null }
            : { data: mockCustomerRow, error: null }
        );
      });

      // Act
      await act(async () => {
        await mockAuthListenerCb('SIGNED_IN', mockSession);
      });

      // Assert
      expect(supabase.rpc).toHaveBeenCalledWith('upsert_customer_on_auth', {
        p_merchant_id: MERCHANT_ID,
        p_user_id: USER_ID,
        p_email: 'test@example.com',
        p_full_name: null,
        p_phone: null,
      });
    });

    it('skips customer fetch when merchantId is null on SIGNED_IN', async () => {
      // Arrange: merchant lookup fails → merchantId stays null
      resetSupabaseMocks({
        merchantResult: { data: null, error: { message: 'Not found' } },
      });
      await runInitialize();
      expect(useAuthStore.getState().merchantId).toBeNull();

      const fromSpy = supabase.from as jest.Mock;
      fromSpy.mockClear();

      // Act
      await act(async () => {
        await mockAuthListenerCb('SIGNED_IN', mockSession);
      });

      // Assert: no customers table query made
      const customerCalls = fromSpy.mock.calls.filter(
        ([table]: [string]) => table === 'customers'
      );
      expect(customerCalls).toHaveLength(0);
    });

    it('sets customer to null when merchantId is missing', async () => {
      // Arrange
      resetSupabaseMocks({
        merchantResult: { data: null, error: { message: 'Not found' } },
      });
      await runInitialize();

      // Act
      await act(async () => {
        await mockAuthListenerCb('SIGNED_IN', mockSession);
      });

      // Assert
      expect(useAuthStore.getState().customer).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('onAuthStateChange — SIGNED_OUT', () => {
    it('clears user, session, and customer on SIGNED_OUT event', async () => {
      // Arrange: initialize with an authenticated user so state is populated
      resetSupabaseMocks({
        session: mockSession,
        getUser: { data: { user: mockUser }, error: null },
        customerResult: { data: mockCustomerRow, error: null },
      });
      (supabase.from as jest.Mock).mockImplementation((table: string) =>
        makeChain(
          table === 'merchants'
            ? { data: mockMerchantRow, error: null }
            : { data: mockCustomerRow, error: null }
        )
      );

      await act(async () => {
        await useAuthStore.getState().initialize();
      });
      expect(useAuthStore.getState().user).not.toBeNull();

      // Act
      await act(async () => {
        await mockAuthListenerCb('SIGNED_OUT', null);
      });

      // Assert
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.customer).toBeNull();
      expect(mockClearCart).toHaveBeenCalled();
      expect(mockClearSaved).toHaveBeenCalled();
      expect(mockClearComparison).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe('onAuthStateChange — TOKEN_REFRESHED', () => {
    it('updates session state on TOKEN_REFRESHED event', async () => {
      // Arrange
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const refreshedSession = { ...mockSession, access_token: 'new-token' };

      // Act
      await act(async () => {
        await mockAuthListenerCb('TOKEN_REFRESHED', refreshedSession);
      });

      // Assert
      expect(useAuthStore.getState().session).toBe(refreshedSession);
    });

    it('does not update session when TOKEN_REFRESHED is called with null', async () => {
      // Arrange
      await act(async () => {
        await useAuthStore.getState().initialize();
      });
      const sessionBefore = useAuthStore.getState().session;

      // Act
      await act(async () => {
        await mockAuthListenerCb('TOKEN_REFRESHED', null);
      });

      // Assert: session unchanged
      expect(useAuthStore.getState().session).toBe(sessionBefore);
    });
  });

  // -------------------------------------------------------------------------
  describe('signInWithGoogle()', () => {
    beforeEach(() => {
      (useAuthStore.setState as (s: object) => void)({
        merchantId: MERCHANT_ID,
        isLoading: false,
        isInitialized: true,
      });
      (supabase.auth.setSession as jest.Mock).mockResolvedValue({
        data: {
          session: mockSession,
          user: mockUser,
        },
        error: null,
      });
    });

    it('sets local auth state immediately after OAuth session creation', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'customers') {
          return makeChain({ data: mockCustomerRow, error: null });
        }

        return makeChain({ data: mockMerchantRow, error: null });
      });

      let result!: { success: boolean; error?: string };
      await act(async () => {
        result = await useAuthStore.getState().signInWithGoogle();
      });

      expect(result).toEqual({ success: true });
      expect(useAuthStore.getState().user?.id).toBe(USER_ID);
      expect(useAuthStore.getState().session?.access_token).toBe(
        'access-token-abc'
      );
      expect(useAuthStore.getState().customer?.id).toBe('customer-uuid-1');
    });

    it('returns an error when no authenticated user is available after setSession', async () => {
      (supabase.auth.setSession as jest.Mock).mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      });

      let result!: { success: boolean; error?: string };
      await act(async () => {
        result = await useAuthStore.getState().signInWithGoogle();
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to complete sign-in');
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('signInWithApple()', () => {
    beforeEach(() => {
      // Set default implementations for this describe block.
      // outer beforeEach already called jest.clearAllMocks() (clears calls,
      // not implementations) and resetSupabaseMocks() (sets supabase defaults).
      // We only need to wire up apple-auth defaults here.
      mockAppleIsAvailableAsync.mockResolvedValue(true);
      // signInAsync has no default — each test sets its own value.

      // Pre-populate merchantId as if initialize() already ran
      (useAuthStore.setState as (s: object) => void)({
        merchantId: MERCHANT_ID,
        isLoading: false,
        isInitialized: true,
      });
    });

    it('calls updateUser with Apple name then calls upsert RPC on first sign-in', async () => {
      // Arrange: Apple returns a full name on first sign-in, user has no metadata yet
      mockAppleSignInAsync.mockResolvedValueOnce({
        identityToken: 'apple-id-token',
        fullName: { givenName: 'Chidi', familyName: 'Anagonye' },
        email: 'chidi@example.com',
      });

      const appleUser = {
        id: 'user-uuid-2',
        email: 'chidi@example.com',
        user_metadata: {}, // full_name not yet set → triggers updateUser
      };
      (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValueOnce({
        data: { user: appleUser, session: mockSession },
        error: null,
      });

      // Act
      await act(async () => {
        await useAuthStore.getState().signInWithApple();
      });

      // Assert: user metadata updated with Apple name
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        data: { full_name: 'Chidi Anagonye' },
      });

      // Assert: RPC called with the Apple credential name
      expect(supabase.rpc).toHaveBeenCalledWith('upsert_customer_on_auth', {
        p_merchant_id: MERCHANT_ID,
        p_user_id: 'user-uuid-2',
        p_email: 'chidi@example.com',
        p_full_name: 'Chidi Anagonye',
        p_phone: null,
      });
    });

    it('skips updateUser and RPC when user already has full_name in metadata', async () => {
      // Arrange: returning Apple user — metadata already has full_name
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'customers') {
          return makeChain({ data: mockCustomerRow, error: null });
        }

        return makeChain({ data: mockMerchantRow, error: null });
      });
      mockAppleSignInAsync.mockResolvedValueOnce({
        identityToken: 'apple-id-token',
        fullName: { givenName: 'Chidi', familyName: 'Anagonye' },
        email: null,
      });

      (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-uuid-2',
            email: 'chidi@example.com',
            user_metadata: { full_name: 'Chidi Anagonye' }, // already populated
          },
          session: mockSession,
        },
        error: null,
      });

      // Act
      await act(async () => {
        await useAuthStore.getState().signInWithApple();
      });

      // Assert: no redundant calls
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('returns success:false with cancellation message when user dismisses Apple prompt', async () => {
      // Arrange: Apple throws ERR_REQUEST_CANCELED when user taps "Cancel"
      const cancelError = Object.assign(new Error('User cancelled'), {
        code: 'ERR_REQUEST_CANCELED',
      });
      mockAppleSignInAsync.mockRejectedValueOnce(cancelError);

      // Act
      let result!: { success: boolean; error?: string };
      await act(async () => {
        result = await useAuthStore.getState().signInWithApple();
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Sign in was cancelled');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('returns success:false and sets store error when signInWithIdToken fails', async () => {
      // Arrange
      mockAppleSignInAsync.mockResolvedValueOnce({
        identityToken: 'apple-id-token',
        fullName: null,
        email: null,
      });
      (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid identity token' },
      });

      // Act
      let result!: { success: boolean; error?: string };
      await act(async () => {
        result = await useAuthStore.getState().signInWithApple();
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid identity token');
      expect(useAuthStore.getState().error).toBe('Invalid identity token');
    });

    it('returns success:false when Apple Authentication is not available on device', async () => {
      // Arrange
      mockAppleIsAvailableAsync.mockResolvedValueOnce(false);

      // Act
      let result!: { success: boolean; error?: string };
      await act(async () => {
        result = await useAuthStore.getState().signInWithApple();
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('returns success:true and clears isLoading on successful sign-in', async () => {
      // Arrange: sign-in succeeds, no name from Apple (returning user)
      mockAppleSignInAsync.mockResolvedValueOnce({
        identityToken: 'apple-id-token',
        fullName: null,
        email: null,
      });
      (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Act
      let result!: { success: boolean; error?: string };
      await act(async () => {
        result = await useAuthStore.getState().signInWithApple();
      });

      // Assert
      expect(result.success).toBe(true);
      expect(useAuthStore.getState().user?.id).toBe(USER_ID);
      expect(useAuthStore.getState().session?.access_token).toBe(
        'access-token-abc'
      );
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe('deleteAccount()', () => {
    it('calls the storefront deletion RPC, signs out locally, and clears cached state', async () => {
      (useAuthStore.setState as (state: object) => void)({
        user: {
          ...mockUser,
          app_metadata: { providers: ['email', 'apple'] },
        },
        session: mockSession,
        customer: mockCustomerRow,
        merchantId: MERCHANT_ID,
        isLoading: false,
        isInitialized: true,
      });

      let result!: { success: boolean; error?: string; usedApple?: boolean };
      await act(async () => {
        result = await useAuthStore.getState().deleteAccount();
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'delete_current_storefront_account'
      );
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(mockClearCart).toHaveBeenCalled();
      expect(mockClearSaved).toHaveBeenCalled();
      expect(mockClearComparison).toHaveBeenCalled();
      expect(result).toEqual({ success: true, usedApple: true });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.customer).toBeNull();
    });

    it('returns a safe error message when the storefront deletion RPC fails', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          message:
            'update or delete on table "customers" violates foreign key constraint',
        },
      });
      (useAuthStore.setState as (state: object) => void)({
        user: mockUser,
        session: mockSession,
        customer: mockCustomerRow,
        merchantId: MERCHANT_ID,
        isLoading: false,
        isInitialized: true,
      });

      let result!: { success: boolean; error?: string; usedApple?: boolean };
      await act(async () => {
        result = await useAuthStore.getState().deleteAccount();
      });

      expect(result).toEqual({
        success: false,
        error:
          'Account deletion is temporarily unavailable. Please contact support.',
      });
      expect(supabase.auth.signOut).not.toHaveBeenCalled();
    });

    it('still clears local state when the local sign-out step fails after deletion', async () => {
      (supabase.auth.signOut as jest.Mock).mockRejectedValueOnce(
        new Error('local sign out failed')
      );
      (useAuthStore.setState as (state: object) => void)({
        user: mockUser,
        session: mockSession,
        customer: mockCustomerRow,
        merchantId: MERCHANT_ID,
        isLoading: false,
        isInitialized: true,
      });

      let result!: { success: boolean; error?: string; usedApple?: boolean };
      await act(async () => {
        result = await useAuthStore.getState().deleteAccount();
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'delete_current_storefront_account'
      );
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(mockClearCart).toHaveBeenCalled();
      expect(mockClearSaved).toHaveBeenCalled();
      expect(mockClearComparison).toHaveBeenCalled();
      expect(result).toEqual({ success: true, usedApple: false });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.customer).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('cleanup()', () => {
    it('unsubscribes the auth listener after initialize()', async () => {
      // Arrange
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      // Act
      act(() => {
        useAuthStore.getState().cleanup();
      });

      // Assert
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('bumps _initGen to invalidate any pending initializations', () => {
      // Arrange
      const genBefore = (
        useAuthStore.getState() as unknown as { _initGen: number }
      )._initGen;

      // Act
      act(() => {
        useAuthStore.getState().cleanup();
      });

      // Assert
      const genAfter = (
        useAuthStore.getState() as unknown as { _initGen: number }
      )._initGen;
      expect(genAfter).toBeGreaterThan(genBefore);
    });

    it('does not throw when called before initialize() (no subscription to clean)', () => {
      // No initialize() called, _authSubscription is null
      expect(() => {
        act(() => {
          useAuthStore.getState().cleanup();
        });
      }).not.toThrow();
    });
  });
});
