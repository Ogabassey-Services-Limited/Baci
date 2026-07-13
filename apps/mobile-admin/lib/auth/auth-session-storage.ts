import type { SupportedStorage } from '@supabase/supabase-js';
import { storage } from '@/lib/storage';

const MIGRATED_SUPABASE_AUTH_STORAGE_KEY_PREFIX =
  'baci-mobile-admin-auth-token';

function getSupabaseProjectRef(supabaseUrl: string): string {
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

  return projectRef;
}

export function getDefaultSupabaseAuthStorageKey(supabaseUrl: string): string {
  const projectRef = getSupabaseProjectRef(supabaseUrl);

  return `sb-${projectRef}-auth-token`;
}

export function getMigratedSupabaseAuthStorageKey(supabaseUrl: string): string {
  const projectRef = getSupabaseProjectRef(supabaseUrl);

  return `${MIGRATED_SUPABASE_AUTH_STORAGE_KEY_PREFIX}-${projectRef}`;
}

export function getActiveAuthStorageKey(params: {
  supabaseUrl: string;
  useMigratedStorageKey: boolean;
}): string {
  return params.useMigratedStorageKey
    ? getMigratedSupabaseAuthStorageKey(params.supabaseUrl)
    : getDefaultSupabaseAuthStorageKey(params.supabaseUrl);
}

export const authSessionStorage: SupportedStorage = {
  getItem: async (key: string) => storage.getString(key) ?? null,
  // biome-ignore lint/suspicious/useAwait: SupportedStorage requires a Promise<void>-returning method
  setItem: async (key: string, value: string) => {
    storage.set(key, value);
  },
  // biome-ignore lint/suspicious/useAwait: SupportedStorage requires a Promise<void>-returning method
  removeItem: async (key: string) => {
    storage.remove(key);
  },
};

export function removeAuthStorageKeys(storageKey: string): void {
  storage.remove(storageKey);
  storage.remove(`${storageKey}-code-verifier`);
  storage.remove(`${storageKey}-user`);
}
