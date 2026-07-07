const mockState = {
  authSessionStorage: {
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
  },
  createClient: jest.fn(),
  expoExtra: {} as {
    supabaseAnonKey?: string;
    supabasePublishableKey?: string;
    supabaseUrl?: string;
  },
  platformOS: 'web',
  processLock: jest.fn(),
  registerAuthRefreshLifecycle: jest.fn(),
  webSessionStorage: {
    getItem: jest.fn(),
    removeItem: jest.fn(),
    setItem: jest.fn(),
  },
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      get extra() {
        return mockState.expoExtra;
      },
    },
  },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockState.createClient,
  processLock: mockState.processLock,
}));

jest.mock(
  'react-native',
  () => ({
    Platform: {
      get OS() {
        return mockState.platformOS;
      },
    },
  }),
  { virtual: true }
);

jest.mock('./auth/auth-refresh-lifecycle', () => ({
  registerAuthRefreshLifecycle: mockState.registerAuthRefreshLifecycle,
}));

jest.mock('./auth/auth-session-storage', () => ({
  authSessionStorage: mockState.authSessionStorage,
  getDefaultSupabaseAuthStorageKey: (supabaseUrl: string) => {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    return `sb-${projectRef}-auth-token`;
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
  },
}));

jest.mock('expo-secure-store', () => ({
  __esModule: true,
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('./logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('@/services/analytics', () => ({
  trackError: jest.fn(),
  trackEvent: jest.fn(),
}));

describe('storefront supabase web auth config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockState.expoExtra = {
      supabasePublishableKey: 'expo-publishable-key',
      supabaseUrl: 'https://expo-project.supabase.co',
    };
    mockState.platformOS = 'web';
    mockState.createClient.mockReturnValue({
      auth: {
        startAutoRefresh: jest.fn(),
        stopAutoRefresh: jest.fn(),
      },
      functions: {
        invoke: jest.fn(),
      },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        sessionStorage: mockState.webSessionStorage,
      },
    });
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete (globalThis as { window?: unknown }).window;
  });

  it('uses sessionStorage when the Expo storefront runs on web', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://env-project.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'env-publishable-key';

    await import('./supabase');

    const createClientOptions = mockState.createClient.mock.calls[0]?.[2];
    expect(createClientOptions.auth).toMatchObject({
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      persistSession: true,
      storage: mockState.webSessionStorage,
      storageKey: 'sb-env-project-auth-token',
    });
    expect(createClientOptions.auth).not.toHaveProperty('lock');
    expect(mockState.registerAuthRefreshLifecycle).not.toHaveBeenCalled();
  });

  it('uses non-persistent memory storage when browser sessionStorage is unavailable', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://env-project.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'env-publishable-key';
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        get sessionStorage() {
          throw new Error('sessionStorage unavailable');
        },
      },
    });

    await import('./supabase');

    const createClientOptions = mockState.createClient.mock.calls[0]?.[2];
    const authStorage = createClientOptions.auth.storage as {
      getItem(key: string): string | null;
      removeItem(key: string): void;
      setItem(key: string, value: string): void;
    };
    expect(authStorage).not.toBe(mockState.webSessionStorage);
    authStorage.setItem('auth-token', 'session-value');
    expect(authStorage.getItem('auth-token')).toBe('session-value');
    authStorage.removeItem('auth-token');
    expect(authStorage.getItem('auth-token')).toBeNull();
    expect(createClientOptions.auth).not.toHaveProperty('lock');
    expect(mockState.registerAuthRefreshLifecycle).not.toHaveBeenCalled();
  });

  it('disables persisted auth storage during server rendering', async () => {
    delete (globalThis as { window?: unknown }).window;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://env-project.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'env-publishable-key';

    await import('./supabase');

    expect(mockState.createClient).toHaveBeenCalledWith(
      'https://env-project.supabase.co',
      'env-publishable-key',
      expect.objectContaining({
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      })
    );
    expect(mockState.registerAuthRefreshLifecycle).not.toHaveBeenCalled();
  });
});
