import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { createDiscountCodeSchema } from '@/schemas/discount-codes';

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

    // Get merchant (supports owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'marketing', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Get discount codes
    const { data: discountCodes, error } = await supabase
      .from('discount_codes')
      .select(
        'id, merchant_id, code, description, discount_type, discount_value, minimum_purchase_amount, maximum_discount_amount, usage_limit, usage_limit_per_customer, usage_count, starts_at, expires_at, is_active, applies_to, product_ids, category_ids, created_at, updated_at'
      )
      .eq('merchant_id', merchantId)
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
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant (supports owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'marketing', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const body = await request.json();

    // Validate request body
    const parseResult = createDiscountCodeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid discount code data',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Create discount code
    const discountCodeData = {
      merchant_id: merchantId,
      ...parseResult.data,
    };

    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .insert(discountCodeData)
      .select(
        'id, merchant_id, code, description, discount_type, discount_value, minimum_purchase_amount, maximum_discount_amount, usage_limit, usage_limit_per_customer, usage_count, starts_at, expires_at, is_active, applies_to, product_ids, category_ids, created_at, updated_at'
      )
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
