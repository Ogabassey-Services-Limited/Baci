import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Customer Loyalty API (Storefront)
 *
 * GET - Get customer's loyalty status, points, tier, and available rewards
 *
 * Query params:
 * - merchantId: string (required) - The merchant's ID
 * - email: string (required) - Customer's email
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantId = searchParams.get('merchantId');
    const email = searchParams.get('email');

    if (!merchantId || !email) {
      return NextResponse.json(
        { error: 'merchantId and email are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get the customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('merchant_id', merchantId)
      .eq('email', email.toLowerCase())
      .single();

    if (customerError && customerError.code !== 'PGRST116') {
      console.error('Error fetching customer:', customerError);
      return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
    }

    if (!customer) {
      // Return empty loyalty data for new customers
      return NextResponse.json({
        isEnrolled: false,
        pointsBalance: 0,
        lifetimePoints: 0,
        currentTier: 'Bronze',
        referralCode: null,
        availableRewards: [],
        settings: null,
      });
    }

    // Get loyalty settings
    const { data: settings } = await supabase
      .from('loyalty_settings')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    // If loyalty is not enabled, return empty
    if (!settings?.enabled) {
      return NextResponse.json({
        isEnrolled: false,
        pointsBalance: 0,
        lifetimePoints: 0,
        currentTier: null,
        referralCode: null,
        availableRewards: [],
        settings: null,
        message: 'Loyalty program is not enabled for this store',
      });
    }

    // Get customer's loyalty data
    const { data: loyalty, error: loyaltyError } = await supabase
      .from('customer_loyalty')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('customer_id', customer.id)
      .single();

    if (loyaltyError && loyaltyError.code !== 'PGRST116') {
      console.error('Error fetching loyalty:', loyaltyError);
      return NextResponse.json({ error: 'Failed to fetch loyalty data' }, { status: 500 });
    }

    // Get available rewards (that the customer can afford or almost afford)
    const { data: rewards } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('enabled', true)
      .or(`start_date.is.null,start_date.lte.${new Date().toISOString()}`)
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`)
      .order('points_cost', { ascending: true });

    // Get recent transactions
    const { data: recentTransactions } = await supabase
      .from('points_transactions')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const pointsBalance = loyalty?.points_balance || 0;
    const lifetimePoints = loyalty?.lifetime_points || 0;
    const currentTier = loyalty?.current_tier || 'Bronze';

    // Calculate tier info from settings
    const tiers = settings.tiers || [];
    const currentTierInfo = tiers.find((t: { name: string }) => t.name === currentTier);
    const nextTier = tiers.find((t: { minPoints: number }) => t.minPoints > lifetimePoints);
    const pointsToNextTier = nextTier ? nextTier.minPoints - lifetimePoints : null;

    return NextResponse.json({
      isEnrolled: !!loyalty,
      pointsBalance,
      lifetimePoints,
      currentTier,
      currentTierInfo,
      nextTier: nextTier || null,
      pointsToNextTier,
      referralCode: loyalty?.referralCode || null,
      availableRewards: rewards || [],
      recentTransactions: recentTransactions || [],
      settings: {
        programName: settings.program_name,
        pointsPerCurrency: settings.points_per_currency,
        pointsCurrencyUnit: settings.points_currency_unit,
        pointsToCurrencyRatio: settings.points_to_currency_ratio,
        minimumRedemptionPoints: settings.minimum_redemption_points,
        maximumRedemptionPercentage: settings.maximum_redemption_percentage,
        tiers: settings.tiers,
      },
    });
  } catch (error) {
    console.error('Storefront loyalty GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
