import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Customer Auth Session
 *
 * GET - Returns the current customer session and customer data
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantSlug = searchParams.get('merchantSlug');

    if (!merchantSlug) {
      return NextResponse.json(
        { error: 'Merchant slug is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get current auth session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        customer: null,
      });
    }

    // Check if user is a customer (not a merchant)
    const userRole = user.user_metadata?.role;
    if (userRole === 'merchant') {
      // Merchants should not be treated as customers on storefront
      return NextResponse.json({
        authenticated: false,
        user: null,
        customer: null,
        reason: 'merchant_account',
      });
    }

    // Get merchant - support both slug and custom_domain
    let merchant = null;

    // First, try by slug (standard lookup)
    const slugResult = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', merchantSlug)
      .single();

    if (slugResult.data) {
      merchant = slugResult.data;
    } else {
      // Fallback: try by custom_domain (for custom domain access like ogabassey.com)
      const domainResult = await supabase
        .from('merchants')
        .select('id')
        .eq('custom_domain', merchantSlug.toLowerCase())
        .single();

      merchant = domainResult.data;
    }

    if (!merchant) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Get customer record for this merchant
    let { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        address,
        saved_addresses,
        store_credit,
        total_orders,
        total_spent,
        created_at
      `)
      .eq('merchant_id', merchant.id)
      .eq('user_id', user.id)
      .single();

    if (customerError && customerError.code !== 'PGRST116') {
      // PGRST116 = no rows found (customer not yet created for this merchant)
      console.error('Customer fetch error:', customerError);
    } else if (!customer) {
      // Auto-create customer record if it doesn't exist
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert({
          merchant_id: merchant.id,
          user_id: user.id,
          email: user.email,
          first_name:
            user.user_metadata?.first_name ||
            user.user_metadata?.full_name?.split(' ')[0] ||
            null,
          last_name:
            user.user_metadata?.last_name ||
            user.user_metadata?.full_name?.split(' ').slice(1).join(' ') ||
            null,
        })
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          address,
          saved_addresses,
          store_credit,
          total_orders,
          total_spent,
          created_at
        `)
        .single();

      if (createError) {
        console.error('Failed to auto-create customer:', createError);
      } else {
        customer = newCustomer;
        console.log('Auto-created customer for merchant:', merchant.id);
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: userRole || 'customer',
      },
      customer: customer || null,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
