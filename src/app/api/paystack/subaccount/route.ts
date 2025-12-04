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
    const { bankCode, accountNumber, businessName } = await request.json();
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Verify Account Number
    const accountDetails = await resolveAccountNumber(accountNumber, bankCode);

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
      await updateSubaccount(subaccountCode, {
        business_name: businessName || merchant.business_name,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: PLATFORM_COMMISSION_PERCENTAGE,
      });
    } else {
      // Create new subaccount
      const subaccount = await createSubaccount({
        business_name: businessName || merchant.business_name,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: PLATFORM_COMMISSION_PERCENTAGE,
        primary_contact_email: merchant.email || user.email,
        primary_contact_name: accountDetails.account_name, // Use bank account name as contact
        primary_contact_phone: merchant.phone || undefined,
      });
      subaccountCode = subaccount.subaccount_code;
    }

    // 4. Save to Database
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        paystack_subaccount_code: subaccountCode,
        bank_account_number: accountNumber,
        bank_code: bankCode,
        bank_name: accountDetails.bank_name || 'Unknown Bank', // resolve endpoint might not return bank name directly
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
  } catch (error: any) {
    console.error('API Error managing subaccount:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save bank details' },
      { status: 500 }
    );
  }
}
