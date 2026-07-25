import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Session, User } from '@supabase/supabase-js';
import type { AuthState, AuthStoreGet, AuthStoreSet } from './auth-store.types';
import type { StorefrontOtpApi } from './auth-store-credentials';

const mockSendStorefrontOtp = jest.fn<StorefrontOtpApi['sendStorefrontOtp']>();
const mockVerifyStorefrontOtp =
  jest.fn<StorefrontOtpApi['verifyStorefrontOtp']>();
const mockSetSession = jest.fn<StorefrontOtpApi['setSession']>();
const mockSyncAuthenticatedState =
  jest.fn<StorefrontOtpApi['syncAuthenticatedState']>();

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      setSession: mockSetSession,
    },
  },
}));

jest.mock('./auth-store-sync', () => ({
  syncAuthenticatedState: mockSyncAuthenticatedState,
}));

import { createCredentialActions } from './auth-store-credentials';

describe('createCredentialActions', () => {
  const set = jest.fn() as jest.MockedFunction<AuthStoreSet>;
  const authState: AuthState = {
    _authSubscription: null,
    _initGen: 0,
    _initializationInProgress: false,
    cleanup: jest.fn<() => void>(),
    clearError: jest.fn<() => void>(),
    customer: null,
    deleteAccount: jest.fn<AuthState['deleteAccount']>(),
    error: null,
    initialize: jest.fn<AuthState['initialize']>(),
    isInitialized: false,
    isLoading: false,
    merchantId: 'merchant-1',
    refreshSession: jest.fn<AuthState['refreshSession']>(),
    session: null,
    signInWithApple: jest.fn<AuthState['signInWithApple']>(),
    signInWithGoogle: jest.fn<AuthState['signInWithGoogle']>(),
    signInWithOtp: jest.fn<AuthState['signInWithOtp']>(),
    signInWithPassword: jest.fn<AuthState['signInWithPassword']>(),
    signOut: jest.fn<AuthState['signOut']>(),
    updateProfile: jest.fn<AuthState['updateProfile']>(),
    setUsername: jest.fn<AuthState['setUsername']>(),
    setDateOfBirth: jest.fn<AuthState['setDateOfBirth']>(),
    user: null,
    verifyOtp: jest.fn<AuthState['verifyOtp']>(),
  };
  const get = jest.fn<AuthStoreGet>(() => authState);
  const storefrontOtpApi: StorefrontOtpApi = {
    sendStorefrontOtp: mockSendStorefrontOtp,
    setSession: mockSetSession,
    syncAuthenticatedState: mockSyncAuthenticatedState,
    verifyStorefrontOtp: mockVerifyStorefrontOtp,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendStorefrontOtp.mockResolvedValue({ data: undefined, success: true });
    mockVerifyStorefrontOtp.mockResolvedValue({
      success: true,
      data: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      },
    });
    mockSetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token',
          user: { id: 'user-1', email: 'customer@example.com' },
        } as Session,
        user: { id: 'user-1', email: 'customer@example.com' } as User,
      },
      error: null,
    });
    mockSyncAuthenticatedState.mockResolvedValue(undefined);
  });

  it('sends OTP email through the shared storefront auth endpoint', async () => {
    const actions = createCredentialActions(set, get, storefrontOtpApi);

    const result = await actions.signInWithOtp('customer@example.com');

    expect(result).toEqual({ success: true });
    expect(mockSendStorefrontOtp).toHaveBeenCalledWith('customer@example.com');
  });

  it('returns an error result when the shared endpoint cannot send the OTP', async () => {
    mockSendStorefrontOtp.mockResolvedValueOnce({
      success: false,
      error: 'Email rate limit exceeded',
    });
    const actions = createCredentialActions(set, get, storefrontOtpApi);

    const result = await actions.signInWithOtp('customer@example.com');

    expect(result).toEqual({
      success: false,
      error: 'Email rate limit exceeded',
    });
    expect(set).toHaveBeenLastCalledWith({
      error: 'Email rate limit exceeded',
      isLoading: false,
    });
  });

  it('verifies OTP through the shared endpoint and stores the returned native session', async () => {
    const actions = createCredentialActions(set, get, storefrontOtpApi);

    const result = await actions.verifyOtp('customer@example.com', '123456');

    expect(result).toEqual({ success: true });
    expect(mockVerifyStorefrontOtp).toHaveBeenCalledWith(
      'customer@example.com',
      '123456'
    );
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(mockSyncAuthenticatedState).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      session: {
        access_token: 'access-token',
        user: { id: 'user-1', email: 'customer@example.com' },
      },
      set,
      user: { id: 'user-1', email: 'customer@example.com' },
    });
  });

  it('returns an error without setting a session when shared OTP verification fails', async () => {
    mockVerifyStorefrontOtp.mockResolvedValueOnce({
      success: false,
      error: 'Invalid verification code',
    });
    const actions = createCredentialActions(set, get, storefrontOtpApi);

    const result = await actions.verifyOtp('customer@example.com', '123456');

    expect(result).toEqual({
      success: false,
      error: 'Invalid verification code',
    });
    expect(set).toHaveBeenLastCalledWith({
      error: 'Invalid verification code',
      isLoading: false,
    });
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('returns an error when the native session cannot be established', async () => {
    mockSetSession.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: 'Invalid refresh token' },
    } as Awaited<ReturnType<StorefrontOtpApi['setSession']>>);
    const actions = createCredentialActions(set, get, storefrontOtpApi);

    const result = await actions.verifyOtp('customer@example.com', '123456');

    expect(result).toEqual({
      success: false,
      error: 'Invalid refresh token',
    });
    expect(set).toHaveBeenLastCalledWith({
      error: 'Invalid refresh token',
      isLoading: false,
    });
  });
});
