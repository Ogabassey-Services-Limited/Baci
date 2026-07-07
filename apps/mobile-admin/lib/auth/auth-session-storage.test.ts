import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authSessionStorage,
  getActiveAuthStorageKey,
  getDefaultSupabaseAuthStorageKey,
  getMigratedSupabaseAuthStorageKey,
  removeAuthStorageKeys,
} from './auth-session-storage';

const storageMocks = vi.hoisted(() => ({
  getString: vi.fn(),
  remove: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  storage: storageMocks,
}));

describe('auth session storage keys', () => {
  it.each([
    ['https://abc123.supabase.co', 'sb-abc123-auth-token'],
    ['https://abc123.supabase.co/', 'sb-abc123-auth-token'],
  ])('derives the Supabase default auth key from %s', (url, expected) => {
    expect(getDefaultSupabaseAuthStorageKey(url)).toBe(expected);
  });

  it('throws a controlled error for invalid Supabase URLs', () => {
    expect(() => getDefaultSupabaseAuthStorageKey('not-a-url')).toThrow(
      '[Supabase] Invalid Supabase URL; cannot derive default auth storage key.'
    );
  });

  it('returns the default key until migrated storage is enabled', () => {
    expect(
      getActiveAuthStorageKey({
        supabaseUrl: 'https://abc123.supabase.co',
        useMigratedStorageKey: false,
      })
    ).toBe('sb-abc123-auth-token');
  });

  it('returns the migrated key when encrypted storage migration is enabled', () => {
    expect(
      getActiveAuthStorageKey({
        supabaseUrl: 'https://abc123.supabase.co',
        useMigratedStorageKey: true,
      })
    ).toBe('baci-mobile-admin-auth-token-abc123');
  });

  it('namespaces the migrated key by Supabase project ref', () => {
    expect(
      getMigratedSupabaseAuthStorageKey('https://prod123.supabase.co')
    ).toBe('baci-mobile-admin-auth-token-prod123');
    expect(
      getMigratedSupabaseAuthStorageKey('https://stage456.supabase.co')
    ).toBe('baci-mobile-admin-auth-token-stage456');
  });
});

describe('authSessionStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps the current MMKV admin storage without changing semantics', async () => {
    storageMocks.getString.mockReturnValue('session-json');

    await expect(authSessionStorage.getItem('auth-key')).resolves.toBe(
      'session-json'
    );
    await authSessionStorage.setItem('auth-key', 'next-json');
    await authSessionStorage.removeItem('auth-key');

    expect(storageMocks.getString).toHaveBeenCalledWith('auth-key');
    expect(storageMocks.set).toHaveBeenCalledWith('auth-key', 'next-json');
    expect(storageMocks.remove).toHaveBeenCalledWith('auth-key');
  });

  it('returns null when no session is stored', async () => {
    storageMocks.getString.mockReturnValue(undefined);

    await expect(authSessionStorage.getItem('auth-key')).resolves.toBeNull();
  });

  it('removes only Supabase auth storage keys for local sign-out fallback', () => {
    removeAuthStorageKeys('sb-abc123-auth-token');

    expect(storageMocks.remove).toHaveBeenCalledWith('sb-abc123-auth-token');
    expect(storageMocks.remove).toHaveBeenCalledWith(
      'sb-abc123-auth-token-code-verifier'
    );
    expect(storageMocks.remove).toHaveBeenCalledWith(
      'sb-abc123-auth-token-user'
    );
    expect(storageMocks.remove).toHaveBeenCalledTimes(3);
  });
});
