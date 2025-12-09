import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Customer OAuth Authentication - Google Sign-In
 *
 * Initiates Google OAuth flow for storefront customers.
 * Returns the OAuth URL to redirect the user to.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merchantSlug, redirectUrl } = body;

    if (!merchantSlug) {
      return NextResponse.json(
        { error: 'Merchant slug is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Verify merchant exists and is published
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name, is_published')
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (!merchant.is_published) {
      return NextResponse.json(
        { error: 'Store is not available' },
        { status: 403 }
      );
    }

    // Initiate Google OAuth
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl || `${process.env.NEXT_PUBLIC_APP_URL}/account`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        // Store merchant context in user metadata for post-auth processing
        // Note: This is passed via the state parameter internally by Supabase
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
