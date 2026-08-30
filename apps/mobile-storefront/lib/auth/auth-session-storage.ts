import type { SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { createLogger } from '../logger';

const log = createLogger('AuthSessionStorage');
const AUTH_STORAGE_TIMEOUT_MS = 4_000;

async function boundedStorageOperation<T>(
  operation: Promise<T>,
  operationName: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`Supabase auth storage ${operationName} timed out`)),
      AUTH_STORAGE_TIMEOUT_MS
    );
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

export const authSessionStorage: SupportedStorage = {
  getItem: async (key: string) =>
    boundedStorageOperation(SecureStore.getItemAsync(key), 'read'),
  setItem: async (key: string, value: string) => {
    try {
      await boundedStorageOperation(
        SecureStore.setItemAsync(key, value),
        'write'
      );
    } catch (error) {
      log.warn(
        'Unable to persist Supabase auth session in SecureStore.',
        error
      );
      throw error;
    }
  },
  removeItem: async (key: string) => {
    await boundedStorageOperation(SecureStore.deleteItemAsync(key), 'delete');
  },
};
