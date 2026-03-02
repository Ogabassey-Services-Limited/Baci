import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { loyaltyRedeemSchema } from '@/schemas/loyalty-redeem';

// POST - Redeem a reward
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the customer FIRST
    const auth = await authenticateApiRequest(request);

    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, supabase } = auth;

    // 2. Validate request body with Zod
    const body = await request.json();
    const result = loyaltyRedeemSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { merchant_id, customer_id, reward_id } = result.data;

    // 3. Verify the merchant exists
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('id', merchant_id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // 4. Verify the authenticated user owns this customer record
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .eq('merchant_id', merchant_id)
      .eq('user_id', user.id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found or unauthorized' },
        { status: 403 }
      );
    }

    // 5. Get the reward details
    const { data: reward, error: rewardError } = await supabase
      .from('loyalty_rewards')
      .select(
        'id, name, points_required, reward_type, discount_value, discount_type, min_tier, active'
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

    // 6. Get customer's loyalty data
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

    // 7. Check if customer has enough points
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

    // 8. Check tier restriction if applicable
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

    // 9. Generate redemption code
    const redemptionCode = `RDM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Calculate expiry date (30 days from now by default)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 10. Create redemption record
    const { data: redemption, error: redemptionError } = await supabase
      .from('reward_redemptions')
      .insert({
        merchant_id,
        customer_id,
        reward_id,
        points_spent: reward.points_required,
        redemption_code: redemptionCode,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (redemptionError) {
      console.error('Error creating redemption:', redemptionError);
      return NextResponse.json(
        { error: 'Failed to process redemption' },
        { status: 500 }
      );
    }

    // 11. Deduct points from customer
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

    // 12. Record points transaction
    await supabase.from('points_transactions').insert({
      merchant_id,
      customer_id,
      points: -reward.points_required,
      type: 'redemption',
      description: `Redeemed: ${reward.name}`,
      reference_id: redemption.id,
    });

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
