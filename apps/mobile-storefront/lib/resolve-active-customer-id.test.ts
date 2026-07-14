import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type AuthSnapshot = {
  customer: { id: string; user_id?: string | null } | null;
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
      customer: { id: 'customer-1', user_id: 'user-1' },
      isInitialized: true,
      user: { id: 'user-1' },
    };

    await expect(resolveActiveCustomerId()).resolves.toBe('customer-1');
  });

  it('returns undefined immediately when initialised with nobody signed in', async () => {
    mockAuth.state = { customer: null, isInitialized: true, user: null };

    await expect(resolveActiveCustomerId()).resolves.toBeUndefined();
  });

  it('accepts an unlinked customer when no auth user exists', async () => {
    mockAuth.state = {
      customer: { id: 'guest-customer', user_id: null },
      isInitialized: true,
      user: null,
    };

    await expect(resolveActiveCustomerId()).resolves.toBe('guest-customer');
  });

  it('fails closed when a signed-out customer omits its ownership field', async () => {
    mockAuth.state = {
      customer: { id: 'unknown-owner' },
      isInitialized: true,
      user: null,
    };

    const pending = resolveActiveCustomerId();
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    emit({ customer: null, isInitialized: true, user: null });
    await expect(pending).resolves.toBeUndefined();
  });

  it('waits for hydration on a cold start from a notification tap', async () => {
    const pending = resolveActiveCustomerId();

    emit({
      customer: { id: 'customer-2', user_id: 'user-2' },
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
      customer: { id: 'customer-3', user_id: 'user-3' },
      isInitialized: true,
      user: { id: 'user-3' },
    });
    emit({
      customer: { id: 'customer-4', user_id: 'user-4' },
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
      customer: { id: 'customer-5', user_id: 'user-5' },
      isInitialized: true,
      user: { id: 'user-5' },
    });

    await expect(pending).resolves.toBe('customer-5');
  });

  it('waits through an account switch until the customer matches the new user', async () => {
    mockAuth.state = {
      customer: { id: 'customer-a', user_id: 'user-a' },
      isInitialized: true,
      user: { id: 'user-b' },
    };

    const pending = resolveActiveCustomerId();
    emit({
      customer: { id: 'customer-b', user_id: 'user-b' },
      isInitialized: true,
      user: { id: 'user-b' },
    });

    await expect(pending).resolves.toBe('customer-b');
  });

  it('waits for a linked customer to clear after sign-out', async () => {
    mockAuth.state = {
      customer: { id: 'customer-a', user_id: 'user-a' },
      isInitialized: true,
      user: null,
    };

    const pending = resolveActiveCustomerId();
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    emit({ customer: null, isInitialized: true, user: null });
    await expect(pending).resolves.toBeUndefined();
  });
});
