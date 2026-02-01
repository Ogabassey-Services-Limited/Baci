import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Storefront OAuth Callback Handler
 *
 * This route handles the OAuth callback for storefront customer authentication.
 * It exchanges the authorization code for a session and redirects to the account page.
 *
 * This is necessary for custom domains (e.g., ogabassey.com) where cookies must be
 * set on the same domain that initiated the OAuth flow.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const { slug } = await params;

  // If there's an OAuth error from the provider
  if (error) {
    // Log sanitization: remove all control characters and limit length to prevent log injection
    const safeError = String(error)
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally matching control chars for sanitization
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .slice(0, 200);
    const safeDesc = String(errorDescription ?? '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally matching control chars for sanitization
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .slice(0, 500);
    console.error('OAuth error:', safeError, safeDesc);
    const loginPath = slug ? `/${slug}/account/login` : '/account/login';
    return NextResponse.redirect(
      `${origin}${loginPath}?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // No code provided
  if (!code) {
    console.error('No authorization code provided');
    const loginPath = slug ? `/${slug}/account/login` : '/account/login';
    return NextResponse.redirect(
      `${origin}${loginPath}?error=No authorization code provided`
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Exchange the authorization code for a session
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Failed to exchange code for session:', exchangeError);
      const loginPath = slug ? `/${slug}/account/login` : '/account/login';
      return NextResponse.redirect(
        `${origin}${loginPath}?error=${encodeURIComponent(exchangeError.message)}`
      );
    }

    // Success! Redirect to the account page
    // Use the slug to maintain proper routing
    const accountPath = slug ? `/${slug}/account` : '/account';

    console.log('OAuth successful for user:', data.user?.email);

    return NextResponse.redirect(`${origin}${accountPath}`);
  } catch (err) {
    console.error('Unexpected error during OAuth callback:', err);
    const loginPath = slug ? `/${slug}/account/login` : '/account/login';
    return NextResponse.redirect(
      `${origin}${loginPath}?error=An unexpected error occurred`
    );
  }
}
