import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  createSubaccount,
  resolveAccountNumber,
  updateSubaccount,
} from '@/lib/paystack';
import { createClient } from '@/lib/supabase/server';

// Platform commission percentage for subaccount default split
// Note: We override this per-transaction using transaction_charge
// which allows us to apply our 2% fee capped at ₦2,050
// Setting to 0 as fallback since we calculate fee dynamically
const PLATFORM_COMMISSION_PERCENTAGE = 0;

export async function POST(request: NextRequest) {
  try {
    const {
      bankCode,
      accountNumber,
      businessName,
      payoutMode,
      autoPayoutEnabled,
    } = await request.json();
    const authHeader = request.headers.get('Authorization');
    // biome-ignore lint/suspicious/noExplicitAny: Supabase client type complex
    let supabase: any;
    // biome-ignore lint/suspicious/noExplicitAny: User type complex
    let user: any;

    if (authHeader) {
      // Mobile/API Request with Bearer Token
      const { createClient: createSupabaseClient } = await import(
        '@supabase/supabase-js'
      );
      supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        {
          global: { headers: { Authorization: authHeader } },
        }
      );
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } else {
      // Web Request with Cookies
      const cookieStore = await cookies();
      supabase = createClient(cookieStore);
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Verify Account Number
    const accountResult = await resolveAccountNumber(accountNumber, bankCode);
    if (!accountResult.success) {
      return NextResponse.json({ error: accountResult.error }, { status: 400 });
    }
    const accountDetails = accountResult.data;

    // 2. Get Merchant Details
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, paystack_subaccount_code, business_name, email, phone')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // 3. Create or Update Subaccount in Paystack
    let subaccountCode = merchant.paystack_subaccount_code;

    if (subaccountCode) {
      // Update existing subaccount
      const updateResult = await updateSubaccount(subaccountCode, {
        business_name: businessName || merchant.business_name,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: PLATFORM_COMMISSION_PERCENTAGE,
      });
      if (!updateResult.success) {
        return NextResponse.json(
          { error: updateResult.error },
          { status: 400 }
        );
      }
    } else {
      // Create new subaccount
      const subaccountResult = await createSubaccount({
        business_name: businessName || merchant.business_name,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: PLATFORM_COMMISSION_PERCENTAGE,
        primary_contact_email: merchant.email || user.email,
        primary_contact_name: accountDetails.account_name, // Use bank account name as contact
        primary_contact_phone: merchant.phone || undefined,
      });
      if (!subaccountResult.success) {
        return NextResponse.json(
          { error: subaccountResult.error },
          { status: 400 }
        );
      }
      subaccountCode = subaccountResult.data.subaccount_code;
    }

    // 4. Save to Database
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        paystack_subaccount_code: subaccountCode,
        bank_account_number: accountNumber,
        bank_code: bankCode,
        bank_name: 'Unknown Bank', // resolve endpoint doesn't return bank name
        payout_mode: payoutMode || 'manual',
        auto_payout_enabled: autoPayoutEnabled || false,
      })
      .eq('id', merchant.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      accountName: accountDetails.account_name,
      subaccountCode,
    });
  } catch (error) {
    console.error('API Error managing subaccount:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to save bank details',
      },
      { status: 500 }
    );
  }
}
