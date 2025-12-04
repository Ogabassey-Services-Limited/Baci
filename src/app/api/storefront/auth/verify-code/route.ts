import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Customer OTP Authentication - Verify Code
 *
 * Verifies the 6-digit OTP code and creates/links the customer record.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, token, merchantSlug } = body;

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and verification code are required' },
        { status: 400 }
      );
    }

    if (!merchantSlug) {
      return NextResponse.json(
        { error: 'Merchant slug is required' },
        { status: 400 }
      );
    }

    // Validate token format (6 digits)
    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: 'Invalid verification code format' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get merchant first
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name')
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
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
      console.error('OTP verification error:', verifyError);

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
    const { data: customerId, error: customerError } = await supabase.rpc(
      'upsert_customer_on_auth',
      {
        p_merchant_id: merchant.id,
        p_user_id: authData.user.id,
        p_email: email,
        p_full_name: authData.user.user_metadata?.full_name || null,
        p_phone: authData.user.user_metadata?.phone || null,
      }
    );

    if (customerError) {
      console.error('Customer upsert error:', customerError);
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
        email: authData.user.email,
      },
      customer: customer || {
        id: customerId,
        email,
        full_name: email.split('@')[0],
      },
      session: {
        access_token: authData.session?.access_token,
        expires_at: authData.session?.expires_at,
      },
    });
  } catch (error) {
    console.error('Verify code error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
