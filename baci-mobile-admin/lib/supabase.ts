/**
 * Supabase Client for Admin App
 * Uses MMKV for auth session persistence
 */

import { createClient } from '@supabase/supabase-js';
import { createMMKV } from 'react-native-mmkv';

// Dedicated MMKV instance for admin auth
const authStorage = createMMKV({
  id: 'baci-admin-auth',
});

// MMKV adapter for Supabase auth
const mmkvAuthAdapter = {
  getItem: (key: string): string | null => {
    return authStorage.getString(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    authStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    authStorage.delete(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvAuthAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Utility to clear admin auth (logout)
export const clearAdminAuth = async () => {
  await supabase.auth.signOut();
  authStorage.clearAll();
};
