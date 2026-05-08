import { type CookieOptions, createServerClient } from '@supabase/ssr';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { cookies } from 'next/headers';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

function createServerSupabaseClient(cookieStore: ReadonlyRequestCookies) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error(
      'Supabase configuration is missing. Please check your environment variables.'
    );
  }

  return createServerClient(url, key, {
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
  });
}

type ServerSupabaseClient = ReturnType<typeof createServerSupabaseClient>;

// Creates a Supabase client for Server Components, API Routes, and Server Actions.
export function createClient(): Promise<ServerSupabaseClient>;
export function createClient(
  cookieStore: ReadonlyRequestCookies
): ServerSupabaseClient;
export function createClient(cookieStore?: ReadonlyRequestCookies) {
  if (cookieStore) {
    return createServerSupabaseClient(cookieStore);
  }

  return Promise.resolve(cookies()).then((requestCookies) =>
    createServerSupabaseClient(requestCookies)
  );
}
