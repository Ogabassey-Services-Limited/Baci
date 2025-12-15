import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Customer OTP Authentication - Send Code
 *
 * Sends a 6-digit OTP code to the customer's email.
 * Uses Supabase's built-in signInWithOtp for passwordless auth.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, merchantSlug } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!merchantSlug) {
      return NextResponse.json(
        { error: 'Merchant slug is required' },
        { status: 400 }
      );
    }

    // Basic email validation with length limit to prevent ReDoS
    const isValidEmail =
      email.length <= 254 &&
      email.includes('@') &&
      email.indexOf('@') > 0 &&
      email.lastIndexOf('.') > email.indexOf('@') + 1 &&
      !/\s/.test(email);
    if (!isValidEmail) {
      return NextResponse.json(
        { error: 'Invalid email format' },
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

    // Get the redirect URL for OTP verification
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const redirectUrl = `${protocol}://${merchantSlug}.${rootDomain}/account/verify`;

    // Send OTP using Supabase's built-in magic link/OTP system
    // We use signInWithOtp which sends a 6-digit code
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectUrl,
        data: {
          role: 'customer',
          // Store merchant context for post-verification
          pending_merchant_id: merchant.id,
        },
      },
    });

    if (otpError) {
      console.error('OTP send error:', otpError);

      // Handle rate limiting
      if (otpError.message?.includes('rate')) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment and try again.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to send verification code. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      email,
    });
  } catch (error) {
    console.error('Send code error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
