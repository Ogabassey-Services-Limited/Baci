import Constants from 'expo-constants';

const mockState = {
  createClient: jest.fn(),
  expoExtra: {} as {
    supabaseAnonKey?: string;
    supabaseUrl?: string;
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
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({
      isConnected: true,
      isInternetReachable: true,
    })),
  },
}));

jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('storefront supabase client config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockState.expoExtra = {
      supabaseAnonKey: 'expo-anon-key',
      supabaseUrl: 'https://expo-project.supabase.co',
    };
    mockState.createClient.mockReturnValue({ auth: {} });
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('falls back to expo extra config when EXPO_PUBLIC env vars are empty', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';

    await import('./supabase');

    expect(mockState.createClient).toHaveBeenCalledWith(
      'https://expo-project.supabase.co',
      'expo-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'implicit',
          persistSession: true,
        }),
      })
    );
  });

  it('prefers EXPO_PUBLIC env vars over expo extra config', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://env-project.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'env-anon-key';

    await import('./supabase');

    expect(mockState.createClient).toHaveBeenCalledWith(
      'https://env-project.supabase.co',
      'env-anon-key',
      expect.any(Object)
    );
  });

  it('warns and skips createClient when credentials are missing', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';
    mockState.expoExtra = {};
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await import('./supabase');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Supabase] SUPABASE_URL is not configured. Set EXPO_PUBLIC_SUPABASE_URL or configure extra.supabaseUrl in app.json.'
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[Supabase] SUPABASE_ANON_KEY is not configured. Set EXPO_PUBLIC_SUPABASE_ANON_KEY or configure extra.supabaseAnonKey in app.json.'
    );
    expect(mockState.createClient).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});
