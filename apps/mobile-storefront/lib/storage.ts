/**
 * Storage utility for Zustand persistence
 * Uses AsyncStorage for Expo Go compatibility
 *
 * Note: MMKV requires native modules (NitroModules) which aren't
 * available in Expo Go. Use a development build for MMKV performance.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLogger } from './logger';

const log = createLogger('Storage');
type StorageEntry = readonly [string, string | null];

interface AsyncStorageBatchCompat {
  multiGet?: (keys: readonly string[]) => Promise<readonly StorageEntry[]>;
  multiRemove?: (keys: readonly string[]) => Promise<void>;
}

const asyncStorageBatchCompat =
  AsyncStorage as unknown as AsyncStorageBatchCompat;

export async function getStorageEntries(
  keys: readonly string[]
): Promise<StorageEntry[]> {
  if (keys.length === 0) return [];

  if (typeof asyncStorageBatchCompat.multiGet === 'function') {
    return [...(await asyncStorageBatchCompat.multiGet(keys))];
  }

  return Promise.all(
    keys.map(async (key) => [key, await AsyncStorage.getItem(key)] as const)
  );
}

export async function removeStorageItems(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;

  if (typeof asyncStorageBatchCompat.multiRemove === 'function') {
    await asyncStorageBatchCompat.multiRemove(keys);
    return;
  }

  await Promise.all(keys.map((key) => AsyncStorage.removeItem(key)));
}

/**
 * AsyncStorage-based storage adapter for Zustand persist middleware
 * Fully compatible with Expo Go
 */
export const asyncStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(name);
    } catch (error) {
      log.warn('Failed to get item:', name, error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (error) {
      log.warn('Failed to set item:', name, error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      log.warn('Failed to remove item:', name, error);
    }
  },
};

/**
 * Sync storage adapter (for compatibility with existing code)
 * Uses a simple in-memory cache with AsyncStorage backup
 *
 * BUG-4-007 FIX: Added initialization tracking to prevent race conditions with Zustand stores
 */
const memoryCache: Record<string, string> = {};
let isStorageInitialized = false;
let initializationPromise: Promise<void> | null = null;

export const syncStorage = {
  getItem: (name: string): string | null => {
    // BUG-4-007 FIX: Warn if accessed before initialization to help debug race conditions
    if (!isStorageInitialized) {
      log.warn(
        `Storage accessed ("${name}") before initialization complete. ` +
          'Ensure initializeStorage() is called and awaited in _layout.tsx before Zustand stores are accessed.'
      );
    }
    // Return from memory cache (sync)
    return memoryCache[name] ?? null;
  },
  setItem: (name: string, value: string): void => {
    memoryCache[name] = value;
    // Also persist to AsyncStorage (async, fire and forget)
    AsyncStorage.setItem(name, value).catch((error) =>
      log.warn('Failed to persist item:', name, error)
    );
  },
  removeItem: (name: string): void => {
    delete memoryCache[name];
    AsyncStorage.removeItem(name).catch((error) =>
      log.warn('Failed to remove item:', name, error)
    );
  },
};

/**
 * Check if storage has been initialized
 */
export function isStorageReady(): boolean {
  return isStorageInitialized;
}

/**
 * Wait for storage initialization to complete
 * Useful for components that need to ensure data is loaded
 */
export async function waitForStorageReady(): Promise<void> {
  if (isStorageInitialized) return;
  if (initializationPromise) {
    await initializationPromise;
    return;
  }
  // If no initialization in progress, wait a bit and check again
  // This handles edge cases where the check happens between promise start and assignment
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (initializationPromise) {
    await initializationPromise;
  }
}

/**
 * Initialize storage by loading persisted data into memory cache
 * Call this at app startup before accessing stores
 *
 * 2026 Critical Fix: Added deduplication to prevent multiple concurrent initializations
 */
export function initializeStorage(keys: string[]): Promise<void> {
  // Prevent multiple concurrent initializations
  if (initializationPromise) {
    log.debug('Initialization already in progress, waiting...');
    return initializationPromise;
  }

  if (isStorageInitialized) {
    log.debug('Already initialized, skipping');
    return Promise.resolve();
  }

  initializationPromise = (async () => {
    try {
      log.debug('Initializing with keys:', keys);
      const pairs = await getStorageEntries(keys);
      for (const [key, value] of pairs) {
        if (value !== null) {
          memoryCache[key] = value;
          log.debug(`Loaded "${key}" from AsyncStorage`);
        }
      }
      isStorageInitialized = true;
      log.debug('Initialization complete');
    } catch (error) {
      log.warn('Failed to initialize:', error);
      // Still mark as initialized to prevent blocking the app
      isStorageInitialized = true;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}
