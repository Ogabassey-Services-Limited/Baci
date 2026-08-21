import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { parseRequestedMerchantId } from '@/app/api/branches/branch-route-utils';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedMerchant = parseRequestedMerchantId(_request);
    if (requestedMerchant.response) {
      return requestedMerchant.response;
    }

    // Get merchant (supports owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: requestedMerchant.merchantId,
    });
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'settings', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Get preferences
    const { data: preferences, error } = await supabase
      .from('dashboard_preferences')
      .select('layout_config, visible_cards')
      .eq('merchant_id', merchantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned"
      console.error('Error fetching dashboard preferences:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }

    // Return default if no preferences found
    if (!preferences) {
      return NextResponse.json({
        layout_config: [],
        visible_cards: [
          'revenue',
          'orders',
          'customers',
          'products',
          'sales_by_channel',
          'top_products',
        ],
      });
    }

    return NextResponse.json(preferences);
  } catch (error) {
    console.error('Error in dashboard preferences API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
      );
    }

    const body = await request.json();
    const { layout_config, visible_cards } = body;

    const requestedMerchant = parseRequestedMerchantId(request);
    if (requestedMerchant.response) {
      return requestedMerchant.response;
    }

    // Get merchant (supports owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: requestedMerchant.merchantId,
    });
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Upsert preferences
    const { data, error } = await supabase
      .from('dashboard_preferences')
      .upsert(
        {
          merchant_id: merchantId,
          layout_config: layout_config || [],
          visible_cards: visible_cards,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'merchant_id',
        }
      )
      .select('layout_config, visible_cards')
      .single();

    if (error) {
      console.error('Error saving dashboard preferences:', error);
      return NextResponse.json(
        { error: 'Failed to save preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in dashboard preferences API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
