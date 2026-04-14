import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { verifyCodeSchema } from '@/schemas/auth';

/**
 * Customer OTP Authentication - Verify Code
 *
 * Verifies the 6-digit OTP code and creates/links the customer record.
 * Security: Uses Zod schema validation and server-validated email from auth response.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input with Zod schema - this ensures proper types and formats
    const validationResult = verifyCodeSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { email, token, merchantSlug } = validationResult.data;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get merchant first - support both slug and custom_domain
    let merchant = null;

    // First, try by slug (standard lookup)
    const slugResult = await supabase
      .from('merchants')
      .select('id, slug, business_name')
      .eq('slug', merchantSlug)
      .single();

    if (slugResult.data) {
      merchant = slugResult.data;
    } else {
      // Fallback: try by custom_domain (for custom domain access like ogabassey.com)
      const domainResult = await supabase
        .from('merchants')
        .select('id, slug, business_name')
        .eq('custom_domain', merchantSlug.toLowerCase())
        .single();

      merchant = domainResult.data;
    }

    if (!merchant) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Verify OTP code
    const { data: authData, error: verifyError } =
      await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

    if (verifyError || !authData.user) {
      const redactedEmail = email
        ? `${email.slice(0, 3)}***@${email.split('@')[1]}`
        : 'unknown';
      logger.error({
        message: 'OTP verification error',
        error: verifyError,
        email: redactedEmail,
      });

      if (verifyError?.message?.includes('expired')) {
        return NextResponse.json(
          { error: 'Verification code has expired. Please request a new one.' },
          { status: 400 }
        );
      }

      if (verifyError?.message?.includes('invalid')) {
        return NextResponse.json(
          { error: 'Invalid verification code. Please check and try again.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Verification failed. Please try again.' },
        { status: 400 }
      );
    }

    // SECURITY: Use server-validated email from auth response, not user input
    // This ensures we trust data from Supabase Auth after successful verification
    const verifiedEmail = authData.user.email;
    if (!verifiedEmail) {
      return NextResponse.json(
        { error: 'Authentication failed: missing email' },
        { status: 400 }
      );
    }

    // Set user metadata to mark as customer (if not already set)
    const currentMetadata = authData.user.user_metadata || {};
    if (currentMetadata.role !== 'customer') {
      await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          role: 'customer',
        },
      });
    }

    // Upsert customer record using our database function
    // Using verifiedEmail from auth response for security
    const { data: customerId, error: customerError } = await supabase.rpc(
      'upsert_customer_on_auth',
      {
        p_merchant_id: merchant.id,
        p_user_id: authData.user.id,
        p_email: verifiedEmail,
        p_full_name: authData.user.user_metadata?.full_name || null,
        p_phone: authData.user.user_metadata?.phone || null,
      }
    );

    if (customerError) {
      logger.error({
        message: 'Customer upsert error',
        error: customerError,
        merchantId: merchant.id,
        userId: authData.user.id,
      });
      // Don't fail the login, just log the error
    }

    // Fetch the customer record
    const { data: customer } = await supabase
      .from('customers')
      .select(
        'id, full_name, email, phone, saved_addresses, total_orders, total_spent'
      )
      .eq('merchant_id', merchant.id)
      .eq('user_id', authData.user.id)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email: verifiedEmail,
      },
      customer: customer || {
        id: customerId,
        email: verifiedEmail,
        full_name: verifiedEmail.split('@')[0],
      },
      session: {
        access_token: authData.session?.access_token,
        expires_at: authData.session?.expires_at,
      },
    });
  } catch (error) {
    logger.error({
      message: 'Verify code internal error',
      error: error instanceof Error ? error : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
