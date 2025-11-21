
import { createBrowserClient, type CookieOptions } from '@supabase/ssr';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/env';

export function createClient() {
  // The createClient function now calls the getter functions to ensure
  // environment variables are accessed at runtime, not build time.
  // Configure to use cookies for SSR compatibility
  return createBrowserClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        get(name: string) {
          // Use document.cookie to read cookies
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop()?.split(';').shift();
        },
        set(name: string, value: string, options: CookieOptions) {
          // Use document.cookie to set cookies
          let cookie = `${name}=${value}`;
          if (options.maxAge) cookie += `; max-age=${options.maxAge}`;
          if (options.path) cookie += `; path=${options.path}`;
          if (options.domain) cookie += `; domain=${options.domain}`;
          if (options.sameSite) cookie += `; samesite=${options.sameSite}`;
          if (options.secure) cookie += '; secure';
          document.cookie = cookie;
        },
        remove(name: string, options: CookieOptions) {
          // Set expiry date to the past to remove cookie
          let cookie = `${name}=; max-age=0`;
          if (options.path) cookie += `; path=${options.path}`;
          if (options.domain) cookie += `; domain=${options.domain}`;
          document.cookie = cookie;
        },
      },
    }
  );
}
