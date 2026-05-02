import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  formatPhoneNumber,
  generateRequestRef,
  isValidPhoneNumber,
  type NetworkProvider,
  purchaseAirtime,
} from '@/lib/kuda';
import { createClient } from '@/lib/supabase/server';

interface RedeemRequest {
  rewardId: string;
  phoneNumber: string;
  networkProvider: NetworkProvider;
}

// POST /api/vtu/loyalty/redeem - Redeem loyalty points for airtime
export async function POST(request: Request) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request as NextRequest);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const body: RedeemRequest = await request.json();
    const { rewardId, phoneNumber, networkProvider } = body;

    // Validate required fields
    if (!rewardId || !phoneNumber || !networkProvider) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!isValidPhoneNumber(formattedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the airtime reward
    const { data: reward, error: rewardError } = await supabase
      .from('loyalty_airtime_rewards')
      .select('*, merchants!inner(id, slug)')
      .eq('id', rewardId)
      .eq('is_active', true)
      .single();

    if (rewardError || !reward) {
      return NextResponse.json(
        { error: 'Reward not found or inactive' },
        { status: 404 }
      );
    }

    // Check if network provider matches (if reward has specific provider)
    if (
      reward.network_provider &&
      reward.network_provider !== networkProvider
    ) {
      return NextResponse.json(
        {
          error: `This reward can only be redeemed for ${reward.network_provider} airtime`,
        },
        { status: 400 }
      );
    }

    // Get customer's loyalty points
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, loyalty_points')
      .eq('email', user.email)
      .eq('merchant_id', reward.merchant_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if customer has enough points
    if ((customer.loyalty_points || 0) < reward.points_required) {
      return NextResponse.json(
        {
          error: `Insufficient points. You have ${customer.loyalty_points || 0} points, need ${reward.points_required}`,
        },
        { status: 400 }
      );
    }

    // Check redemption limits
    if (
      reward.max_total_redemptions &&
      reward.total_redemptions >= reward.max_total_redemptions
    ) {
      return NextResponse.json(
        { error: 'This reward has reached its maximum redemption limit' },
        { status: 400 }
      );
    }

    // Generate request reference
    const requestRef = generateRequestRef();

    // Create VTU transaction record
    const { data: transaction, error: txError } = await supabase
      .from('vtu_transactions')
      .insert({
        merchant_id: reward.merchant_id,
        customer_id: customer.id,
        type: 'airtime',
        network_provider: networkProvider,
        phone_number: formattedPhone,
        amount: reward.airtime_amount,
        request_reference: requestRef,
        status: 'pending',
        source: 'loyalty_reward',
        platform_commission: 0, // No commission on loyalty rewards
        merchant_commission: 0,
        metadata: {
          reward_id: rewardId,
          reward_name: reward.name,
          points_redeemed: reward.points_required,
        },
      })
      .select()
      .single();

    if (txError) {
      console.error('Failed to create transaction record:', txError);
      return NextResponse.json(
        { error: 'Failed to initiate redemption' },
        { status: 500 }
      );
    }

    // Execute the airtime purchase
    const result = await purchaseAirtime(
      formattedPhone,
      reward.airtime_amount,
      networkProvider,
      'Customer',
      requestRef
    );

    if (!result.success) {
      // Update transaction status to failed
      await supabase
        .from('vtu_transactions')
        .update({
          status: 'failed',
          error_message: result.message,
        })
        .eq('id', transaction.id);

      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Update transaction with success
    await supabase
      .from('vtu_transactions')
      .update({
        status: 'successful',
        transaction_id: result.transactionId,
      })
      .eq('id', transaction.id);

    // Deduct loyalty points from customer
    await supabase
      .from('customers')
      .update({
        loyalty_points: (customer.loyalty_points || 0) - reward.points_required,
      })
      .eq('id', customer.id);

    // Increment reward redemption count
    await supabase
      .from('loyalty_airtime_rewards')
      .update({
        total_redemptions: (reward.total_redemptions || 0) + 1,
      })
      .eq('id', rewardId);

    // Log the redemption in loyalty history
    const { error: insertTxError } = await supabase
      .from('loyalty_transactions')
      .insert({
        customer_id: customer.id,
        merchant_id: reward.merchant_id,
        type: 'redeemed',
        points: -reward.points_required,
        description: `Redeemed ${reward.points_required} points for ₦${reward.airtime_amount} airtime`,
        metadata: {
          reward_type: 'airtime',
          reward_id: rewardId,
          phone_number: formattedPhone,
          network_provider: networkProvider,
          vtu_transaction_id: transaction.id,
        },
      });
    if (insertTxError) {
      console.error('Error logging loyalty transaction:', insertTxError);
      return NextResponse.json(
        { error: 'Failed to log loyalty transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `₦${reward.airtime_amount} airtime sent to ${formattedPhone}`,
      pointsDeducted: reward.points_required,
      newBalance: (customer.loyalty_points || 0) - reward.points_required,
      reference: requestRef,
    });
  } catch (error) {
    console.error('Loyalty airtime redemption error:', error);
    return NextResponse.json(
      { error: 'Redemption failed. Please try again.' },
      { status: 500 }
    );
  }
}
