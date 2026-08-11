import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { walletSettingsSchema } from '@/schemas/wallet';

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

    // Get merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'analytics', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // Reading a wallet must not initialize one: an otherwise harmless GET was
    // previously a staff-reachable write through a SECURITY DEFINER RPC.
    const { data: walletSummary, error: summaryError } = await supabase.rpc(
      'get_wallet_summary',
      { p_merchant_id: merchantId }
    );

    if (summaryError) {
      console.error('Failed to get wallet summary:', summaryError);
      return NextResponse.json(
        { error: 'Failed to get wallet summary' },
        { status: 500 }
      );
    }

    const summary = walletSummary?.[0];
    if (!summary) {
      // A newly created merchant may not have a wallet row yet. Keep this
      // read-only endpoint usable without initializing one as a side effect.
      return NextResponse.json({
        wallet: {
          id: null,
          availableBalance: 0,
          pendingBalance: 0,
          upcomingBalance: 0,
          upcomingCount: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          autoPayoutEnabled: true,
          autoPayoutDay: 'monday',
          minPayoutAmount: 1000,
          lastPayoutAt: null,
          lastPayoutAmount: null,
          canWithdraw: false,
          nextSettlementDate: null,
          nextSettlementAmount: null,
        },
        pendingSettlements: [],
      });
    }

    // PERFORMANCE: Use Promise.all to fetch independent queries concurrently
    const [{ data: pendingSettlements }, { data: walletSettings }] =
      await Promise.all([
        // Get pending settlements for detailed view
        supabase
          .from('merchant_settlements')
          .select(
            'id, net_amount, gateway, source_type, expected_settlement_date, description'
          )
          .eq('merchant_id', merchantId)
          .eq('status', 'pending')
          .order('expected_settlement_date', { ascending: true })
          .limit(10),

        // Get wallet settings
        supabase
          .from('merchant_wallets')
          .select(
            'auto_payout_enabled, auto_payout_day, min_payout_amount, last_payout_at, last_payout_amount'
          )
          .eq('id', summary.wallet_id)
          .single(),
      ]);

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
        // Manual payouts are intentionally disabled until the payout worker
        // can reserve funds and reconcile provider outcomes. Keep every
        // consumer aligned with /api/payouts/request, which is fail-closed.
        canWithdraw: false,
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

    // CSRF protection - prevents cross-site request forgery attacks
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    // Get merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;
    if (!merchantContext.staffAccess.isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate input
    const parsed = walletSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { autoPayoutEnabled, autoPayoutDay, minPayoutAmount } = parsed.data;

    // Build update object
    const updates: Record<string, unknown> = {};
    if (typeof autoPayoutEnabled === 'boolean') {
      updates.auto_payout_enabled = autoPayoutEnabled;
    }
    if (autoPayoutDay) {
      updates.auto_payout_day = autoPayoutDay;
    }
    if (typeof minPayoutAmount === 'number') {
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
      .eq('merchant_id', merchantId);

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
