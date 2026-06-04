import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  configure: vi.fn(),
  expoExtra: {
    googleIosClientId: 'ios-client-id',
    googleWebClientId: 'web-client-id',
  } as {
    googleIosClientId?: string;
    googleWebClientId?: string;
  },
  getTokens: vi.fn(),
  hasPlayServices: vi.fn(),
  platformOS: 'ios' as 'android' | 'ios' | 'web',
  signIn: vi.fn(),
  signInWithIdToken: vi.fn(),
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      get extra() {
        return testState.expoExtra;
      },
    },
  },
}));

vi.mock('react-native', () => ({
    StatusBar: () => null,
  Platform: {
    get OS() {
      return testState.platformOS;
    },
  },
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: testState.configure,
    getTokens: testState.getTokens,
    hasPlayServices: testState.hasPlayServices,
    signIn: testState.signIn,
  },
  isSuccessResponse: (response: unknown) =>
    typeof response === 'object' && response !== null && 'data' in response,
  statusCodes: {
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithIdToken: testState.signInWithIdToken,
    },
  },
}));

describe('signInWithGoogleNative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    testState.platformOS = 'ios';
    testState.expoExtra = {
      googleIosClientId: 'ios-client-id',
      googleWebClientId: 'web-client-id',
    };
    testState.hasPlayServices.mockResolvedValue(true);
    testState.signIn.mockResolvedValue({
      data: { idToken: 'google-id-token' },
    });
    testState.getTokens.mockResolvedValue({
      accessToken: 'google-access-token',
      idToken: 'google-id-token',
    });
    testState.signInWithIdToken.mockResolvedValue({
      data: {
        session: { access_token: 'session-token' },
        user: { id: 'user-1' },
      },
      error: null,
    });
  });

  it('returns a clear config error before GoogleSignin.configure() when client IDs are missing', async () => {
    testState.expoExtra = {};

    const { signInWithGoogleNative } = await import('./sign-in-with-google');
    const result = await signInWithGoogleNative();

    expect(result).toMatchObject({
      code: 'google_missing_client_id',
      error:
        'googleConfig.iosClientId and googleConfig.webClientId must be set before GoogleSignin.configure() can start Google Sign-in for this build.',
      session: null,
      user: null,
    });
    expect(testState.configure).not.toHaveBeenCalled();
    expect(testState.signIn).not.toHaveBeenCalled();
  });

  it('stops before signIn when Google Play Services is unavailable', async () => {
    testState.platformOS = 'android';
    testState.hasPlayServices.mockResolvedValue(false);

    const { signInWithGoogleNative } = await import('./sign-in-with-google');
    const result = await signInWithGoogleNative();

    expect(testState.configure).toHaveBeenCalledTimes(1);
    expect(testState.hasPlayServices).toHaveBeenCalledTimes(1);
    expect(testState.signIn).not.toHaveBeenCalled();
    expect(result).toEqual({
      code: 'google_play_services_unavailable',
      error: 'Google Play Services is not available on this device.',
      session: null,
      user: null,
    });
  });
});
