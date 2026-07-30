import type { SupabaseClient } from '@supabase/supabase-js';
import { isBaciPaystackSettlementCountry } from '@/lib/checkout/payment-gateway-availability';
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
import { revalidatePaystackSubaccountFeatures } from './revalidate-paystack-subaccount-features';

const PLATFORM_COMMISSION_PERCENTAGE = 0;
const PLACEHOLDER_MANUAL_BANK_NAMES = new Set([
  'NA',
  'NONE',
  'UNKNOWN',
  'UNKNOWNBANK',
  'NOTAPPLICABLE',
]);

type MerchantPaystackDetails = {
  businessName: string | null;
  country: string | null;
  email: string | null;
  paystackSubaccountCode: string | null;
  phone: string | null;
};

type ExecutePaystackSubaccountSaveInput = {
  accountName: string | undefined;
  accountNumber: string;
  authUserEmail: string | undefined;
  autoPayoutEnabled: boolean;
  bankCode: string | undefined;
  bankName: string | undefined;
  businessName: string | undefined;
  merchantDetails: MerchantPaystackDetails;
  merchantId: string;
  shouldPersistAutoPayoutEnabled: boolean;
  supabase: SupabaseClient;
};

function isPlaceholderManualBankName(bankName: string): boolean {
  const normalizedBankName = bankName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
  return PLACEHOLDER_MANUAL_BANK_NAMES.has(normalizedBankName);
}

function revalidateFeaturesAfterSubaccountMutation(merchantId: string): void {
  try {
    revalidatePaystackSubaccountFeatures(merchantId);
  } catch (error) {
    console.error('Failed to revalidate storefront payment features', {
      error,
      merchantId,
    });
  }
}

export async function executePaystackSubaccountSave({
  accountName,
  accountNumber,
  authUserEmail,
  autoPayoutEnabled,
  bankCode,
  bankName,
  businessName,
  merchantDetails,
  merchantId,
  shouldPersistAutoPayoutEnabled,
  supabase,
}: ExecutePaystackSubaccountSaveInput) {
  const effectiveBusinessName =
    businessName ?? merchantDetails.businessName?.trim() ?? '';
  if (effectiveBusinessName.length < 2) {
    return {
      success: false as const,
      status: 400,
      error: 'Business name is required',
    };
  }

  const isPaystackSettlementCountry = isBaciPaystackSettlementCountry(
    merchantDetails.country
  );
  if (!isPaystackSettlementCountry) {
    if (shouldPersistAutoPayoutEnabled) {
      return {
        success: false as const,
        status: 400,
        error:
          'Auto-payout settings are only available for Nigerian Paystack settlements',
      };
    }

    if (!bankName) {
      return {
        success: false as const,
        status: 400,
        error:
          'Paystack settlement setup is only available for Nigerian merchants. Add a bank name to save manual invoice bank details.',
      };
    }

    if (isPlaceholderManualBankName(bankName)) {
      return {
        success: false as const,
        status: 400,
        error:
          'Enter the actual bank name to save manual invoice bank details.',
      };
    }

    const manualAccountName = accountName ?? effectiveBusinessName;
    const { error: manualUpdateError } = await supabase
      .from('merchants')
      .update({
        paystack_subaccount_code: null,
        bank_account_number: accountNumber,
        bank_account_name: manualAccountName,
        bank_code: null,
        bank_name: bankName,
      })
      .eq('id', merchantId);
    if (manualUpdateError) throw manualUpdateError;

    revalidateFeaturesAfterSubaccountMutation(merchantId);
    return {
      success: true as const,
      accountName: manualAccountName,
      subaccountCode: null,
    };
  }

  const paystackAccount = resolvePaystackAccountSchema.safeParse({
    account_number: accountNumber,
    bank_code: bankCode,
  });
  if (!paystackAccount.success) {
    return {
      success: false as const,
      status: 400,
      error: 'Invalid input',
      details: paystackAccount.error.flatten(),
    };
  }

  const verifiedAccountNumber = paystackAccount.data.account_number;
  const verifiedBankCode = paystackAccount.data.bank_code;
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
    return {
      success: false as const,
      status: getPaystackFailureStatus(accountResult.code),
      error: getPaystackFailureMessage(
        accountResult,
        'Could not resolve account'
      ),
    };
  }
  const accountDetails = accountResult.data;
  let subaccountCode = merchantDetails.paystackSubaccountCode;

  if (subaccountCode) {
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
      return {
        success: false as const,
        status: getPaystackFailureStatus(updateResult.code),
        error: getPaystackFailureMessage(
          updateResult,
          'Failed to update payout subaccount'
        ),
      };
    }
  } else {
    const subaccountResult = await createSubaccount({
      business_name: effectiveBusinessName,
      settlement_bank: verifiedBankCode,
      account_number: verifiedAccountNumber,
      percentage_charge: PLATFORM_COMMISSION_PERCENTAGE,
      primary_contact_email: merchantDetails.email || authUserEmail,
      primary_contact_name: accountDetails.account_name,
      primary_contact_phone: merchantDetails.phone || undefined,
    });
    if (!subaccountResult.success) {
      if (subaccountResult.code === 'CONFIG_ERROR') {
        console.error(
          'Paystack subaccount create configuration error:',
          subaccountResult.error
        );
      }
      return {
        success: false as const,
        status: getPaystackFailureStatus(subaccountResult.code),
        error: getPaystackFailureMessage(
          subaccountResult,
          'Failed to create payout subaccount'
        ),
      };
    }
    subaccountCode = subaccountResult.data.subaccount_code;
  }

  const { error: updateError } = await supabase
    .from('merchants')
    .update({
      paystack_subaccount_code: subaccountCode,
      bank_account_number: verifiedAccountNumber,
      bank_account_name: accountDetails.account_name,
      bank_code: verifiedBankCode,
      bank_name: 'Unknown Bank',
    })
    .eq('id', merchantId);
  if (updateError) throw updateError;

  revalidateFeaturesAfterSubaccountMutation(merchantId);

  if (shouldPersistAutoPayoutEnabled) {
    const { error: walletInitError } = await supabase.rpc(
      'get_or_create_merchant_wallet',
      { p_merchant_id: merchantId }
    );
    if (walletInitError) throw walletInitError;

    const { data: updatedWallet, error: walletUpdateError } = await supabase
      .from('merchant_wallets')
      .update({ auto_payout_enabled: autoPayoutEnabled })
      .eq('merchant_id', merchantId)
      .select('id')
      .maybeSingle();
    if (walletUpdateError) throw walletUpdateError;
    if (!updatedWallet) {
      return {
        success: false as const,
        status: 500,
        error: 'Failed to update auto-payout settings',
      };
    }
  }

  return {
    success: true as const,
    accountName: accountDetails.account_name,
    subaccountCode,
  };
}
