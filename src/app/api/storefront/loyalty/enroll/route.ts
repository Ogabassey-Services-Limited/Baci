import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Loyalty Enrollment API (Storefront)
 *
 * POST - Enroll a customer in the loyalty program
 *
 * Body:
 * - merchantId: string (required)
 * - email: string (required)
 * - name: string (optional)
 * - phone: string (optional)
 * - referralCode: string (optional) - Referral code from another customer
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantId, email, name, phone, referralCode } = body;

    if (!merchantId || !email) {
      return NextResponse.json(
        { error: 'merchantId and email are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get loyalty settings
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

    // Get or create the customer
    let { data: customer } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('merchant_id', merchantId)
      .eq('email', email.toLowerCase())
      .single();

    if (!customer) {
      // Create new customer
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert({
          merchant_id: merchantId,
          email: email.toLowerCase(),
          name: name || email.split('@')[0],
          phone: phone || null,
          source: 'loyalty_signup',
        })
        .select()
        .single();

      if (createError || !newCustomer) {
        console.error('Error creating customer:', createError);
        return NextResponse.json(
          { error: 'Failed to create customer' },
          { status: 500 }
        );
      }
      customer = newCustomer;
    }

    // At this point customer is guaranteed to exist (TypeScript guard)
    if (!customer) {
      return NextResponse.json(
        { error: 'Failed to retrieve customer' },
        { status: 500 }
      );
    }
    const customerId = customer.id;

    // Check if already enrolled
    const { data: existingLoyalty } = await supabase
      .from('customer_loyalty')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('customer_id', customerId)
      .single();

    if (existingLoyalty) {
      return NextResponse.json(
        { error: 'Customer is already enrolled in the loyalty program' },
        { status: 400 }
      );
    }

    // Generate referral code for the new member
    const newReferralCode = generateReferralCode();

    // Calculate initial points (signup bonus)
    let initialPoints = settings.signup_bonus_points || 0;
    let referrerId = null;

    // Process referral if provided
    if (referralCode) {
      const { data: referrer } = await supabase
        .from('customer_loyalty')
        .select('id, customer_id, referral_count')
        .eq('merchant_id', merchantId)
        .eq('referral_code', referralCode.toUpperCase())
        .single();

      if (referrer) {
        referrerId = referrer.customer_id;

        // Award referral bonus to the new customer
        const referralBonus = settings.referral_bonus_points || 0;
        initialPoints += referralBonus;

        // Award referral bonus to the referrer
        if (referralBonus > 0) {
          const { data: referrerLoyalty } = await supabase
            .from('customer_loyalty')
            .select('points_balance, lifetime_points')
            .eq('id', referrer.id)
            .single();

          if (referrerLoyalty) {
            await supabase
              .from('customer_loyalty')
              .update({
                points_balance: referrerLoyalty.points_balance + referralBonus,
                lifetime_points: referrerLoyalty.lifetime_points + referralBonus,
                referral_count: (referrer.referral_count || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', referrer.id);

            // Record referrer's bonus transaction
            await supabase.from('points_transactions').insert({
              customer_id: referrer.customer_id,
              merchant_id: merchantId,
              type: 'earn',
              points: referralBonus,
              balance_after: referrerLoyalty.points_balance + referralBonus,
              source: 'referral_bonus',
              description: `Referral bonus for inviting a friend`,
            });
          }
        }
      }
    }

    // Create loyalty record
    const { data: _loyalty, error: loyaltyError } = await supabase
      .from('customer_loyalty')
      .insert({
        customer_id: customerId,
        merchant_id: merchantId,
        points_balance: initialPoints,
        lifetime_points: initialPoints,
        current_tier: 'Bronze',
        referral_code: newReferralCode,
        referred_by: referrerId,
      })
      .select()
      .single();

    if (loyaltyError) {
      console.error('Error creating loyalty record:', loyaltyError);
      return NextResponse.json(
        { error: 'Failed to enroll in loyalty program' },
        { status: 500 }
      );
    }

    // Record signup bonus transaction
    if (initialPoints > 0) {
      await supabase.from('points_transactions').insert({
        customer_id: customerId,
        merchant_id: merchantId,
        type: 'earn',
        points: initialPoints,
        balance_after: initialPoints,
        source: referralCode ? 'referral_signup' : 'signup_bonus',
        description: referralCode
          ? `Welcome bonus + Referral bonus`
          : `Welcome bonus for joining ${settings.program_name}`,
      });
    }

    return NextResponse.json({
      success: true,
      enrollment: {
        customerId: customerId,
        pointsBalance: initialPoints,
        referralCode: newReferralCode,
        tier: 'Bronze',
        signupBonus: settings.signup_bonus_points || 0,
        referralBonus: referralCode ? (settings.referral_bonus_points || 0) : 0,
      },
      settings: {
        programName: settings.program_name,
        tiers: settings.tiers,
      },
    });
  } catch (error) {
    console.error('Loyalty enrollment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Generate a unique referral code
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar-looking characters
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
