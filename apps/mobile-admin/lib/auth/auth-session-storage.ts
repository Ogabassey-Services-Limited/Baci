import type { SupportedStorage } from '@supabase/supabase-js';
import { storage } from '@/lib/storage';

export const MIGRATED_SUPABASE_AUTH_STORAGE_KEY =
  'baci-mobile-admin-auth-token';

export function getDefaultSupabaseAuthStorageKey(supabaseUrl: string): string {
  let host: string;
  try {
    host = new URL(supabaseUrl).hostname;
  } catch {
    throw new Error(
      '[Supabase] Invalid Supabase URL; cannot derive default auth storage key.'
    );
  }

  const projectRef = host.split('.')[0];
  if (!projectRef) {
    throw new Error(
      '[Supabase] Invalid Supabase URL; missing project ref for auth storage key.'
    );
  }

  return `sb-${projectRef}-auth-token`;
}

export function getActiveAuthStorageKey(params: {
  supabaseUrl: string;
  useMigratedStorageKey: boolean;
}): string {
  return params.useMigratedStorageKey
    ? MIGRATED_SUPABASE_AUTH_STORAGE_KEY
    : getDefaultSupabaseAuthStorageKey(params.supabaseUrl);
}

export const authSessionStorage: SupportedStorage = {
  getItem: async (key: string) => storage.getString(key) ?? null,
  setItem: async (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: async (key: string) => {
    storage.remove(key);
  },
};

export function removeAuthStorageKeys(storageKey: string): void {
  storage.remove(storageKey);
  storage.remove(`${storageKey}-code-verifier`);
  storage.remove(`${storageKey}-user`);
}
