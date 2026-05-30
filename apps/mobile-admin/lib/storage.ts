import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({
  id: 'baci-admin-storage',
});

/**
 * Helper to wrap MMKV for Zustand persistence
 */
export const zustandStorage = {
  setItem: (name: string, value: string) => {
    return storage.set(name, value);
  },
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  removeItem: (name: string) => {
    return storage.remove(name);
  },
};

/**
 * Helper to emulate AsyncStorage using MMKV for absolute compatibility and high performance.
 */
export const asyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const value = storage.getString(key);
    return value ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    storage.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    storage.remove(key);
  },
};
