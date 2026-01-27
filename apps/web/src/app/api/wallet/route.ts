import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/wallet
 * Get merchant wallet balance and info
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get or create wallet
    await supabase.rpc('get_or_create_merchant_wallet', {
      p_merchant_id: merchant.id,
    });

    // Get wallet details with summary (includes upcoming settlements)
    const { data: walletSummary, error: summaryError } = await supabase.rpc(
      'get_wallet_summary',
      { p_merchant_id: merchant.id }
    );

    // Fallback to basic wallet if function doesn't exist yet
    if (summaryError) {
      const { data: wallet, error: walletError } = await supabase
        .from('merchant_wallets')
        .select('*')
        .eq('merchant_id', merchant.id)
        .single();

      if (walletError) {
        console.error('Failed to get wallet:', walletError);
        return NextResponse.json(
          { error: 'Failed to get wallet' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        wallet: {
          id: wallet.id,
          availableBalance: Number(wallet.available_balance),
          pendingBalance: Number(wallet.pending_balance),
          upcomingBalance: Number(wallet.upcoming_balance || 0),
          upcomingCount: wallet.upcoming_count || 0,
          totalEarned: Number(wallet.total_earned),
          totalWithdrawn: Number(wallet.total_withdrawn),
          autoPayoutEnabled: wallet.auto_payout_enabled,
          autoPayoutDay: wallet.auto_payout_day,
          minPayoutAmount: Number(wallet.min_payout_amount),
          lastPayoutAt: wallet.last_payout_at,
          lastPayoutAmount: wallet.last_payout_amount
            ? Number(wallet.last_payout_amount)
            : null,
          canWithdraw: Number(wallet.available_balance) >= 1000,
          nextSettlementDate: null,
          nextSettlementAmount: null,
        },
      });
    }

    const summary = walletSummary?.[0];
    if (!summary) {
      return NextResponse.json(
        { error: 'Failed to get wallet summary' },
        { status: 500 }
      );
    }

    // Get pending settlements for detailed view
    const { data: pendingSettlements } = await supabase
      .from('merchant_settlements')
      .select(
        'id, net_amount, gateway, source_type, expected_settlement_date, description'
      )
      .eq('merchant_id', merchant.id)
      .eq('status', 'pending')
      .order('expected_settlement_date', { ascending: true })
      .limit(10);

    // Get wallet settings
    const { data: walletSettings } = await supabase
      .from('merchant_wallets')
      .select(
        'auto_payout_enabled, auto_payout_day, min_payout_amount, last_payout_at, last_payout_amount'
      )
      .eq('id', summary.wallet_id)
      .single();

    return NextResponse.json({
      wallet: {
        id: summary.wallet_id,
        availableBalance: Number(summary.available_balance),
        pendingBalance: Number(summary.pending_balance),
        upcomingBalance: Number(summary.upcoming_balance),
        upcomingCount: summary.upcoming_count,
        totalEarned: Number(summary.total_earned),
        totalWithdrawn: Number(summary.total_withdrawn),
        autoPayoutEnabled: walletSettings?.auto_payout_enabled ?? true,
        autoPayoutDay: walletSettings?.auto_payout_day ?? 'monday',
        minPayoutAmount: Number(walletSettings?.min_payout_amount || 1000),
        lastPayoutAt: walletSettings?.last_payout_at,
        lastPayoutAmount: walletSettings?.last_payout_amount
          ? Number(walletSettings.last_payout_amount)
          : null,
        canWithdraw: summary.can_withdraw,
        nextSettlementDate: summary.next_settlement_date,
        nextSettlementAmount: summary.next_settlement_amount
          ? Number(summary.next_settlement_amount)
          : null,
      },
      pendingSettlements: (pendingSettlements || []).map((s) => ({
        id: s.id,
        amount: Number(s.net_amount),
        gateway: s.gateway,
        sourceType: s.source_type,
        expectedDate: s.expected_settlement_date,
        description: s.description,
      })),
    });
  } catch (error) {
    console.error('Wallet fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/wallet
 * Update wallet settings (auto-payout preferences)
 */
export async function PATCH(request: NextRequest) {
  // CSRF protection - prevents cross-site request forgery attacks
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const body = await request.json();
    const { autoPayoutEnabled, autoPayoutDay, minPayoutAmount } = body;

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (typeof autoPayoutEnabled === 'boolean') {
      updates.auto_payout_enabled = autoPayoutEnabled;
    }
    if (autoPayoutDay) {
      const validDays = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ];
      if (validDays.includes(autoPayoutDay.toLowerCase())) {
        updates.auto_payout_day = autoPayoutDay.toLowerCase();
      }
    }
    if (typeof minPayoutAmount === 'number' && minPayoutAmount >= 100) {
      updates.min_payout_amount = minPayoutAmount;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    // Update wallet settings
    const { error: updateError } = await supabase
      .from('merchant_wallets')
      .update(updates)
      .eq('merchant_id', merchant.id);

    if (updateError) {
      console.error('Failed to update wallet settings:', updateError);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Wallet settings updated',
    });
  } catch (error) {
    console.error('Wallet update error:', error);
    return NextResponse.json(
      { error: 'Failed to update wallet' },
      { status: 500 }
    );
  }
}
