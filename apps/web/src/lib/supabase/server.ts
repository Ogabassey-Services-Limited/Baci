import { type CookieOptions, createServerClient } from '@supabase/ssr';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { cookies } from 'next/headers';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import type { Database } from '@/types/supabase';

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

function createEventPipelineServerClient(cookieStore: ReadonlyRequestCookies) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error(
      'Supabase configuration is missing. Please check your environment variables.'
    );
  }
  return createServerClient<Database>(url, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Components cannot mutate response cookies.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // Server Components cannot mutate response cookies.
        }
      },
    },
  });
}

type ServerSupabaseClient = ReturnType<typeof createServerSupabaseClient>;

// Creates a Supabase client for Server Components, API Routes, and Server Actions.
export function createClient(
  sentinel: 'event-pipeline'
): Promise<ReturnType<typeof createEventPipelineServerClient>>;
export function createClient(
  cookieStore: ReadonlyRequestCookies,
  sentinel: 'event-pipeline'
): ReturnType<typeof createEventPipelineServerClient>;
export function createClient(): Promise<ServerSupabaseClient>;
export function createClient(
  cookieStore: ReadonlyRequestCookies
): ServerSupabaseClient;
export function createClient(
  cookieStoreOrSentinel?: ReadonlyRequestCookies | 'event-pipeline',
  sentinel?: 'event-pipeline'
) {
  const typed =
    cookieStoreOrSentinel === 'event-pipeline' || sentinel === 'event-pipeline';
  const cookieStore =
    cookieStoreOrSentinel === 'event-pipeline'
      ? undefined
      : cookieStoreOrSentinel;
  if (cookieStore) {
    return typed
      ? createEventPipelineServerClient(cookieStore)
      : createServerSupabaseClient(cookieStore);
  }

  return Promise.resolve(cookies()).then((requestCookies) =>
    typed
      ? createEventPipelineServerClient(requestCookies)
      : createServerSupabaseClient(requestCookies)
  );
}
