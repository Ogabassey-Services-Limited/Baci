import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Get customer's loyalty status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantId = searchParams.get('merchant_id');
    const customerId = searchParams.get('customer_id');

    if (!merchantId || !customerId) {
      return NextResponse.json(
        { error: 'merchant_id and customer_id are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get loyalty settings for this merchant
    const { data: settings, error: settingsError } = await supabase
      .from('loyalty_settings')
      .select(
        'id, merchant_id, enabled, points_per_naira, naira_per_point, welcome_bonus, referral_bonus_referrer, referral_bonus_referee, silver_threshold, gold_threshold, platinum_threshold'
      )
      .eq('merchant_id', merchantId)
      .single();

    if (settingsError || !settings || !settings.enabled) {
      return NextResponse.json(
        { error: 'Loyalty program not available for this merchant' },
        { status: 404 }
      );
    }

    // Get customer's loyalty data
    const { data: loyalty, error: loyaltyError } = await supabase
      .from('customer_loyalty')
      .select('id, points_balance, lifetime_points, tier')
      .eq('merchant_id', merchantId)
      .eq('customer_id', customerId)
      .single();

    if (loyaltyError && loyaltyError.code !== 'PGRST116') {
      console.error('Error fetching loyalty data:', loyaltyError);
      return NextResponse.json(
        { error: 'Failed to fetch loyalty data' },
        { status: 500 }
      );
    }

    // Get available rewards
    const { data: rewards, error: rewardsError } = await supabase
      .from('loyalty_rewards')
      .select(
        'id, name, description, reward_type, discount_value, discount_type, points_required, min_tier, active'
      )
      .eq('merchant_id', merchantId)
      .eq('active', true)
      .order('points_required', { ascending: true });

    if (rewardsError) {
      console.error('Error fetching rewards:', rewardsError);
    }

    // Get recent transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('points_transactions')
      .select('id, points, type, description, created_at')
      .eq('merchant_id', merchantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
    }

    // Calculate tier progress
    const currentPoints = loyalty?.points_balance || 0;
    const lifetimePoints = loyalty?.lifetime_points || 0;
    const currentTier = loyalty?.tier || 'bronze';

    // Tier thresholds
    const tierThresholds = {
      bronze: 0,
      silver: settings.silver_threshold || 500,
      gold: settings.gold_threshold || 2000,
      platinum: settings.platinum_threshold || 5000,
    };

    // Calculate next tier
    let nextTier: string | null = null;
    let pointsToNextTier = 0;

    if (currentTier === 'bronze') {
      nextTier = 'silver';
      pointsToNextTier = Math.max(0, tierThresholds.silver - lifetimePoints);
    } else if (currentTier === 'silver') {
      nextTier = 'gold';
      pointsToNextTier = Math.max(0, tierThresholds.gold - lifetimePoints);
    } else if (currentTier === 'gold') {
      nextTier = 'platinum';
      pointsToNextTier = Math.max(0, tierThresholds.platinum - lifetimePoints);
    }

    // Calculate redeemable rewards
    const redeemableRewards = (rewards || []).filter(
      (reward: { points_required: number }) =>
        reward.points_required <= currentPoints
    );

    return NextResponse.json({
      enrolled: !!loyalty,
      points_balance: currentPoints,
      lifetime_points: lifetimePoints,
      tier: currentTier,
      next_tier: nextTier,
      points_to_next_tier: pointsToNextTier,
      tier_thresholds: tierThresholds,
      available_rewards: rewards || [],
      redeemable_rewards: redeemableRewards,
      recent_transactions: transactions || [],
      settings: {
        points_per_naira: settings.points_per_naira,
        naira_per_point: settings.naira_per_point,
        welcome_bonus: settings.welcome_bonus,
        referral_bonus_referrer: settings.referral_bonus_referrer,
        referral_bonus_referee: settings.referral_bonus_referee,
      },
    });
  } catch (error) {
    console.error('Error in loyalty status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
