import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

// GET /api/vtu/loyalty/rewards - Get available airtime rewards for a merchant
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

    // Get merchant by slug (public lookup, no auth required)
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get active airtime rewards
    const { data: rewards, error } = await supabase
      .from('loyalty_airtime_rewards')
      .select(
        'id, name, description, points_required, airtime_amount, network_provider, max_redemptions_per_customer, max_total_redemptions, total_redemptions, is_active'
      )
      .eq('merchant_id', merchant.id)
      .eq('is_active', true)
      .order('points_required', { ascending: true });

    if (error) {
      console.error('Failed to fetch airtime rewards:', error);
      return NextResponse.json(
        { error: 'Failed to fetch rewards' },
        { status: 500 }
      );
    }

    // Filter out rewards that have reached max redemptions
    const availableRewards =
      rewards?.filter((reward) => {
        if (reward.max_total_redemptions) {
          return reward.total_redemptions < reward.max_total_redemptions;
        }
        return true;
      }) || [];

    return NextResponse.json({
      rewards: availableRewards,
    });
  } catch (error) {
    console.error('Loyalty airtime rewards error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rewards' },
      { status: 500 }
    );
  }
}

// POST /api/vtu/loyalty/rewards - Create a new airtime reward (merchant only)
export async function POST(request: Request) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request as NextRequest);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Auth check
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
    if (!hasPermission(access, 'marketing', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const body = await request.json();
    const {
      name,
      description,
      points_required,
      airtime_amount,
      network_provider,
      max_redemptions_per_customer,
      max_total_redemptions,
    } = body;

    // Validate required fields
    if (!name || !points_required || !airtime_amount) {
      return NextResponse.json(
        { error: 'Name, points required, and airtime amount are required' },
        { status: 400 }
      );
    }

    // Validate amounts
    if (airtime_amount < 50 || airtime_amount > 10000) {
      return NextResponse.json(
        { error: 'Airtime amount must be between ₦50 and ₦10,000' },
        { status: 400 }
      );
    }

    if (points_required < 1) {
      return NextResponse.json(
        { error: 'Points required must be at least 1' },
        { status: 400 }
      );
    }

    // Create reward
    const { data: reward, error } = await supabase
      .from('loyalty_airtime_rewards')
      .insert({
        merchant_id: merchantId,
        name,
        description,
        points_required,
        airtime_amount,
        network_provider: network_provider || null,
        max_redemptions_per_customer: max_redemptions_per_customer || null,
        max_total_redemptions: max_total_redemptions || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create airtime reward:', error);
      return NextResponse.json(
        { error: 'Failed to create reward' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reward,
    });
  } catch (error) {
    console.error('Create airtime reward error:', error);
    return NextResponse.json(
      { error: 'Failed to create reward' },
      { status: 500 }
    );
  }
}

// PATCH /api/vtu/loyalty/rewards - Update an airtime reward
export async function PATCH(request: Request) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request as NextRequest);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Auth check
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
    if (!hasPermission(access, 'marketing', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Reward ID is required' },
        { status: 400 }
      );
    }

    // Only allow updating specific fields
    const allowedFields = [
      'name',
      'description',
      'points_required',
      'airtime_amount',
      'network_provider',
      'max_redemptions_per_customer',
      'max_total_redemptions',
      'is_active',
    ];

    const sanitizedUpdates: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    // Update reward
    const { data: reward, error } = await supabase
      .from('loyalty_airtime_rewards')
      .update(sanitizedUpdates)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update airtime reward:', error);
      return NextResponse.json(
        { error: 'Failed to update reward' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reward,
    });
  } catch (error) {
    console.error('Update airtime reward error:', error);
    return NextResponse.json(
      { error: 'Failed to update reward' },
      { status: 500 }
    );
  }
}

// DELETE /api/vtu/loyalty/rewards - Delete an airtime reward
export async function DELETE(request: Request) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request as NextRequest);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Auth check
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
    if (!hasPermission(access, 'marketing', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Reward ID is required' },
        { status: 400 }
      );
    }

    // Delete reward
    const { error } = await supabase
      .from('loyalty_airtime_rewards')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchantId);

    if (error) {
      console.error('Failed to delete airtime reward:', error);
      return NextResponse.json(
        { error: 'Failed to delete reward' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete airtime reward error:', error);
    return NextResponse.json(
      { error: 'Failed to delete reward' },
      { status: 500 }
    );
  }
}
