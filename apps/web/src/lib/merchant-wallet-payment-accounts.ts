import type { SupabaseClient } from '@supabase/supabase-js';
import { createDedicatedAccount, createOrGetCustomer } from '@/lib/paystack';
import { logMerchantWalletProvisioningError } from './merchant-wallet-provisioning-logging';

export type MerchantWalletAccount = {
  accountName: string | null;
  accountNumber: string;
  bankName: string | null;
  currency: 'NGN';
  status: 'active' | 'pending' | 'disabled';
};

export async function getMerchantWalletAccount(
  supabase: SupabaseClient,
  merchantId: string
): Promise<MerchantWalletAccount | null> {
  const { data, error } = await supabase
    .from('merchant_wallet_payment_accounts')
    .select('account_name, account_number, bank_name, currency, status')
    .eq('merchant_id', merchantId)
    .in('status', ['active', 'pending'])
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    accountName: data.account_name,
    accountNumber: data.account_number,
    bankName: data.bank_name,
    currency: 'NGN',
    status: data.status,
  };
}

export async function requestMerchantWalletAccount(
  supabase: SupabaseClient,
  merchant: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }
) {
  const { data: existing, error: existingError } = await supabase
    .from('merchant_wallet_payment_accounts')
    .select('account_name, account_number, bank_name, currency, status')
    .eq('merchant_id', merchant.id)
    .eq('status', 'active')
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing)
    return {
      status: 'active' as const,
      account: {
        accountName: existing.account_name,
        accountNumber: existing.account_number,
        bankName: existing.bank_name,
        currency: 'NGN' as const,
        status: 'active' as const,
      },
    };
  const { data: request, error } = await supabase
    .from('merchant_wallet_funding_account_requests')
    .insert({
      merchant_id: merchant.id,
      consented_at: new Date().toISOString(),
      status: 'pending',
    })
    .select('id, status')
    .single();
  if (error) {
    const pending = await supabase
      .from('merchant_wallet_funding_account_requests')
      .select('id')
      .eq('merchant_id', merchant.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (pending.data) return { status: 'pending' as const, account: null };
    throw error;
  }
  const failProvisioningRequest = async (fallback: string): Promise<never> => {
    try {
      const { error: transitionError } = await supabase.rpc(
        'fail_merchant_wallet_funding_request',
        {
          p_request_id: request.id,
          p_merchant_id: merchant.id,
        }
      );
      if (transitionError) throw transitionError;
    } catch (transitionError: unknown) {
      logMerchantWalletProvisioningError(
        'Failed to mark merchant wallet funding request failed',
        request.id,
        merchant.id,
        transitionError
      );
      throw new Error('FUNDING_REQUEST_REVIEW_REQUIRED');
    }
    throw new Error(fallback);
  };

  let customer: Awaited<ReturnType<typeof createOrGetCustomer>>;
  try {
    customer = await createOrGetCustomer({
      email: merchant.email,
      first_name: merchant.firstName,
      last_name: merchant.lastName,
      phone: merchant.phone,
      metadata: {
        request_id: request.id,
        merchant_id: merchant.id,
        source: 'merchant_wallet_funding',
      },
    });
  } catch (provisioningError: unknown) {
    logMerchantWalletProvisioningError(
      'Merchant wallet customer provisioning failed',
      request.id,
      merchant.id,
      provisioningError
    );
    return failProvisioningRequest('Paystack customer provisioning failed');
  }
  if (!customer.success) {
    return failProvisioningRequest('Paystack customer provisioning failed');
  }
  let dva: Awaited<ReturnType<typeof createDedicatedAccount>>;
  try {
    dva = await createDedicatedAccount(customer.data.customer_code, {
      firstName: merchant.firstName,
      lastName: merchant.lastName,
      phone: merchant.phone,
    });
  } catch (provisioningError: unknown) {
    logMerchantWalletProvisioningError(
      'Merchant wallet DVA provisioning failed',
      request.id,
      merchant.id,
      provisioningError
    );
    return failProvisioningRequest('Paystack DVA provisioning failed');
  }
  if (!dva.success) {
    return failProvisioningRequest('Paystack DVA provisioning failed');
  }
  return { status: 'pending' as const, account: null, requestId: request.id };
}

export async function persistVerifiedMerchantWalletAssignment(
  supabase: SupabaseClient,
  payload: {
    requestId: string;
    merchantId: string;
    accountNumber: string;
    accountName: string | null;
    bankName: string | null;
    currency: string;
    providerAccountId?: string | null;
    providerCustomerCode?: string | null;
  }
) {
  const { data, error } = await supabase.rpc(
    'persist_merchant_wallet_payment_account',
    {
      p_request_id: payload.requestId,
      p_merchant_id: payload.merchantId,
      p_account_number: payload.accountNumber,
      p_account_name: payload.accountName,
      p_bank_name: payload.bankName,
      p_currency: payload.currency,
      p_provider_account_id: payload.providerAccountId ?? null,
      p_provider_customer_code: payload.providerCustomerCode ?? null,
    }
  );
  if (error) throw error;
  return data;
}

export async function persistMerchantWalletAssignmentEvent(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  const data =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : {};
  const directMetadata =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : null;
  const customer =
    data.customer && typeof data.customer === 'object'
      ? (data.customer as Record<string, unknown>)
      : {};
  const customerMetadata =
    customer.metadata && typeof customer.metadata === 'object'
      ? (customer.metadata as Record<string, unknown>)
      : null;
  const fundingMetadata = [directMetadata, customerMetadata].find(
    (candidate) => candidate?.source === 'merchant_wallet_funding'
  );
  const metadata =
    fundingMetadata ??
    (directMetadata && 'source' in directMetadata
      ? directMetadata
      : (customerMetadata ?? directMetadata ?? {}));
  const requestId =
    typeof metadata.request_id === 'string' ? metadata.request_id : '';
  const merchantId =
    typeof metadata.merchant_id === 'string' ? metadata.merchant_id : '';
  if (metadata.source !== 'merchant_wallet_funding') {
    return 'source' in metadata
      ? { kind: 'ignored' as const }
      : { kind: 'review' as const };
  }
  if (!requestId || !merchantId) return { kind: 'review' as const };
  const account =
    data.dedicated_account && typeof data.dedicated_account === 'object'
      ? (data.dedicated_account as Record<string, unknown>)
      : data;
  const accountNumber =
    typeof account.account_number === 'string' ? account.account_number : '';
  const currency = typeof account.currency === 'string' ? account.currency : '';
  if (!/^\d{10,20}$/.test(accountNumber) || currency !== 'NGN')
    return { kind: 'review' as const };
  // Paystack's assignment payload may include these provider state flags.
  // When present, only an explicitly active and assigned account is trusted;
  // older payloads that omit either field remain supported.
  if (
    ('active' in account && account.active !== true) ||
    ('assigned' in account && account.assigned !== true)
  )
    return { kind: 'review' as const };
  const { data: requests, error: requestError } = await supabase
    .from('merchant_wallet_funding_account_requests')
    .select('id, status')
    .eq('id', requestId)
    .eq('merchant_id', merchantId)
    .in('status', ['pending', 'fulfilled']);
  if (requestError || !requests || requests.length !== 1)
    return { kind: 'review' as const };
  const bank =
    account.bank && typeof account.bank === 'object'
      ? (account.bank as Record<string, unknown>)
      : {};
  const accountCustomer =
    account.customer && typeof account.customer === 'object'
      ? (account.customer as Record<string, unknown>)
      : {};
  const providerCustomer =
    typeof accountCustomer.customer_code === 'string'
      ? accountCustomer
      : customer;
  const incoming = {
    accountNumber,
    accountName:
      typeof account.account_name === 'string' ? account.account_name : null,
    bankName: typeof bank.name === 'string' ? bank.name : null,
    currency,
    providerAccountId: account.id ? String(account.id) : null,
    providerCustomerCode: providerCustomer.customer_code
      ? String(providerCustomer.customer_code)
      : null,
  };
  if (requests[0].status === 'fulfilled') {
    const { data: existing, error: existingError } = await supabase
      .from('merchant_wallet_payment_accounts')
      .select(
        'account_number, account_name, bank_name, currency, provider_account_id, provider_customer_code'
      )
      .eq('request_id', requestId)
      .maybeSingle();
    if (existingError) return { kind: 'review' as const };
    return existing &&
      existing.account_number === incoming.accountNumber &&
      existing.account_name === incoming.accountName &&
      existing.bank_name === incoming.bankName &&
      existing.currency === incoming.currency &&
      existing.provider_account_id === incoming.providerAccountId &&
      existing.provider_customer_code === incoming.providerCustomerCode
      ? { kind: 'match' as const }
      : { kind: 'review' as const };
  }
  try {
    await persistVerifiedMerchantWalletAssignment(supabase, {
      requestId,
      merchantId,
      accountNumber,
      accountName: incoming.accountName,
      bankName: incoming.bankName,
      currency,
      providerAccountId: incoming.providerAccountId,
      providerCustomerCode: incoming.providerCustomerCode,
    });
    return { kind: 'match' as const };
  } catch {
    return { kind: 'review' as const };
  }
}
