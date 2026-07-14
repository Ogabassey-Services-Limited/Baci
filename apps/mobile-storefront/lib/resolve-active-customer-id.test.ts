import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type AuthSnapshot = {
  customer: { id: string } | null;
  isInitialized: boolean;
  user: { id: string } | null;
};

type Listener = (state: AuthSnapshot) => void;

// `mock`-prefixed so the jest.mock factory may reference them (hoisting rule).
const mockAuth: { state: AuthSnapshot } = {
  state: { customer: null, isInitialized: false, user: null },
};
const mockListeners = new Set<Listener>();

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => mockAuth.state,
    subscribe: (listener: Listener) => {
      mockListeners.add(listener);
      return () => {
        mockListeners.delete(listener);
      };
    },
  },
}));

const { resolveActiveCustomerId } =
  require('./resolve-active-customer-id') as typeof import('./resolve-active-customer-id');

function emit(next: AuthSnapshot) {
  mockAuth.state = next;
  for (const listener of [...mockListeners]) {
    listener(next);
  }
}

describe('resolveActiveCustomerId', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockListeners.clear();
    mockAuth.state = { customer: null, isInitialized: false, user: null };
  });

  it('returns the customer id immediately when auth is already initialised', async () => {
    mockAuth.state = {
      customer: { id: 'customer-1' },
      isInitialized: true,
      user: { id: 'user-1' },
    };

    await expect(resolveActiveCustomerId()).resolves.toBe('customer-1');
  });

  it('returns undefined immediately when initialised with nobody signed in', async () => {
    mockAuth.state = { customer: null, isInitialized: true, user: null };

    await expect(resolveActiveCustomerId()).resolves.toBeUndefined();
  });

  it('waits for hydration on a cold start from a notification tap', async () => {
    const pending = resolveActiveCustomerId();

    emit({
      customer: { id: 'customer-2' },
      isInitialized: true,
      user: { id: 'user-2' },
    });

    await expect(pending).resolves.toBe('customer-2');
    expect(mockListeners.size).toBe(0);
  });

  it('resolves undefined when hydration never settles', async () => {
    jest.useFakeTimers();

    const pending = resolveActiveCustomerId();
    jest.advanceTimersByTime(10_000);

    await expect(pending).resolves.toBeUndefined();
    expect(mockListeners.size).toBe(0);
  });

  it('resolves only once even if auth emits repeatedly', async () => {
    const pending = resolveActiveCustomerId();

    emit({
      customer: { id: 'customer-3' },
      isInitialized: true,
      user: { id: 'user-3' },
    });
    emit({
      customer: { id: 'customer-4' },
      isInitialized: true,
      user: { id: 'user-4' },
    });

    await expect(pending).resolves.toBe('customer-3');
  });

  it('waits when the session is initialized before its customer hydrates', async () => {
    mockAuth.state = {
      customer: null,
      isInitialized: true,
      user: { id: 'user-5' },
    };

    const pending = resolveActiveCustomerId();

    emit({
      customer: { id: 'customer-5' },
      isInitialized: true,
      user: { id: 'user-5' },
    });

    await expect(pending).resolves.toBe('customer-5');
  });
});
