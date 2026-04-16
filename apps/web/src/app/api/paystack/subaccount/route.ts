import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import {
  createSubaccount,
  resolveAccountNumber,
  updateSubaccount,
} from '@/lib/paystack';
import {
  getPaystackFailureMessage,
  getPaystackFailureStatus,
} from '@/lib/paystack-route-errors';
import { paystackSubaccountSchema } from '@/schemas/paystack-subaccount';

// Platform commission percentage for subaccount default split
// Note: We override this per-transaction using transaction_charge
// which allows us to apply our 2% fee capped at ₦2,050
// Setting to 0 as fallback since we calculate fee dynamically
const PLATFORM_COMMISSION_PERCENTAGE = 0;

function hasRequestField(value: unknown, property: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.hasOwn(value, property)
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error ?? 'Unauthorized' },
        { status: 401 }
      );
    }

    const usingBearerAuth =
      request.headers.get('Authorization')?.startsWith('Bearer ') ?? false;
    if (!usingBearerAuth) {
      const csrf = await checkCsrfProtection(request);
      if (!csrf.valid) {
        return (
          csrf.response ??
          NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
        );
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const parseResult = paystackSubaccountSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { account_number, bank_code, business_name, auto_payout_enabled } =
      parseResult.data;
    const shouldPersistAutoPayoutEnabled =
      hasRequestField(body, 'autoPayoutEnabled') ||
      hasRequestField(body, 'auto_payout_enabled');

    // 1. Get Merchant Context (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id
    );
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Fetch additional merchant fields needed for subaccount operations
    const { data: merchantDetails } = await auth.supabase
      .from('merchants')
      .select('paystack_subaccount_code, business_name, email, phone')
      .eq('id', merchantId)
      .single();

    if (!merchantDetails) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // 3. Create or Update Subaccount in Paystack
    let subaccountCode = merchantDetails.paystack_subaccount_code;
    const effectiveBusinessName =
      business_name ?? merchantDetails.business_name?.trim() ?? '';

    if (effectiveBusinessName.length < 2) {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      );
    }

    // 2. Verify Account Number
    const accountResult = await resolveAccountNumber(account_number, bank_code);
    if (!accountResult.success) {
      if (accountResult.code === 'CONFIG_ERROR') {
        console.error(
          'Paystack subaccount resolve configuration error:',
          accountResult.error
        );
      }
      return NextResponse.json(
        {
          error: getPaystackFailureMessage(
            accountResult,
            'Could not resolve account'
          ),
        },
        { status: getPaystackFailureStatus(accountResult.code) }
      );
    }
    const accountDetails = accountResult.data;

    if (subaccountCode) {
      // Update existing subaccount
      const updateResult = await updateSubaccount(subaccountCode, {
        business_name: effectiveBusinessName,
        settlement_bank: bank_code,
        account_number: account_number,
        percentage_charge: PLATFORM_COMMISSION_PERCENTAGE,
      });
      if (!updateResult.success) {
        if (updateResult.code === 'CONFIG_ERROR') {
          console.error(
            'Paystack subaccount update configuration error:',
            updateResult.error
          );
        }
        return NextResponse.json(
          {
            error: getPaystackFailureMessage(
              updateResult,
              'Failed to update payout subaccount'
            ),
          },
          { status: getPaystackFailureStatus(updateResult.code) }
        );
      }
    } else {
      // Create new subaccount
      const subaccountResult = await createSubaccount({
        business_name: effectiveBusinessName,
        settlement_bank: bank_code,
        account_number: account_number,
        percentage_charge: PLATFORM_COMMISSION_PERCENTAGE,
        primary_contact_email: merchantDetails.email || auth.user.email,
        primary_contact_name: accountDetails.account_name, // Use bank account name as contact
        primary_contact_phone: merchantDetails.phone || undefined,
      });
      if (!subaccountResult.success) {
        if (subaccountResult.code === 'CONFIG_ERROR') {
          console.error(
            'Paystack subaccount create configuration error:',
            subaccountResult.error
          );
        }
        return NextResponse.json(
          {
            error: getPaystackFailureMessage(
              subaccountResult,
              'Failed to create payout subaccount'
            ),
          },
          { status: getPaystackFailureStatus(subaccountResult.code) }
        );
      }
      subaccountCode = subaccountResult.data.subaccount_code;
    }

    // 4. Save to Database
    const { error: updateError } = await auth.supabase
      .from('merchants')
      .update({
        paystack_subaccount_code: subaccountCode,
        bank_account_number: account_number,
        bank_account_name: accountDetails.account_name,
        bank_code: bank_code,
        bank_name: 'Unknown Bank', // resolve endpoint doesn't return bank name
      })
      .eq('id', merchantId);

    if (updateError) {
      throw updateError;
    }

    if (shouldPersistAutoPayoutEnabled) {
      const { error: walletInitError } = await auth.supabase.rpc(
        'get_or_create_merchant_wallet',
        {
          p_merchant_id: merchantId,
        }
      );

      if (walletInitError) {
        throw walletInitError;
      }

      const { error: walletUpdateError } = await auth.supabase
        .from('merchant_wallets')
        .update({
          auto_payout_enabled,
        })
        .eq('merchant_id', merchantId);

      if (walletUpdateError) {
        throw walletUpdateError;
      }
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
