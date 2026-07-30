import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { revalidateFeatures } from '@/lib/cache-revalidation';
import { isBaciPaystackSettlementCountry } from '@/lib/checkout/payment-gateway-availability';
import { checkCsrfProtection } from '@/lib/csrf';
import { fetchMerchantPaystackSubaccountCode } from '@/lib/fetch-merchant-payment-secret';
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
import { resolvePaystackAccountSchema } from '@/schemas/paystack-resolve';
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

const PLACEHOLDER_MANUAL_BANK_NAMES = new Set([
  'NA',
  'NONE',
  'UNKNOWN',
  'UNKNOWNBANK',
  'NOTAPPLICABLE',
]);

function isPlaceholderManualBankName(bankName: string): boolean {
  const normalizedBankName = bankName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
  return PLACEHOLDER_MANUAL_BANK_NAMES.has(normalizedBankName);
}

function revalidateFeaturesAfterSubaccountMutation(merchantId: string): void {
  try {
    revalidateFeatures(merchantId);
  } catch (error) {
    console.error('Failed to revalidate storefront payment features', {
      error,
      merchantId,
    });
  }
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

    const {
      merchant_id,
      account_name,
      account_number,
      bank_code,
      bank_name,
      business_name,
      auto_payout_enabled,
    } = parseResult.data;

    if (!merchant_id) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const shouldPersistAutoPayoutEnabled =
      hasRequestField(body, 'autoPayoutEnabled') ||
      hasRequestField(body, 'auto_payout_enabled');
    const hasExplicitPayoutMode =
      hasRequestField(body, 'payoutMode') ||
      hasRequestField(body, 'payout_mode');

    if (hasExplicitPayoutMode) {
      return NextResponse.json(
        {
          error:
            'Payout mode is no longer supported in the bank details save flow',
        },
        { status: 400 }
      );
    }

    // 1. Get Merchant Context (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id,
      { requestedMerchantId: merchant_id }
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

    if (shouldPersistAutoPayoutEnabled && !access.isOwner) {
      return NextResponse.json(
        { error: 'Only merchant owners can update auto-payout settings' },
        { status: 403 }
      );
    }

    const merchantId = merchantContext.merchantId;

    // Non-secret merchant fields remain granted to the authenticated Postgres
    // role, so read them on the auth-scoped client AFTER auth/permission checks,
    // keyed to the already-resolved merchant id so tenant scoping is preserved.
    const { data: merchantRecord } = await auth.supabase
      .from('merchants')
      .select('business_name, country, email, phone')
      .eq('id', merchantId)
      .single();

    if (!merchantRecord) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // The secret column `paystack_subaccount_code` is revoked from the
    // authenticated role, so a direct SELECT would fail with 42501. Read it
    // through the bounded SECURITY DEFINER RPC on the same authenticated client
    // (owner/active-staff, or a published storefront) keyed to the resolved id.
    const paystackSubaccountCode = await fetchMerchantPaystackSubaccountCode(
      auth.supabase,
      merchantId
    );

    const merchantDetails = {
      ...merchantRecord,
      paystack_subaccount_code: paystackSubaccountCode,
    };

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

    const isPaystackSettlementCountry = isBaciPaystackSettlementCountry(
      merchantDetails.country
    );

    if (!isPaystackSettlementCountry) {
      if (shouldPersistAutoPayoutEnabled) {
        return NextResponse.json(
          {
            error:
              'Auto-payout settings are only available for Nigerian Paystack settlements',
          },
          { status: 400 }
        );
      }

      if (!bank_name) {
        return NextResponse.json(
          {
            error:
              'Paystack settlement setup is only available for Nigerian merchants. Add a bank name to save manual invoice bank details.',
          },
          { status: 400 }
        );
      }

      if (isPlaceholderManualBankName(bank_name)) {
        return NextResponse.json(
          {
            error:
              'Enter the actual bank name to save manual invoice bank details.',
          },
          { status: 400 }
        );
      }

      const manualAccountName = account_name ?? effectiveBusinessName;
      const { error: manualUpdateError } = await auth.supabase
        .from('merchants')
        .update({
          paystack_subaccount_code: null,
          bank_account_number: account_number,
          bank_account_name: manualAccountName,
          bank_code: null,
          bank_name,
        })
        .eq('id', merchantId);

      if (manualUpdateError) {
        throw manualUpdateError;
      }

      // Paystack capability changed (subaccount cleared) — bust the cached
      // storefront features lookup so checkout stops advertising Paystack.
      revalidateFeaturesAfterSubaccountMutation(merchantId);

      return NextResponse.json({
        success: true,
        accountName: manualAccountName,
        subaccountCode: null,
      });
    }

    const paystackAccount = resolvePaystackAccountSchema.safeParse({
      account_number,
      bank_code,
    });
    if (!paystackAccount.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: paystackAccount.error.flatten(),
        },
        { status: 400 }
      );
    }

    const verifiedAccountNumber = paystackAccount.data.account_number;
    const verifiedBankCode = paystackAccount.data.bank_code;

    // 2. Verify Account Number
    const accountResult = await resolveAccountNumber(
      verifiedAccountNumber,
      verifiedBankCode
    );
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
        settlement_bank: verifiedBankCode,
        account_number: verifiedAccountNumber,
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
        settlement_bank: verifiedBankCode,
        account_number: verifiedAccountNumber,
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
        bank_account_number: verifiedAccountNumber,
        bank_account_name: accountDetails.account_name,
        bank_code: verifiedBankCode,
        bank_name: 'Unknown Bank', // resolve endpoint doesn't return bank name
      })
      .eq('id', merchantId);

    if (updateError) {
      throw updateError;
    }

    // Paystack capability changed (subaccount configured) — bust the cached
    // storefront features lookup so checkout starts advertising Paystack.
    revalidateFeaturesAfterSubaccountMutation(merchantId);

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

      const { data: updatedWallet, error: walletUpdateError } =
        await auth.supabase
          .from('merchant_wallets')
          .update({
            auto_payout_enabled,
          })
          .eq('merchant_id', merchantId)
          .select('id')
          .maybeSingle();

      if (walletUpdateError) {
        throw walletUpdateError;
      }

      if (!updatedWallet) {
        return NextResponse.json(
          { error: 'Failed to update auto-payout settings' },
          { status: 500 }
        );
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
