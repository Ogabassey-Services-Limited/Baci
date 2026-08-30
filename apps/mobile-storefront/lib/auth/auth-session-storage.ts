import type { SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { createLogger } from '../logger';

const log = createLogger('AuthSessionStorage');
const AUTH_STORAGE_TIMEOUT_MS = 4_000;
type StorageIntent =
  | { revision: number; type: 'delete' }
  | { revision: number; type: 'set'; value: string };
type StorageIntentInput = { type: 'delete' } | { type: 'set'; value: string };
const storageIntents = new Map<string, StorageIntent>();

function nextStorageIntent(
  key: string,
  intent: StorageIntentInput
): StorageIntent {
  const revision = (storageIntents.get(key)?.revision ?? 0) + 1;
  const nextIntent = { ...intent, revision } as StorageIntent;
  storageIntents.set(key, nextIntent);
  return nextIntent;
}

async function reconcileLatestStorageIntent(key: string): Promise<void> {
  let appliedRevision = -1;
  while (true) {
    const intent = storageIntents.get(key);
    if (!intent || intent.revision === appliedRevision) return;
    appliedRevision = intent.revision;
    try {
      if (intent.type === 'set') {
        await SecureStore.setItemAsync(key, intent.value);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      log.warn(
        'Unable to reconcile the latest Supabase auth session state.',
        error
      );
      return;
    }
    if (storageIntents.get(key)?.revision === appliedRevision) return;
  }
}

function fenceLateMutation(
  key: string,
  intent: StorageIntent,
  operation: Promise<void>
): void {
  operation.then(
    () => {
      if (storageIntents.get(key)?.revision !== intent.revision) {
        void reconcileLatestStorageIntent(key);
      }
    },
    () => undefined
  );
}

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
    const intent = nextStorageIntent(key, { type: 'set', value });
    const operation = SecureStore.setItemAsync(key, value);
    fenceLateMutation(key, intent, operation);
    try {
      await boundedStorageOperation(operation, 'write');
    } catch (error) {
      log.warn(
        'Unable to persist Supabase auth session in SecureStore.',
        error
      );
      throw error;
    }
  },
  removeItem: async (key: string) => {
    const intent = nextStorageIntent(key, { type: 'delete' });
    const operation = SecureStore.deleteItemAsync(key);
    fenceLateMutation(key, intent, operation);
    await boundedStorageOperation(operation, 'delete');
  },
};
