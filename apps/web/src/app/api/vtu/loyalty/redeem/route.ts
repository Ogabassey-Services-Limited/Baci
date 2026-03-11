import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  formatPhoneNumber,
  generateRequestRef,
  isValidPhoneNumber,
  purchaseAirtime,
} from '@/lib/kuda';
import { createClient } from '@/lib/supabase/server';
import { loyaltyRedeemSchema } from '@/schemas/vtu';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const csrfResult = await checkCsrfProtection(request);
    if (!csrfResult.valid) {
      return (
        csrfResult.response ??
        NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
      );
    }

    const body = await request.json();
    const parseResult = loyaltyRedeemSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { rewardId, phoneNumber, networkProvider } = parseResult.data;

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!isValidPhoneNumber(formattedPhone))
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      );

    const { data: reward, error: rewardError } = await supabase
      .from('loyalty_airtime_rewards')
      .select(
        'merchant_id, name, points_required, airtime_amount, network_provider, max_total_redemptions, total_redemptions'
      )
      .eq('id', rewardId)
      .eq('is_active', true)
      .single();

    if (rewardError || !reward)
      return NextResponse.json(
        { error: 'Reward not found or inactive' },
        { status: 404 }
      );

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

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, loyalty_points')
      .eq('email', user.email)
      .eq('merchant_id', reward.merchant_id)
      .single();

    if (customerError || !customer)
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );

    if ((customer.loyalty_points || 0) < reward.points_required) {
      return NextResponse.json(
        {
          error: `Insufficient points. You have ${customer.loyalty_points || 0} points, need ${reward.points_required}`,
        },
        { status: 400 }
      );
    }

    if (
      reward.max_total_redemptions &&
      reward.total_redemptions >= reward.max_total_redemptions
    ) {
      return NextResponse.json(
        { error: 'This reward has reached its maximum redemption limit' },
        { status: 400 }
      );
    }

    const newBalance = (customer.loyalty_points || 0) - reward.points_required;
    const requestRef = generateRequestRef();
    const successMessage = `₦${reward.airtime_amount} airtime sent to ${formattedPhone}`;
    const rewardMetadata = {
      reward_id: rewardId,
      reward_name: reward.name,
      points_redeemed: reward.points_required,
    };
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
        metadata: rewardMetadata,
      })
      .select('id')
      .single();

    if (txError) {
      console.error('Failed to create transaction record:', txError);
      return NextResponse.json(
        { error: 'Failed to initiate redemption' },
        { status: 500 }
      );
    }

    const result = await purchaseAirtime(
      formattedPhone,
      reward.airtime_amount,
      networkProvider
    );

    if (!result.success) {
      await supabase
        .from('vtu_transactions')
        .update({
          status: 'failed',
          error_message: result.message,
        })
        .eq('id', transaction.id);

      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    await supabase
      .from('vtu_transactions')
      .update({
        status: 'successful',
        transaction_id: result.transactionId,
      })
      .eq('id', transaction.id);

    const persistReconciliationWarning = async (
      warning: string,
      pendingType: 'loyalty_points' | 'reward_redemption_count',
      details: Record<string, unknown>
    ) => {
      const { error } = await supabase
        .from('vtu_transactions')
        .update({
          error_message: warning,
          metadata: {
            ...rewardMetadata,
            reconciliation_pending: pendingType,
            customer_id: customer.id,
            ...details,
          },
        })
        .eq('id', transaction.id);

      if (error) {
        console.error(
          `Failed to persist ${pendingType} reconciliation marker`,
          {
            customerId: customer.id,
            rewardId,
            error,
          }
        );
      }
    };

    const { error: pointsUpdateError } = await supabase
      .from('customers')
      .update({
        loyalty_points: newBalance,
      })
      .eq('id', customer.id);

    if (pointsUpdateError) {
      console.error('Failed to deduct loyalty points after airtime purchase', {
        customerId: customer.id,
        rewardId,
        error: pointsUpdateError,
      });

      const reconciliationWarning =
        'Airtime sent, but loyalty points deduction is pending reconciliation.';

      await persistReconciliationWarning(
        reconciliationWarning,
        'loyalty_points',
        { intended_balance: newBalance }
      );

      return NextResponse.json({
        success: true,
        message: successMessage,
        warning: reconciliationWarning,
        reconciliationPending: true,
        reference: requestRef,
      });
    }

    const { error: rewardUpdateError } = await supabase
      .from('loyalty_airtime_rewards')
      .update({
        total_redemptions: (reward.total_redemptions || 0) + 1,
      })
      .eq('id', rewardId);

    if (rewardUpdateError) {
      console.error('Failed to update reward redemption count', {
        customerId: customer.id,
        rewardId,
        error: rewardUpdateError,
      });

      const reconciliationWarning =
        'Airtime sent and points deducted, but reward redemption count update is pending reconciliation.';

      await persistReconciliationWarning(
        reconciliationWarning,
        'reward_redemption_count',
        { new_balance: newBalance }
      );

      return NextResponse.json({
        success: true,
        message: successMessage,
        warning: reconciliationWarning,
        reconciliationPending: true,
        pointsDeducted: reward.points_required,
        newBalance,
        reference: requestRef,
      });
    }

    const { error: logError } = await supabase
      .from('points_transactions')
      .insert({
        customer_id: customer.id,
        merchant_id: reward.merchant_id,
        type: 'redeem',
        points: -reward.points_required,
        balance_after: newBalance,
        source: 'redemption',
        description: `Redeemed ${reward.points_required} points for ₦${reward.airtime_amount} airtime`,
        metadata: {
          reward_type: 'airtime',
          reward_id: rewardId,
          phone_number: formattedPhone,
          network_provider: networkProvider,
          vtu_transaction_id: transaction.id,
        },
      });

    if (logError) {
      console.error('Failed to log points transaction after redemption', {
        customerId: customer.id,
        rewardId,
        error: logError,
      });
    }

    return NextResponse.json({
      success: true,
      message: successMessage,
      pointsDeducted: reward.points_required,
      newBalance,
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
