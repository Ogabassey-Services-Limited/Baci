/**
 * Auth Store Tests
 * Covers initialization deduplication, cleanup/teardown safety,
 * and auth listener subscription management.
 */

import { act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Test data with valid formats (schemas require uuid, email, etc.)
// ---------------------------------------------------------------------------

const MERCHANT_ID = '00000000-0000-4000-8000-000000000001';
const CUSTOMER_ID = '00000000-0000-4000-8000-000000000002';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const TEST_EMAIL = 'test@example.com';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the store
// ---------------------------------------------------------------------------

const mockUnsubscribe = jest.fn();
let onAuthStateChangeCb: ((event: string, session: unknown) => void) | null =
  null;

const mockFrom = jest.fn();

const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockOnAuthStateChange = jest.fn(
  (cb: (event: string, session: unknown) => void) => {
    onAuthStateChangeCb = cb;
    return {
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    };
  }
);

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    auth: {
      getSession: () => mockGetSession(),
      getUser: () => mockGetUser(),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) =>
        mockOnAuthStateChange(cb),
    },
  },
}));

jest.mock('../lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('../lib/auth-helpers', () => ({
  splitFullName: (name: unknown) => ({
    firstName: typeof name === 'string' ? name.split(' ')[0] || '' : '',
    lastName:
      typeof name === 'string' ? name.split(' ').slice(1).join(' ') || '' : '',
  }),
}));

jest.mock('./cart-store', () => ({
  useCartStore: { getState: () => ({ items: [], clearCart: jest.fn() }) },
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { merchantSlug: 'test-merchant' } },
}));

// ---------------------------------------------------------------------------
// Import store AFTER mocks
// ---------------------------------------------------------------------------

import { useAuthStore } from './auth-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type StoreState = ReturnType<typeof useAuthStore.getState>;

/** Reset the zustand store and all mocks between tests */
function resetAll() {
  // Reset internal zustand state including private fields
  useAuthStore.setState({
    user: null,
    session: null,
    customer: null,
    merchantId: null,
    isLoading: true,
    isInitialized: false,
    error: null,
    _initGen: 0,
    _authSubscription: null,
    _initializationInProgress: false,
  } as Partial<StoreState>);

  onAuthStateChangeCb = null;
  jest.clearAllMocks();
}

/** Build a mock supabase.from() that handles merchants and customers tables */
function mockFromFactory() {
  const customerRow = {
    id: CUSTOMER_ID,
    email: TEST_EMAIL,
    first_name: 'Test',
    last_name: 'User',
    phone: null,
    loyalty_points: 0,
  };

  return (table: string) => {
    if (table === 'merchants') {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({ data: { id: MERCHANT_ID }, error: null }),
          }),
        }),
      };
    }
    // customers table — supports select, insert, and update chains
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: customerRow, error: null }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: customerRow, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: customerRow, error: null }),
            }),
          }),
        }),
      }),
    };
  };
}

/** Configure mocks so that initialize() runs to completion (happy path) */
function setupHappyPath() {
  mockFrom.mockImplementation(mockFromFactory());

  mockGetSession.mockResolvedValue({
    data: {
      session: {
        user: {
          id: USER_ID,
          email: TEST_EMAIL,
          user_metadata: { full_name: 'Test User' },
        },
      },
    },
    error: null,
  });

  mockGetUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAuthStore', () => {
  beforeEach(() => {
    resetAll();
  });

  // -----------------------------------------------------------------------
  // 1. Concurrent initialize() calls are deduplicated
  // -----------------------------------------------------------------------
  describe('concurrent initialize calls', () => {
    it('deduplicates when first call is in progress', async () => {
      setupHappyPath();

      // Start first init (do NOT await yet)
      const p1 = useAuthStore.getState().initialize();
      // Start second init immediately — should be a no-op
      const p2 = useAuthStore.getState().initialize();

      await act(async () => {
        await p1;
        await p2;
      });

      // onAuthStateChange should only be called once (from the first init)
      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    });

    it('second call is a no-op and does not reset isInitialized', async () => {
      setupHappyPath();

      await act(async () => {
        await useAuthStore.getState().initialize();
      });
      expect(useAuthStore.getState().isInitialized).toBe(true);

      // Second call should be skipped
      await act(async () => {
        await useAuthStore.getState().initialize();
      });
      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // 2. cleanup() before initialize() completes
  // -----------------------------------------------------------------------
  describe('cleanup before initialize completes', () => {
    it('leaves no orphan subscription and allows re-initialization', async () => {
      // Mock Date.now to ensure distinct values for generation tracking.
      // The store uses Date.now() as the generation counter; without this,
      // initialize() and cleanup() could get the same timestamp in the
      // same event-loop tick, defeating the stale-init detection.
      let now = 1000;
      const realDateNow = Date.now;
      Date.now = () => ++now;

      try {
        // Make getSession block so we can call cleanup mid-flight
        let resolveSession: (v: unknown) => void = () => {};
        const sessionPromise = new Promise((res) => {
          resolveSession = res;
        });

        mockFrom.mockImplementation(mockFromFactory());
        mockGetSession.mockImplementation(() => sessionPromise);
        mockGetUser.mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        });

        // Start init — it will block at getSession
        const initPromise = useAuthStore.getState().initialize();

        // Call cleanup while init is awaiting getSession
        act(() => {
          useAuthStore.getState().cleanup();
        });

        // Unblock getSession
        resolveSession({
          data: { session: null },
          error: null,
        });

        await act(async () => {
          await initPromise;
        });

        // Because cleanup changed _initGen, the stale init should have
        // bailed out before reaching onAuthStateChange.
        expect(mockOnAuthStateChange).not.toHaveBeenCalled();

        // Re-initialization should work after cleanup
        setupHappyPath();
        useAuthStore.setState({
          _initializationInProgress: false,
          isInitialized: false,
        } as Partial<StoreState>);

        await act(async () => {
          await useAuthStore.getState().initialize();
        });
        expect(useAuthStore.getState().isInitialized).toBe(true);
        expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
      } finally {
        Date.now = realDateNow;
      }
    });
  });

  // -----------------------------------------------------------------------
  // 3. cleanup() after initialize() completes unsubscribes listener
  // -----------------------------------------------------------------------
  describe('cleanup after initialize completes', () => {
    it('unsubscribes the auth listener', async () => {
      setupHappyPath();

      await act(async () => {
        await useAuthStore.getState().initialize();
      });
      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);

      // Cleanup should call unsubscribe
      act(() => {
        useAuthStore.getState().cleanup();
      });

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('allows re-initialization after cleanup', async () => {
      setupHappyPath();

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      act(() => {
        useAuthStore.getState().cleanup();
      });

      // Reset isInitialized so re-init is not skipped
      useAuthStore.setState({
        isInitialized: false,
      } as Partial<StoreState>);

      // Re-initialize
      await act(async () => {
        await useAuthStore.getState().initialize();
      });
      expect(useAuthStore.getState().isInitialized).toBe(true);
      // onAuthStateChange called twice: once per init
      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(2);
    });
  });
});
