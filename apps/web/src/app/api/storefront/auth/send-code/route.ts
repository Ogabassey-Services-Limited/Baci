import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import z from 'zod';
import { createClient } from '@/lib/supabase/server';

// Zod schema for email validation (2026 best practice: use Zod instead of custom validation)
const SendCodeSchema = z.object({
  email: z.string().email('Invalid email format').max(254, 'Email too long'),
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
});

/**
 * Customer OTP Authentication - Send Code
 *
 * Sends a 6-digit OTP code to the customer's email.
 * Uses Supabase's built-in signInWithOtp for passwordless auth.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input using Zod schema
    const parseResult = SendCodeSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request data' },
        { status: 400 }
      );
    }

    const { email, merchantSlug } = parseResult.data;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Verify merchant exists and is published
    // Support both slug (e.g., 'ogabassey') and custom domain (e.g., 'ogabassey.com')
    let merchant = null;

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
    }

    if (!merchant) {
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
