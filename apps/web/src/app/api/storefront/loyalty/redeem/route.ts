import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - Redeem a reward
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchant_id, customer_id, reward_id } = body;

    if (!merchant_id || !customer_id || !reward_id) {
      return NextResponse.json(
        { error: 'merchant_id, customer_id, and reward_id are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get the reward details
    const { data: reward, error: rewardError } = await supabase
      .from('loyalty_rewards')
      .select(
        'id, name, reward_type, discount_value, discount_type, points_required, min_tier, active'
      )
      .eq('id', reward_id)
      .eq('merchant_id', merchant_id)
      .eq('active', true)
      .single();

    if (rewardError || !reward) {
      return NextResponse.json(
        { error: 'Reward not found or no longer available' },
        { status: 404 }
      );
    }

    // Get customer's loyalty data
    const { data: loyalty, error: loyaltyError } = await supabase
      .from('customer_loyalty')
      .select('id, points_balance, tier')
      .eq('merchant_id', merchant_id)
      .eq('customer_id', customer_id)
      .single();

    if (loyaltyError || !loyalty) {
      return NextResponse.json(
        { error: 'Customer is not enrolled in the loyalty program' },
        { status: 404 }
      );
    }

    // Check if customer has enough points
    if (loyalty.points_balance < reward.points_required) {
      return NextResponse.json(
        {
          error: 'Insufficient points',
          required: reward.points_required,
          available: loyalty.points_balance,
        },
        { status: 400 }
      );
    }

    // Check tier restriction if applicable
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    if (reward.min_tier) {
      const customerTierIndex = tierOrder.indexOf(loyalty.tier);
      const requiredTierIndex = tierOrder.indexOf(reward.min_tier);
      if (customerTierIndex < requiredTierIndex) {
        return NextResponse.json(
          {
            error: `This reward requires ${reward.min_tier} tier or higher`,
            customer_tier: loyalty.tier,
            required_tier: reward.min_tier,
          },
          { status: 400 }
        );
      }
    }

    // Generate redemption code
    const redemptionCode = `RDM-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`;

    // Calculate expiry date (30 days from now by default)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create redemption record
    const { data: redemption, error: redemptionError } = await supabase
      .from('reward_redemptions')
      .insert({
        merchant_id,
        customer_id,
        reward_id,
        points_spent: reward.points_required,
        discount_code: redemptionCode,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (redemptionError) {
      console.error('Error creating redemption:', redemptionError);
      return NextResponse.json(
        { error: 'Failed to process redemption' },
        { status: 500 }
      );
    }

    // Deduct points from customer
    const newBalance = loyalty.points_balance - reward.points_required;
    const { error: updateError } = await supabase
      .from('customer_loyalty')
      .update({
        points_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loyalty.id)
      .eq('merchant_id', merchant_id);

    if (updateError) {
      console.error('Error updating points balance:', updateError);
      // Rollback redemption
      await supabase
        .from('reward_redemptions')
        .delete()
        .eq('id', redemption.id)
        .eq('merchant_id', merchant_id);
      return NextResponse.json(
        { error: 'Failed to deduct points' },
        { status: 500 }
      );
    }

    // Record points transaction
    const { error: insertTxError } = await supabase
      .from('points_transactions')
      .insert({
        merchant_id,
        customer_id,
        points: -reward.points_required,
        type: 'redemption',
        description: `Redeemed: ${reward.name}`,
        reference_id: redemption.id,
      });
    if (insertTxError) {
      console.error('Error recording points transaction:', insertTxError);
      return NextResponse.json(
        { error: 'Failed to record points transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reward redeemed successfully',
      data: {
        redemption_code: redemptionCode,
        reward_name: reward.name,
        reward_type: reward.reward_type,
        discount_value: reward.discount_value,
        discount_type: reward.discount_type,
        points_spent: reward.points_required,
        new_balance: newBalance,
        expires_at: expiresAt.toISOString(),
        instructions: getRedemptionInstructions(reward),
      },
    });
  } catch (error) {
    console.error('Error in reward redemption:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getRedemptionInstructions(reward: {
  reward_type: string;
  discount_type?: string;
  discount_value?: number;
}): string {
  switch (reward.reward_type) {
    case 'discount':
      if (reward.discount_type === 'percentage') {
        return `Apply this code at checkout to receive ${reward.discount_value}% off your order.`;
      }
      return `Apply this code at checkout to receive ₦${reward.discount_value?.toLocaleString()} off your order.`;
    case 'free_shipping':
      return 'Apply this code at checkout to receive free shipping on your order.';
    case 'free_product':
      return 'Present this code to claim your free product. Contact the store for details.';
    case 'exclusive_access':
      return 'This code grants you early access to new products and exclusive sales.';
    default:
      return 'Apply this code at checkout or present it in-store to redeem your reward.';
  }
}
