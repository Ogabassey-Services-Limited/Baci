/**
 * Customer Wallet API
 * GET /api/storefront/customer/wallet - Get customer's wallet balance and recent transactions
 *
 * 2025 Best Practices:
 * - Progressive disclosure: Only show wallet if balance > 0
 * - Real-time balance for checkout
 * - Transaction history for transparency
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantSlug = searchParams.get('merchant');

    if (!merchantSlug) {
      return NextResponse.json(
        { error: 'Merchant slug is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', balance: 0, transactions: [] },
        { status: 401 }
      );
    }

    // Get merchant
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

    // Get customer record for this user + merchant
    // Try by user_id first, then fallback to email (guest customers may not have user_id linked)
    let customer = null;

    // First try by user_id (for customers who registered/logged in)
    const { data: customerByUserId } = await supabase
      .from('customers')
      .select('id')
      .eq('merchant_id', merchant.id)
      .eq('user_id', user.id)
      .single();

    if (customerByUserId) {
      customer = customerByUserId;
    } else if (user.email) {
      // Fallback: try by email (for customers created as guests who later logged in)
      const { data: customerByEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('merchant_id', merchant.id)
        .eq('email', user.email)
        .single();

      if (customerByEmail) {
        customer = customerByEmail;

        // Link user_id to customer record for future lookups (don't wait for completion)
        void supabase
          .from('customers')
          .update({ user_id: user.id })
          .eq('id', customerByEmail.id);
      }
    }

    if (!customer) {
      // Customer doesn't exist yet - return zero balance
      return NextResponse.json({
        balance: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        transactions: [],
        hasWallet: false,
      });
    }

    // Get customer wallet
    const { data: wallet, error: walletError } = await supabase
      .from('customer_wallets')
      .select('id, available_balance, total_earned, total_redeemed')
      .eq('customer_id', customer.id)
      .eq('merchant_id', merchant.id)
      .single();

    if (walletError || !wallet) {
      // No wallet yet - return zero balance
      return NextResponse.json({
        balance: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        transactions: [],
        hasWallet: false,
      });
    }

    // Get recent transactions (last 10)
    const { data: transactions } = await supabase
      .from('customer_wallet_transactions')
      .select('id, type, amount, balance_after, description, created_at')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      balance: Number(wallet.available_balance) || 0,
      totalEarned: Number(wallet.total_earned) || 0,
      totalRedeemed: Number(wallet.total_redeemed) || 0,
      transactions: transactions || [],
      hasWallet: true,
    });
  } catch (error) {
    console.error('Customer wallet fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet', balance: 0, transactions: [] },
      { status: 500 }
    );
  }
}
