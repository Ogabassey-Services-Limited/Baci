import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

/**
 * Loyalty Rewards API
 *
 * GET - List all rewards (for merchants to manage)
 * POST - Create a new reward
 */

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;

    const { searchParams } = new URL(request.url);
    const includeDisabled = searchParams.get('includeDisabled') === 'true';

    let query = supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('points_cost', { ascending: true });

    if (!includeDisabled) {
      query = query.eq('enabled', true);
    }

    const { data: rewards, error } = await query;

    if (error) {
      console.error('Error fetching rewards:', error);
      return NextResponse.json(
        { error: 'Failed to fetch rewards' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rewards });
  } catch (error) {
    console.error('Rewards GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;

    const body = await request.json();
    const {
      name,
      description,
      image_url,
      points_cost,
      reward_type,
      reward_value,
      reward_product_id,
      enabled = true,
      stock_quantity,
      start_date,
      end_date,
      minimum_order_amount,
      usage_limit_per_customer,
    } = body;

    if (!name || !points_cost || !reward_type) {
      return NextResponse.json(
        { error: 'name, points_cost, and reward_type are required' },
        { status: 400 }
      );
    }

    const validTypes = [
      'discount_percentage',
      'discount_fixed',
      'free_shipping',
      'free_product',
      'store_credit',
    ];
    if (!validTypes.includes(reward_type)) {
      return NextResponse.json(
        { error: `reward_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: reward, error } = await supabase
      .from('loyalty_rewards')
      .insert({
        merchant_id: merchantId,
        name,
        description,
        image_url,
        points_cost,
        reward_type,
        reward_value,
        reward_product_id,
        enabled,
        stock_quantity,
        start_date,
        end_date,
        minimum_order_amount,
        usage_limit_per_customer,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating reward:', error);
      return NextResponse.json(
        { error: 'Failed to create reward' },
        { status: 500 }
      );
    }

    return NextResponse.json({ reward }, { status: 201 });
  } catch (error) {
    console.error('Rewards POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
