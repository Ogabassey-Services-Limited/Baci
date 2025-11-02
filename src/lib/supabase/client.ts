
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Ensure the environment variables are not undefined before passing them to createBrowserClient
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anonymous key must be defined in your environment variables.');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
