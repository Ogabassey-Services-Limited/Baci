import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

/**
 * Creates a Supabase client for use in Next.js middleware.
 * This handles session refresh and cookie management automatically.
 *
 * @see https://supabase.com/docs/guides/auth/server-side
 */
export async function updateSession(
  request: NextRequest,
  response?: NextResponse
) {
  // Create a response that we can modify, or use the provided one
  let supabaseResponse =
    response ??
    NextResponse.next({
      request,
    });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Set cookies on the request for downstream middleware/handlers
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // Create a new response with updated request
        supabaseResponse = NextResponse.next({
          request,
        });
        // Set cookies on the response for the browser
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: Do not run code between createServerClient and supabase.auth.getUser()
  // A simple mistake could make your app vulnerable to session replay attacks.

  // This will refresh the session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user };
}

/**
 * Check if the current request requires authentication.
 * Returns the appropriate response if redirect is needed, or null to continue.
 */
export async function checkAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  const { supabaseResponse, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Define protected route patterns
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/builder') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/onboarding');

  // Define auth routes (login, signup, etc.)
  const isAuthRoute =
    pathname === '/login' ||
    // pathname === '/onboarding' ||
    pathname === '/reset-password';

  // Protected routes: redirect to login if no user
  if (isProtectedRoute && !user) {
    console.log(
      'Lib Middleware: No user on protected route, redirecting to login',
      pathname
    );
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // Auth routes: redirect to dashboard if already logged in
  if (isAuthRoute && user) {
    console.log(
      'Lib Middleware: User exists on auth route, redirecting to dashboard'
    );
    const redirectTo = request.nextUrl.searchParams.get('redirectTo');
    const url = request.nextUrl.clone();
    url.pathname = redirectTo || '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Continue with the updated session response
  return supabaseResponse;
}
