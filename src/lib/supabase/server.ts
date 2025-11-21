
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { supabaseUrl, supabaseAnonKey } from '@/env';

// Creates a Supabase client for Server Components, API Routes, and Server Actions.
export function createClient(cookieStore: ReadonlyRequestCookies) {
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
