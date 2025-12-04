import { type CookieOptions, createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

// Validate cookie name: disallow control chars, whitespace, '=', ';'
function isValidCookieName(name: string): boolean {
  // Per RFC 6265 section 4.1.1, cookie name should only contain visible ASCII chars excluding separators:
  // RFC 6265 prohibits control characters (ASCII 0-31, 127) and separator characters (e.g. space, tab, '=', ';', ',', etc.)
  // This regex only allows characters: !#$%&'*+-.0-9A-Z^_`a-z|~ ; it excludes separators and control characters.
  return /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/.test(name);
}

function createInvalidCookieNameError(name: string): Error {
  return new Error(
    `Invalid cookie name "${name}". Cookie names must not contain control characters, whitespace, '=', or ';'.`
  );
}

const MAX_COOKIE_SIZE = 4096; // Most browsers limit cookies to 4KB each (including name, value, and attributes)

function isValidCookieSize(cookieString: string): boolean {
  return cookieString.length <= MAX_COOKIE_SIZE;
}

function createInvalidCookieSizeError(cookieString: string): Error {
  return new Error(
    `Cookie is too large (${cookieString.length} bytes, max allowed is ${MAX_COOKIE_SIZE}). Most browsers only allow up to 4KB per cookie.`
  );
}

// Robust cookie getter utility function
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(`${name}=`)) {
      const value = cookie.substring(name.length + 1);
      return decodeURIComponent(value);
    }
  }
  return undefined;
}

export function createClient() {
  // The createClient function now calls the getter functions to ensure
  // environment variables are accessed at runtime, not build time.
  // Configure to use cookies for SSR compatibility
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name: string) {
        // Use robust cookie utility
        return getCookie(name);
      },
      set(name: string, value: string, options: CookieOptions) {
        // Use document.cookie to set cookies
        // Validate cookie name
        if (!isValidCookieName(name)) {
          throw createInvalidCookieNameError(name);
        }
        // Encode cookie value
        const encodedValue = encodeURIComponent(value);
        let cookie = `${name}=${encodedValue}`;
        if (options.maxAge) cookie += `; max-age=${options.maxAge}`;
        if (options.path) cookie += `; path=${options.path}`;
        if (options.domain) cookie += `; domain=${options.domain}`;
        if (options.sameSite) cookie += `; samesite=${options.sameSite}`;
        if (options.secure) cookie += '; secure';

        // Validate total cookie size before setting
        if (!isValidCookieSize(cookie)) {
          throw createInvalidCookieSizeError(cookie);
        }
        if (typeof document !== 'undefined') {
          // biome-ignore lint/suspicious/noDocumentCookie: Client-side cookie fallback
          document.cookie = cookie;
        }
      },
      remove(name: string, options: CookieOptions) {
        // Validate cookie name
        if (!isValidCookieName(name)) {
          throw createInvalidCookieNameError(name);
        }
        // Set expiry date to the past to remove cookie
        let cookie = `${name}=; max-age=0`;
        if (options.path) cookie += `; path=${options.path}`;
        if (options.domain) cookie += `; domain=${options.domain}`;
        if (typeof document !== 'undefined') {
          // biome-ignore lint/suspicious/noDocumentCookie: Client-side cookie fallback
          document.cookie = cookie;
        }
      },
    },
  });
}
