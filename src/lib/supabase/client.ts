
import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/env';

export function createClient() {
  // The createClient function now calls the getter functions to ensure
  // environment variables are accessed at runtime, not build time.
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
