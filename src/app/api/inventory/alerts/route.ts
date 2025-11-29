import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Inventory Alerts API
 *
 * GET - List all active alerts
 * PATCH - Acknowledge/resolve alerts
 *
 * Query params (GET):
 * - status: 'active' | 'acknowledged' | 'resolved' (default: 'active')
 * - type: 'low_stock' | 'out_of_stock' | 'predicted_stockout' | 'reorder_point'
 */

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const alertType = searchParams.get('type');

    let query = supabase
      .from('inventory_alerts')
      .select(`
        *,
        products (
          id,
          name,
          image,
          stock,
          low_stock_threshold
        )
      `)
      .eq('merchant_id', merchant.id)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (alertType) {
      query = query.eq('alert_type', alertType);
    }

    const { data: alerts, error } = await query;

    if (error) {
      console.error('Error fetching alerts:', error);
      return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }

    // Count by type
    const { data: typeCounts } = await supabase
      .from('inventory_alerts')
      .select('alert_type')
      .eq('merchant_id', merchant.id)
      .eq('status', 'active');

    const alertsByType: Record<string, number> = {};
    (typeCounts || []).forEach(item => {
      alertsByType[item.alert_type] = (alertsByType[item.alert_type] || 0) + 1;
    });

    return NextResponse.json({
      alerts,
      stats: {
        total: alerts?.length || 0,
        byType: alertsByType,
      },
    });
  } catch (error) {
    console.error('Alerts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const body = await request.json();
    const { alertIds, action } = body;

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      return NextResponse.json(
        { error: 'alertIds array is required' },
        { status: 400 }
      );
    }

    if (!['acknowledge', 'resolve'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "acknowledge" or "resolve"' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (action === 'acknowledge') {
      updates.status = 'acknowledged';
      updates.acknowledged_at = new Date().toISOString();
      updates.acknowledged_by = user.id;
    } else if (action === 'resolve') {
      updates.status = 'resolved';
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('inventory_alerts')
      .update(updates)
      .in('id', alertIds)
      .eq('merchant_id', merchant.id);

    if (error) {
      console.error('Error updating alerts:', error);
      return NextResponse.json({ error: 'Failed to update alerts' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated: alertIds.length,
    });
  } catch (error) {
    console.error('Alerts PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
