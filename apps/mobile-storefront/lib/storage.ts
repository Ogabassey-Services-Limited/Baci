/**
 * Storage utility for Zustand persistence
 * Uses AsyncStorage for Expo Go compatibility
 * 
 * Note: MMKV requires native modules (NitroModules) which aren't 
 * available in Expo Go. Use a development build for MMKV performance.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage-based storage adapter for Zustand persist middleware
 * Fully compatible with Expo Go
 */
export const asyncStorage = {
    getItem: async (name: string): Promise<string | null> => {
        try {
            return await AsyncStorage.getItem(name);
        } catch (error) {
            console.warn('[Storage] Failed to get item:', name, error);
            return null;
        }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        try {
            await AsyncStorage.setItem(name, value);
        } catch (error) {
            console.warn('[Storage] Failed to set item:', name, error);
        }
    },
    removeItem: async (name: string): Promise<void> => {
        try {
            await AsyncStorage.removeItem(name);
        } catch (error) {
            console.warn('[Storage] Failed to remove item:', name, error);
        }
    },
};

/**
 * Sync storage adapter (for compatibility with existing code)
 * Uses a simple in-memory cache with AsyncStorage backup
 */
const memoryCache: Record<string, string> = {};

export const syncStorage = {
    getItem: (name: string): string | null => {
        // Return from memory cache (sync)
        return memoryCache[name] ?? null;
    },
    setItem: (name: string, value: string): void => {
        memoryCache[name] = value;
        // Also persist to AsyncStorage (async, fire and forget)
        AsyncStorage.setItem(name, value).catch(console.warn);
    },
    removeItem: (name: string): void => {
        delete memoryCache[name];
        AsyncStorage.removeItem(name).catch(console.warn);
    },
};

/**
 * Initialize storage by loading persisted data into memory cache
 * Call this at app startup before accessing stores
 */
export async function initializeStorage(keys: string[]): Promise<void> {
    try {
        const pairs = await AsyncStorage.multiGet(keys);
        for (const [key, value] of pairs) {
            if (value !== null) {
                memoryCache[key] = value;
            }
        }
    } catch (error) {
        console.warn('[Storage] Failed to initialize:', error);
    }
}
