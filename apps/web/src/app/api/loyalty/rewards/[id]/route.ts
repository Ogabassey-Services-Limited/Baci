import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

/**
 * Single Reward API
 *
 * GET - Get a single reward
 * PATCH - Update a reward
 * DELETE - Delete a reward
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'marketing', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const { data: reward, error } = await supabase
      .from('loyalty_rewards')
      .select(
        'id, merchant_id, name, description, image_url, points_cost, reward_type, reward_value, reward_product_id, enabled, stock_quantity, start_date, end_date, minimum_order_amount, usage_limit_per_customer, created_at, updated_at'
      )
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    }

    return NextResponse.json({ reward });
  } catch (error) {
    console.error('Reward GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }
    const { id } = await params;

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'marketing', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const body = await request.json();
    const allowedFields = [
      'name',
      'description',
      'image_url',
      'points_cost',
      'reward_type',
      'reward_value',
      'reward_product_id',
      'enabled',
      'stock_quantity',
      'start_date',
      'end_date',
      'minimum_order_amount',
      'usage_limit_per_customer',
    ];

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data: reward, error } = await supabase
      .from('loyalty_rewards')
      .update(updates)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating reward:', error);
      return NextResponse.json(
        { error: 'Failed to update reward' },
        { status: 500 }
      );
    }

    return NextResponse.json({ reward });
  } catch (error) {
    console.error('Reward PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }
    const { id } = await params;

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'marketing', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const { error } = await supabase
      .from('loyalty_rewards')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchantId);

    if (error) {
      console.error('Error deleting reward:', error);
      return NextResponse.json(
        { error: 'Failed to delete reward' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reward DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
