
import { createBrowserClient } from '@supabase/ssr';
import { supabaseUrl, supabaseAnonKey } from '@/env';

export function createClient() {
  // The createClient function is now simplified to use the validated variables
  // from the new env.ts file, ensuring they are always available.
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
