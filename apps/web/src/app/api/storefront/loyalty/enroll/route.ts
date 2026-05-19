import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

// POST - Enroll a customer in loyalty program
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchant_id, customer_id, referral_code } = body;

    if (!merchant_id || !customer_id) {
      return NextResponse.json(
        { error: 'merchant_id and customer_id are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get loyalty settings
    const { data: settings, error: settingsError } = await supabase
      .from('loyalty_settings')
      .select(
        'id, merchant_id, enabled, welcome_bonus, referral_bonus_referee, referral_bonus_referrer'
      )
      .eq('merchant_id', merchant_id)
      .single();

    if (settingsError || !settings || !settings.enabled) {
      return NextResponse.json(
        { error: 'Loyalty program not available for this merchant' },
        { status: 404 }
      );
    }

    // Check if already enrolled
    const { data: existing, error: existingError } = await supabase
      .from('customer_loyalty')
      .select('id')
      .eq('merchant_id', merchant_id)
      .eq('customer_id', customer_id)
      .maybeSingle();

    if (existingError) {
      logger.error({
        message: 'Error checking existing enrollment',
        error: existingError,
      });
      return NextResponse.json(
        { error: 'Failed to verify enrollment status' },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Customer is already enrolled in the loyalty program' },
        { status: 409 }
      );
    }

    // Calculate initial bonus
    let initialPoints = settings.welcome_bonus || 0;

    // Handle referral if provided
    let referrerId: string | null = null;
    if (referral_code) {
      // Find the referrer by their referral code
      const { data: referrer, error: referrerError } = await supabase
        .from('customer_loyalty')
        .select('customer_id')
        .eq('merchant_id', merchant_id)
        .eq('referral_code', referral_code)
        .maybeSingle();

      if (referrerError) {
        logger.error({
          message: 'Error fetching referrer',
          error: referrerError,
        });
        return NextResponse.json(
          { error: 'Database error verifying referral code' },
          { status: 500 }
        );
      }

      if (referrer) {
        referrerId = referrer.customer_id;
        initialPoints += settings.referral_bonus_referee || 0;
      }
    }

    // Generate unique referral code for the new customer
    const newReferralCode = `${customer_id.substring(0, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;

    // Create loyalty record
    const { data: loyalty, error: createError } = await supabase
      .from('customer_loyalty')
      .insert({
        merchant_id,
        customer_id,
        points_balance: initialPoints,
        lifetime_points: initialPoints,
        tier: 'bronze',
        referral_code: newReferralCode,
        referred_by: referrerId,
      })
      .select()
      .single();

    if (createError) {
      logger.error({
        message: 'Error creating loyalty record',
        error: createError,
      });
      return NextResponse.json(
        { error: 'Failed to enroll in loyalty program' },
        { status: 500 }
      );
    }

    // Record welcome bonus transaction
    if (initialPoints > 0) {
      const { error: transactionError } = await supabase
        .from('points_transactions')
        .insert({
          merchant_id,
          customer_id,
          points: initialPoints,
          type: 'bonus',
          description: referral_code
            ? 'Welcome bonus + Referral bonus'
            : 'Welcome bonus',
        });

      if (transactionError) {
        logger.error({
          message: 'Error recording welcome bonus',
          error: transactionError,
        });
      }
    }

    // Award referrer bonus if applicable
    if (referrerId && settings.referral_bonus_referrer) {
      // Update referrer's points
      const { error: referrerUpdateError } = await supabase.rpc(
        'increment_loyalty_points',
        {
          p_merchant_id: merchant_id,
          p_customer_id: referrerId,
          p_points: settings.referral_bonus_referrer,
        }
      );

      if (referrerUpdateError) {
        logger.error({
          message: 'Error awarding referrer bonus',
          error: referrerUpdateError,
        });
      } else {
        // Record referrer transaction
        const { error: referrerTxError } = await supabase
          .from('points_transactions')
          .insert({
            merchant_id,
            customer_id: referrerId,
            points: settings.referral_bonus_referrer,
            type: 'referral',
            description: 'Referral bonus - new customer signup',
          });
        if (referrerTxError) {
          logger.error({
            message: 'Error recording referrer points transaction',
            error: referrerTxError,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully enrolled in loyalty program',
      data: {
        points_balance: loyalty.points_balance,
        tier: loyalty.tier,
        referral_code: loyalty.referral_code,
      },
    });
  } catch (error) {
    logger.error({ message: 'Error in loyalty enrollment', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
