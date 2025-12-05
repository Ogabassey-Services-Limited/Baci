import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

export function createClient() {
  // Use the default createBrowserClient which automatically handles
  // cookies safely and correctly (including chunking for large tokens).
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
