import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import z from 'zod';
import { getAppUrl } from '@/env';
import { createClient } from '@/lib/supabase/server';

const appleAuthSchema = z.object({
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
  redirectUrl: z.string().trim().min(1).optional(),
});

function resolveTrustedAppRedirectUrl(redirectUrl?: string) {
  const appUrl = getAppUrl();
  const appOrigin = new URL(appUrl).origin;

  if (!redirectUrl) {
    return new URL('/account', appOrigin).toString();
  }

  try {
    const parsed = redirectUrl.startsWith('/')
      ? new URL(redirectUrl, appOrigin)
      : new URL(redirectUrl);

    if (parsed.origin !== appOrigin) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Customer OAuth Authentication - Apple Sign-In
 *
 * Initiates Apple OAuth flow for storefront customers.
 * Returns the OAuth URL to redirect the user to.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = appleAuthSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { merchantSlug, redirectUrl } = validation.data;
    const trustedRedirectUrl = resolveTrustedAppRedirectUrl(redirectUrl);
    if (!trustedRedirectUrl) {
      return NextResponse.json(
        { error: 'Invalid redirectUrl', code: 'INVALID_REDIRECT_URL' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Verify merchant exists and is published
    // Support both slug (e.g., 'ogabassey') and custom domain (e.g., 'ogabassey.com')
    let merchant = null;
    let merchantError = null;

    // First, try by slug (standard lookup)
    const slugResult = await supabase
      .from('merchants')
      .select('id, slug, business_name, is_published')
      .eq('slug', merchantSlug)
      .single();

    if (slugResult.data) {
      merchant = slugResult.data;
    } else {
      // Fallback: try by custom_domain (for custom domain access like ogabassey.com)
      const domainResult = await supabase
        .from('merchants')
        .select('id, slug, business_name, is_published')
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

    // Initiate Apple OAuth
    // 2026 Best Practice: Using Supabase's built-in OAuth for Apple
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: trustedRedirectUrl,
      },
    });

    if (oauthError) {
      console.error('Apple OAuth error:', oauthError);
      return NextResponse.json(
        { error: 'Failed to initiate Apple sign-in. Please try again.' },
        { status: 500 }
      );
    }

    // Return the OAuth URL for client-side redirect
    return NextResponse.json({
      success: true,
      url: data.url,
    });
  } catch (error) {
    console.error('Apple auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
