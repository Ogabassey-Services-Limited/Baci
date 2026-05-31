import type { User } from '@supabase/supabase-js';
import { act, renderHook } from '@testing-library/react-native';

const mockRouterReplace = jest.fn();
const mockUsePathname = jest.fn(() => '/account');
const mockUseRootNavigationState = jest.fn(() => ({ key: 'root-key' }));
const mockUseSegments = jest.fn(() => [] as string[]);

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
  usePathname: () => mockUsePathname(),
  useRootNavigationState: () => mockUseRootNavigationState(),
  useSegments: () => mockUseSegments(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  })),
}));

jest.mock('@/stores/auth-store', () => {
  const { create } = require('zustand');

  return {
    useAuthStore: create(() => ({
      customer: null,
      isInitialized: false,
      isLoading: true,
      merchantId: null,
      session: null,
      user: null,
    })),
  };
});

import { useAuthGuard, useAuthStatus, useRequireAuth } from './use-auth-guard';
import { useAuthStore } from '@/stores/auth-store';

function makeUser(id: string): User {
  return {
    id,
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-03-07T00:00:00.000Z',
    email: `${id}@example.com`,
    role: 'authenticated',
    updated_at: '2026-03-07T00:00:00.000Z',
    user_metadata: {},
  } as User;
}

function resetAuthStore() {
  act(() => {
    useAuthStore.setState({
      customer: null,
      error: null,
      isInitialized: false,
      isLoading: true,
      merchantId: null,
      session: null,
      user: null,
    });
  });
}

describe('use-auth-guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthStore();
    mockUsePathname.mockReturnValue('/account');
    mockUseRootNavigationState.mockReturnValue({ key: 'root-key' });
    mockUseSegments.mockReturnValue([]);
  });

  it('rerenders only for user and isInitialized changes in useAuthGuard', () => {
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount += 1;
      return useAuthGuard();
    });

    expect(renderCount).toBe(1);
    expect(result.current).toEqual({
      isAuthenticated: false,
      isInitialized: false,
    });

    act(() => {
      useAuthStore.setState({
        customer: { id: 'customer-1', email: 'customer@example.com' },
      });
    });

    expect(renderCount).toBe(1);

    act(() => {
      useAuthStore.setState({ isInitialized: true, isLoading: false });
    });

    expect(renderCount).toBe(2);
    expect(result.current.isInitialized).toBe(true);

    act(() => {
      useAuthStore.setState({ user: makeUser('user-1') });
    });

    expect(renderCount).toBe(3);
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      useAuthStore.setState({ error: 'network-error' });
    });

    expect(renderCount).toBe(3);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('builds a login redirect only after auth initialization in useRequireAuth', () => {
    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.redirectTo).toBeNull();

    act(() => {
      useAuthStore.setState({ isInitialized: true, isLoading: false });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.redirectTo).toBe('/auth/login?returnTo=%2Faccount');

    act(() => {
      useAuthStore.setState({ user: makeUser('user-2') });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.redirectTo).toBeNull();
  });

  it('ignores unrelated session changes in useAuthStatus', () => {
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount += 1;
      return useAuthStatus();
    });

    expect(renderCount).toBe(1);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.customer).toBeNull();

    act(() => {
      useAuthStore.setState({
        customer: { id: 'customer-2', email: 'two@example.com' },
        isInitialized: true,
        isLoading: false,
      });
    });

    expect(renderCount).toBe(2);
    expect(result.current.customer?.id).toBe('customer-2');
    expect(result.current.isInitialized).toBe(true);

    act(() => {
      useAuthStore.setState({
        session: { access_token: 'next-token' } as never,
      });
    });

    expect(renderCount).toBe(2);
  });
});
