import type { SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { createLogger } from '../logger';

const log = createLogger('AuthSessionStorage');
const AUTH_STORAGE_TIMEOUT_MS = 4_000;
class AuthStorageTimeoutError extends Error {}
type StorageIntent =
  | { pending: boolean; revision: number; type: 'delete' }
  | { pending: boolean; revision: number; type: 'set'; value: string };
type StorageIntentInput = { type: 'delete' } | { type: 'set'; value: string };
const storageIntents = new Map<string, StorageIntent>();
const storageMutationQueues = new Map<string, Promise<void>>();

async function runSerializedStorageMutation<T>(
  key: string,
  mutation: () => Promise<T>
): Promise<T> {
  const previousMutation = storageMutationQueues.get(key) ?? Promise.resolve();
  const result = previousMutation.catch(() => undefined).then(mutation);
  const queueTail = result.then(
    () => undefined,
    () => undefined
  );
  storageMutationQueues.set(key, queueTail);
  try {
    return await result;
  } finally {
    if (storageMutationQueues.get(key) === queueTail) {
      storageMutationQueues.delete(key);
    }
  }
}

function nextStorageIntent(
  key: string,
  intent: StorageIntentInput
): StorageIntent {
  const revision = (storageIntents.get(key)?.revision ?? 0) + 1;
  const nextIntent = { ...intent, pending: true, revision } as StorageIntent;
  storageIntents.set(key, nextIntent);
  return nextIntent;
}

async function reconcileLatestStorageIntent(key: string): Promise<void> {
  while (true) {
    const intent = storageIntents.get(key);
    if (!intent?.pending) return;
    const operation =
      intent.type === 'set'
        ? SecureStore.setItemAsync(key, intent.value)
        : SecureStore.deleteItemAsync(key);
    fenceLateMutation(key, intent, operation);
    try {
      await boundedStorageOperation(operation, 'reconciliation');
    } catch (error) {
      log.warn(
        'Unable to reconcile the latest Supabase auth session state.',
        error
      );
      return;
    }
    if (storageIntents.get(key)?.revision === intent.revision) return;
  }
}

function fenceLateMutation(
  key: string,
  intent: StorageIntent,
  operation: Promise<void>
): void {
  operation.then(
    () => {
      const currentIntent = storageIntents.get(key);
      if (currentIntent?.revision === intent.revision) {
        currentIntent.pending = false;
      } else if (currentIntent) {
        currentIntent.pending = true;
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
        reject(
          new AuthStorageTimeoutError(
            `Supabase auth storage ${operationName} timed out`
          )
        ),
      AUTH_STORAGE_TIMEOUT_MS
    );
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function restorePreviousStorageIntent(
  key: string,
  previousValue: string | null,
  needsReconciliation: boolean
): void {
  const intent = nextStorageIntent(
    key,
    previousValue === null
      ? { type: 'delete' }
      : { type: 'set', value: previousValue }
  );
  intent.pending = needsReconciliation;
  if (needsReconciliation) void reconcileLatestStorageIntent(key);
}

async function readAuthStorageItem(key: string): Promise<string | null> {
  const intent = storageIntents.get(key);
  if (intent?.pending) {
    if (intent.type === 'delete') {
      void reconcileLatestStorageIntent(key);
      return null;
    }
    await reconcileLatestStorageIntent(key);
    if (storageIntents.get(key)?.pending) return null;
  }

  const revisionBeforeRead = storageIntents.get(key)?.revision;
  const value = await boundedStorageOperation(
    SecureStore.getItemAsync(key),
    'read'
  );
  const intentAfterRead = storageIntents.get(key);
  if (
    intentAfterRead?.pending ||
    intentAfterRead?.revision !== revisionBeforeRead
  ) {
    return null;
  }
  return value;
}

async function captureRollbackBaseline(key: string): Promise<string | null> {
  const logicalIntent = storageIntents.get(key);
  if (logicalIntent) {
    return logicalIntent.type === 'delete' ? null : logicalIntent.value;
  }

  try {
    return await boundedStorageOperation(
      SecureStore.getItemAsync(key),
      'rollback snapshot'
    );
  } catch (error) {
    log.warn('Unable to capture the Supabase auth rollback baseline.', error);
    throw error;
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
  getItem: readAuthStorageItem,
  setItem: (key: string, value: string) =>
    runSerializedStorageMutation(key, async () => {
      const previousValue = await captureRollbackBaseline(key);
      const intent = nextStorageIntent(key, { type: 'set', value });
      const operation = SecureStore.setItemAsync(key, value);
      fenceLateMutation(key, intent, operation);
      try {
        await boundedStorageOperation(operation, 'write');
      } catch (error) {
        if (storageIntents.get(key)?.revision === intent.revision) {
          restorePreviousStorageIntent(
            key,
            previousValue,
            error instanceof AuthStorageTimeoutError
          );
        }
        log.warn(
          'Unable to persist Supabase auth session in SecureStore.',
          error
        );
        throw error;
      }
    }),
  removeItem: (key: string) =>
    runSerializedStorageMutation(key, async () => {
      const previousValue = await captureRollbackBaseline(key);
      const intent = nextStorageIntent(key, { type: 'delete' });
      const operation = SecureStore.deleteItemAsync(key);
      fenceLateMutation(key, intent, operation);
      try {
        await boundedStorageOperation(operation, 'delete');
      } catch (error) {
        if (storageIntents.get(key)?.revision === intent.revision) {
          restorePreviousStorageIntent(
            key,
            previousValue,
            error instanceof AuthStorageTimeoutError
          );
        }
        throw error;
      }
    }),
};
