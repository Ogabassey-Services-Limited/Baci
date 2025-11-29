import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';

/**
 * Loyalty Reward Redemption API (Storefront)
 *
 * POST - Redeem a reward for the customer
 *
 * Body:
 * - merchantId: string (required)
 * - email: string (required) - Customer's email
 * - rewardId: string (required) - The reward to redeem
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantId, email, rewardId } = body;

    if (!merchantId || !email || !rewardId) {
      return NextResponse.json(
        { error: 'merchantId, email, and rewardId are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get loyalty settings and verify enabled
    const { data: settings } = await supabase
      .from('loyalty_settings')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();

    if (!settings?.enabled) {
      return NextResponse.json(
        { error: 'Loyalty program is not enabled' },
        { status: 400 }
      );
    }

    // Get the customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('merchant_id', merchantId)
      .eq('email', email.toLowerCase())
      .single();

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get customer's loyalty data
    const { data: loyalty } = await supabase
      .from('customer_loyalty')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('customer_id', customer.id)
      .single();

    if (!loyalty) {
      return NextResponse.json(
        { error: 'Customer is not enrolled in loyalty program' },
        { status: 400 }
      );
    }

    // Get the reward
    const { data: reward } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('id', rewardId)
      .eq('merchant_id', merchantId)
      .eq('enabled', true)
      .single();

    if (!reward) {
      return NextResponse.json(
        { error: 'Reward not found or not available' },
        { status: 404 }
      );
    }

    // Check if reward is within valid date range
    const now = new Date();
    if (reward.start_date && new Date(reward.start_date) > now) {
      return NextResponse.json(
        { error: 'This reward is not yet available' },
        { status: 400 }
      );
    }
    if (reward.end_date && new Date(reward.end_date) < now) {
      return NextResponse.json(
        { error: 'This reward has expired' },
        { status: 400 }
      );
    }

    // Check if customer has enough points
    if (loyalty.points_balance < reward.points_cost) {
      return NextResponse.json(
        {
          error: 'Insufficient points',
          required: reward.points_cost,
          available: loyalty.points_balance,
        },
        { status: 400 }
      );
    }

    // Check stock
    if (reward.stock_quantity !== null && reward.stock_quantity <= 0) {
      return NextResponse.json(
        { error: 'This reward is out of stock' },
        { status: 400 }
      );
    }

    // Check usage limit per customer
    if (reward.usage_limit_per_customer) {
      const { count } = await supabase
        .from('reward_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customer.id)
        .eq('reward_id', rewardId);

      if (count && count >= reward.usage_limit_per_customer) {
        return NextResponse.json(
          { error: 'You have reached the redemption limit for this reward' },
          { status: 400 }
        );
      }
    }

    // Deduct points
    const newBalance = loyalty.points_balance - reward.points_cost;
    const { error: updateError } = await supabase
      .from('customer_loyalty')
      .update({
        points_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loyalty.id);

    if (updateError) {
      console.error('Error deducting points:', updateError);
      return NextResponse.json(
        { error: 'Failed to process redemption' },
        { status: 500 }
      );
    }

    // Create redemption record
    const redemptionCode = `RWD-${nanoid(8).toUpperCase()}`;
    const { data: redemption, error: redemptionError } = await supabase
      .from('reward_redemptions')
      .insert({
        customer_id: customer.id,
        merchant_id: merchantId,
        reward_id: rewardId,
        points_spent: reward.points_cost,
        redemption_code: redemptionCode,
        status: reward.reward_type === 'store_credit' ? 'fulfilled' : 'pending',
        reward_data: {
          name: reward.name,
          type: reward.reward_type,
          value: reward.reward_value,
          product_id: reward.reward_product_id,
        },
      })
      .select()
      .single();

    if (redemptionError) {
      console.error('Error creating redemption:', redemptionError);
      // Refund points on failure
      await supabase
        .from('customer_loyalty')
        .update({ points_balance: loyalty.points_balance })
        .eq('id', loyalty.id);
      return NextResponse.json(
        { error: 'Failed to create redemption record' },
        { status: 500 }
      );
    }

    // Record points transaction
    await supabase.from('points_transactions').insert({
      customer_id: customer.id,
      merchant_id: merchantId,
      type: 'redeem',
      points: -reward.points_cost,
      balance_after: newBalance,
      source: 'reward_redemption',
      description: `Redeemed: ${reward.name}`,
      reference_id: redemption?.id,
    });

    // Update reward stock if applicable
    if (reward.stock_quantity !== null) {
      await supabase
        .from('loyalty_rewards')
        .update({ stock_quantity: reward.stock_quantity - 1 })
        .eq('id', rewardId);
    }

    // If reward type is store_credit, add to customer's store credit
    if (reward.reward_type === 'store_credit' && reward.reward_value) {
      const { data: currentCustomer } = await supabase
        .from('customers')
        .select('store_credit')
        .eq('id', customer.id)
        .single();

      await supabase
        .from('customers')
        .update({
          store_credit: (currentCustomer?.store_credit || 0) + reward.reward_value,
        })
        .eq('id', customer.id);
    }

    // Generate response based on reward type
    let rewardDetails = {};
    switch (reward.reward_type) {
      case 'discount_percentage':
        rewardDetails = {
          type: 'discount',
          discountType: 'percentage',
          value: reward.reward_value,
          code: redemptionCode,
          minimumOrderAmount: reward.minimum_order_amount,
        };
        break;
      case 'discount_fixed':
        rewardDetails = {
          type: 'discount',
          discountType: 'fixed',
          value: reward.reward_value,
          code: redemptionCode,
          minimumOrderAmount: reward.minimum_order_amount,
        };
        break;
      case 'free_shipping':
        rewardDetails = {
          type: 'free_shipping',
          code: redemptionCode,
          minimumOrderAmount: reward.minimum_order_amount,
        };
        break;
      case 'free_product':
        rewardDetails = {
          type: 'free_product',
          productId: reward.reward_product_id,
          code: redemptionCode,
        };
        break;
      case 'store_credit':
        rewardDetails = {
          type: 'store_credit',
          amount: reward.reward_value,
          appliedImmediately: true,
        };
        break;
    }

    return NextResponse.json({
      success: true,
      redemption: {
        id: redemption?.id,
        code: redemptionCode,
        reward: reward.name,
        pointsSpent: reward.points_cost,
        newBalance,
        details: rewardDetails,
      },
    });
  } catch (error) {
    console.error('Reward redemption error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
