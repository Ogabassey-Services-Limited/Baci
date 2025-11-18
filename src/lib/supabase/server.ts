
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

type CookieHandler = {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, options: CookieOptions) => void;
  remove: (name: string, options: CookieOptions) => void;
};

// Creates a Supabase client for Server Components, API Routes, and Server Actions.
// This function is now adapted to work in different Next.js contexts.
export async function createClient(
  // The cookie handler can be provided for API routes, or it will default to next/headers for Server Components.
  cookieHandler?: CookieHandler
) {
  const cookieStore = cookieHandler || (await cookies());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anonymous key must be defined in your environment variables. Please check your .env.local file.');
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name);
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the handler is provided, it's from an API route.
          if (cookieHandler) {
            cookieHandler.set(name, value, options);
          } else {
            // Otherwise, it's a Server Component, so we use the try/catch pattern.
            try {
              (cookieStore as ReturnType<typeof cookies>).set({ name, value, ...options });
            } catch (error) {
              // This can be ignored if you have middleware refreshing user sessions.
            }
          }
        },
        remove(name: string, options: CookieOptions) {
          if (cookieHandler) {
            cookieHandler.remove(name, value, options);
          } else {
            try {
              (cookieStore as ReturnType<typeof cookies>).set({ name, value: '', ...options });
            } catch (error) {
              // This can be ignored if you have middleware refreshing user sessions.
            }
          }
        },
      },
    }
  );
}
