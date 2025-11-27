import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Retrieve all discount codes for the authenticated merchant.
 *
 * Authenticates the request using cookies, resolves the merchant for the authenticated user,
 * and returns the merchant's discount codes ordered by `created_at` descending.
 * Responds with 401 if the user is not authenticated, 404 if the merchant is not found,
 * and 500 for internal server errors.
 *
 * @returns A JSON response containing `discountCodes` on success; on error returns a JSON object with an `error` message and an appropriate HTTP status (401, 404, or 500).
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
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
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
 * Create a new discount code for the authenticated merchant.
 *
 * Validates required fields from the request JSON, builds a discount code record
 * with sensible defaults, inserts it into `discount_codes`, and returns the created record.
 *
 * @param request - The incoming request whose JSON body contains the discount code payload.
 * @returns On success, a JSON response containing `discountCode` with HTTP status 201.
 *          On error, a JSON response containing `error` with one of:
 *            - 400: Missing required fields
 *            - 401: Unauthorized
 *            - 404: Merchant not found
 *            - 409: Discount code already exists
 *            - 500: Internal server error
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
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
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