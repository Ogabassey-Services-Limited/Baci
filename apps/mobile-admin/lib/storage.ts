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
