import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Store Publish API
 *
 * POST - Publish the merchant's store (make it publicly accessible)
 * DELETE - Unpublish the store (take it offline)
 */

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant with required fields for validation
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(`
        id,
        business_name,
        country,
        support_email,
        support_phone,
        paystack_subaccount_code,
        bank_code,
        bank_account_number
      `)
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Check for required setup items
    const missingItems: string[] = [];

    // Bank account required for payments
    if (
      !merchant.bank_code ||
      !merchant.bank_account_number ||
      !merchant.paystack_subaccount_code
    ) {
      missingItems.push('Bank account details');
    }

    // Country required for currency/shipping
    if (!merchant.country) {
      missingItems.push('Country/region setting');
    }

    // Contact info required
    if (!merchant.support_email && !merchant.support_phone) {
      missingItems.push('Contact information (email or phone)');
    }

    // Check for at least one product
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id)
      .eq('status', 'published');

    if (!productCount || productCount === 0) {
      missingItems.push('At least one published product');
    }

    // If any required items are missing, return error
    if (missingItems.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot publish store',
          message: 'Please complete the following required items:',
          missingItems,
        },
        { status: 400 }
      );
    }

    // All checks passed, publish the store
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', merchant.id);

    if (updateError) {
      console.error('Error publishing store:', updateError);
      return NextResponse.json(
        { error: 'Failed to publish store' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Store published successfully',
    });
  } catch (error) {
    console.error('Store publish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Unpublish the store
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        is_published: false,
      })
      .eq('id', merchant.id);

    if (updateError) {
      console.error('Error unpublishing store:', updateError);
      return NextResponse.json(
        { error: 'Failed to unpublish store' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Store unpublished successfully',
    });
  } catch (error) {
    console.error('Store unpublish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
