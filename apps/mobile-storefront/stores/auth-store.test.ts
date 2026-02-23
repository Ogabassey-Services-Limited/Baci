import type { User } from '@supabase/supabase-js';

const mockRpc = jest.fn();
const mockSignOut = jest.fn();
const mockClearCart = jest.fn();

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      merchantSlug: 'ogabassey',
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

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

jest.mock('./cart-store', () => ({
  useCartStore: {
    getState: () => ({
      items: [],
      clearCart: mockClearCart,
    }),
  },
}));

jest.mock('../lib/validation', () => ({
  CustomerRowSchema: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
  MerchantRowSchema: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
}));

import { useAuthStore } from './auth-store';

const baseUser = {
  id: 'user-1',
  email: 'user@example.com',
  aud: 'authenticated',
  created_at: '2026-02-22T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
} as unknown as User;

describe('AuthStore deleteAccount', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockSignOut.mockReset();
    mockClearCart.mockReset();

    useAuthStore.setState({
      user: baseUser,
      session: null,
      customer: {
        id: 'customer-1',
        email: 'user@example.com',
      },
      merchantId: 'merchant-1',
      isLoading: false,
      isInitialized: true,
      error: null,
    });
  });

  it('deletes account successfully and clears local auth/cart state', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const result = await useAuthStore.getState().deleteAccount();

    expect(mockRpc).toHaveBeenCalledWith('delete_current_storefront_account');
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockClearCart).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, usedApple: false });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.customer).toBeNull();
  });

  it('returns error when RPC fails and keeps user state intact', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'rpc failed' } });

    const result = await useAuthStore.getState().deleteAccount();

    expect(result).toEqual({
      success: false,
      error: 'Unable to delete your account right now. Please try again.',
      usedApple: false,
    });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(baseUser);
    expect(state.customer?.email).toBe('user@example.com');
    expect(mockClearCart).not.toHaveBeenCalled();
  });

  it('returns usedApple true for Apple provider users', async () => {
    const appleUser = {
      ...baseUser,
      app_metadata: { provider: 'apple', providers: ['apple'] },
    } as unknown as User;

    useAuthStore.setState({ user: appleUser });

    mockRpc.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const result = await useAuthStore.getState().deleteAccount();

    expect(result).toEqual({ success: true, usedApple: true });
  });

  it('still succeeds when signOut rejects after deletion', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockSignOut.mockRejectedValue(new Error('signOut failed'));

    const result = await useAuthStore.getState().deleteAccount();

    expect(result).toEqual({ success: true, usedApple: false });
    expect(mockClearCart).toHaveBeenCalledTimes(1);

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
  });

  it('returns auth-required failure when no signed-in user exists', async () => {
    useAuthStore.setState({
      user: null,
      session: null,
      customer: null,
      error: null,
    });

    const result = await useAuthStore.getState().deleteAccount();

    expect(result).toEqual({
      success: false,
      error: 'You must be signed in to delete your account.',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
