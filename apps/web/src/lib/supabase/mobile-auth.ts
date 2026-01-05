import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

/**
 * Get the authenticated user from either:
 * 1. Bearer token in Authorization header (mobile apps, API clients)
 * 2. Cookie-based auth (web browser)
 *
 * 2025 Best Practice:
 * - Use `getUser(token)` to validate JWTs server-side (prevents spoofing)
 * - Never trust `getSession()` alone for auth verification
 * - Create a properly scoped client for subsequent queries
 *
 * @param request - The incoming request with potential auth headers
 * @returns Authenticated user and supabase client, or null if not authenticated
 */
export async function getAuthenticatedUser(request: Request) {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error('Supabase configuration is missing');
  }

  // Check for Bearer token from Authorization header (mobile/API)
  const authHeader = request.headers.get('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const accessToken = authHeader.slice(7); // Remove 'Bearer ' prefix

    // Create a client and validate the token by calling getUser
    // getUser validates the JWT signature against Supabase's public keys
    const supabase = createSupabaseClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // Validate the token by calling getUser
    // This is the secure way - it validates JWT against Supabase servers
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      return { user, supabase };
    }

    // Token invalid or expired - fall through to cookie check
    // (in case they have both, prefer valid auth)
  }

  // Fall back to cookie-based auth (web browser)
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    });

    // Use getUser to validate - never trust getSession alone
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      return { user, supabase };
    }
  } catch {
    // Cookie access may fail in certain contexts (e.g., static generation)
    // This is expected and not an error
  }

  return null;
}

/**
 * Type helper for the authenticated result
 */
type AuthenticatedResult = NonNullable<
  Awaited<ReturnType<typeof getAuthenticatedUser>>
>;
