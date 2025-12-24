import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/discount-codes
 * Get all discount codes for the merchant
 */
export async function GET() {
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

    // Get discount codes
    const { data: discountCodes, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ discountCodes });
  } catch (error) {
    console.error('Error fetching discount codes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/discount-codes
 * Create a new discount code
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();

    // Validate required fields
    if (!body.code || !body.discount_type || !body.discount_value) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create discount code
    const discountCodeData = {
      merchant_id: merchant.id,
      code: body.code.toUpperCase(),
      description: body.description || null,
      discount_type: body.discount_type,
      discount_value: body.discount_value,
      minimum_purchase_amount: body.minimum_purchase_amount || 0,
      maximum_discount_amount: body.maximum_discount_amount || null,
      usage_limit: body.usage_limit || null,
      usage_limit_per_customer: body.usage_limit_per_customer || 1,
      starts_at: body.starts_at || null,
      expires_at: body.expires_at || null,
      is_active: body.is_active !== undefined ? body.is_active : true,
      applies_to: body.applies_to || 'all',
      product_ids: body.product_ids || [],
      category_ids: body.category_ids || [],
    };

    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .insert(discountCodeData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Discount code already exists' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ discountCode }, { status: 201 });
  } catch (error) {
    console.error('Error creating discount code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
