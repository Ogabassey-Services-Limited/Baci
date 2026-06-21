// biome-ignore-all lint/correctness/noUndeclaredVariables: Jest globals are provided by jest-expo in this store test.

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
    },
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

import { AuthApiError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AuthStoreSet } from './auth-store.types';
import { createCredentialActions } from './auth-store-credentials';

const OTP_EMAIL_REDIRECT_URL = 'https://ogabassey.usebaci.com/account/verify';
const mockSignInWithOtp = supabase.auth.signInWithOtp as jest.MockedFunction<
  typeof supabase.auth.signInWithOtp
>;

describe('createCredentialActions', () => {
  const set = jest.fn() as jest.MockedFunction<AuthStoreSet>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
  });

  it('passes the merchant storefront redirect when sending OTP email', async () => {
    const actions = createCredentialActions(set);

    const result = await actions.signInWithOtp('customer@example.com');

    expect(result).toEqual({ success: true });
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'customer@example.com',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: OTP_EMAIL_REDIRECT_URL,
        data: { role: 'customer' },
      },
    });
  });

  it('returns an error result when Supabase cannot send the OTP', async () => {
    mockSignInWithOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError(
        'Email rate limit exceeded',
        429,
        'over_email_send_rate_limit'
      ),
    });
    const actions = createCredentialActions(set);

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
});
