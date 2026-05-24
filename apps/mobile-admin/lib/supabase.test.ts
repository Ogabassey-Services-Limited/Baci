import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  createClient: vi.fn(),
  expoExtra: {} as {
    supabaseAnonKey?: string;
    supabaseUrl?: string;
  },
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

vi.mock('@supabase/supabase-js', () => ({
  createClient: testState.createClient,
}));

vi.mock('./storage', () => ({
  storage: {
    getString: vi.fn(),
    remove: vi.fn(),
    set: vi.fn(),
  },
}));

describe('supabase client config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    testState.expoExtra = {
      supabaseAnonKey: 'expo-anon-key',
      supabaseUrl: 'https://expo-project.supabase.co',
    };
    testState.createClient.mockReturnValue({ auth: {} });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('falls back to expo extra config when EXPO_PUBLIC env vars are empty', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');

    await import('./supabase');

    expect(testState.createClient).toHaveBeenCalledWith(
      'https://expo-project.supabase.co',
      'expo-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: true,
          detectSessionInUrl: false,
          persistSession: true,
        }),
      })
    );
  });

  it('prefers EXPO_PUBLIC env vars over expo extra config', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://env-project.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'env-anon-key');

    await import('./supabase');

    expect(testState.createClient).toHaveBeenCalledWith(
      'https://env-project.supabase.co',
      'env-anon-key',
      expect.any(Object)
    );
  });

  it('disables persisted auth storage during server rendering', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://env-project.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'env-anon-key');
    vi.stubGlobal('window', undefined);

    await import('./supabase');

    expect(testState.createClient).toHaveBeenCalledWith(
      'https://env-project.supabase.co',
      'env-anon-key',
      expect.objectContaining({
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      })
    );

    vi.unstubAllGlobals();
  });

  it('logs a critical error and skips createClient when credentials are missing', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
    testState.expoExtra = {};
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await import('./supabase');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Supabase] CRITICAL: Supabase URL or Anon Key is missing from environment variables.'
    );
    expect(testState.createClient).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
