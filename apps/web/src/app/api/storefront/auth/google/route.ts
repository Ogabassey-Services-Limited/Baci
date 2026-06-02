import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import z from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveTrustedStorefrontRedirectUrl } from '../oauth-redirect';

const googleAuthSchema = z.object({
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
  redirectUrl: z.string().trim().min(1).optional(),
});

/**
 * Customer OAuth Authentication - Google Sign-In
 *
 * Initiates Google OAuth flow for storefront customers.
 * Returns the OAuth URL to redirect the user to.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = googleAuthSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { merchantSlug, redirectUrl } = validation.data;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Verify merchant exists and is published
    // Support both slug (e.g., 'ogabassey') and custom domain (e.g., 'ogabassey.com')
    let merchant = null;
    let merchantError = null;

    // First, try by slug (standard lookup)
    const slugResult = await supabase
      .from('merchants')
      .select('id, slug, business_name, is_published, custom_domain')
      .eq('slug', merchantSlug)
      .single();

    if (slugResult.data) {
      merchant = slugResult.data;
    } else {
      // Fallback: try by custom_domain (for custom domain access like ogabassey.com)
      const domainResult = await supabase
        .from('merchants')
        .select('id, slug, business_name, is_published, custom_domain')
        .eq('custom_domain', merchantSlug.toLowerCase())
        .single();

      merchant = domainResult.data;
      merchantError = domainResult.error;
    }

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (!merchant.is_published) {
      return NextResponse.json(
        { error: 'Store is not available' },
        { status: 403 }
      );
    }

    const trustedRedirectUrl = resolveTrustedStorefrontRedirectUrl(
      redirectUrl,
      merchant
    );
    if (!trustedRedirectUrl) {
      return NextResponse.json(
        { error: 'Invalid redirectUrl', code: 'INVALID_REDIRECT_URL' },
        { status: 400 }
      );
    }

    // Initiate Google OAuth
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: trustedRedirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (oauthError) {
      console.error('Google OAuth error:', oauthError);
      return NextResponse.json(
        { error: 'Failed to initiate Google sign-in. Please try again.' },
        { status: 500 }
      );
    }

    // Return the OAuth URL for client-side redirect
    return NextResponse.json({
      success: true,
      url: data.url,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
