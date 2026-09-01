import type { SupabaseClient } from '@supabase/supabase-js';
import { createDedicatedAccount, createOrGetCustomer } from '@/lib/paystack';

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
    .select('id')
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
  const customer = await createOrGetCustomer({
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
  if (!customer.success) {
    await supabase.rpc('fail_merchant_wallet_funding_request', {
      p_request_id: request.id,
      p_merchant_id: merchant.id,
    });
    throw new Error('Paystack customer provisioning failed');
  }
  if (customer.success) {
    // Provider account data is intentionally not persisted by this user-facing path.
    const dva = await createDedicatedAccount(customer.data.customer_code, {
      firstName: merchant.firstName,
      lastName: merchant.lastName,
      phone: merchant.phone,
    });
    if (!dva.success) {
      await supabase.rpc('fail_merchant_wallet_funding_request', {
        p_request_id: request.id,
        p_merchant_id: merchant.id,
      });
      throw new Error('Paystack DVA provisioning failed');
    }
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
  const metadata =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : {};
  const requestId =
    typeof metadata.request_id === 'string' ? metadata.request_id : '';
  const merchantId =
    typeof metadata.merchant_id === 'string' ? metadata.merchant_id : '';
  if (
    metadata.source !== 'merchant_wallet_funding' ||
    !requestId ||
    !merchantId
  )
    return { kind: 'review' as const };
  const account =
    data.dedicated_account && typeof data.dedicated_account === 'object'
      ? (data.dedicated_account as Record<string, unknown>)
      : data;
  const accountNumber =
    typeof account.account_number === 'string' ? account.account_number : '';
  const currency = typeof account.currency === 'string' ? account.currency : '';
  if (!/^\d{10,20}$/.test(accountNumber) || currency !== 'NGN')
    return { kind: 'review' as const };
  const { data: pending, error } = await supabase
    .from('merchant_wallet_funding_account_requests')
    .select('id')
    .eq('id', requestId)
    .eq('merchant_id', merchantId)
    .eq('status', 'pending');
  if (error || !pending || pending.length !== 1)
    return { kind: 'review' as const };
  const bank =
    account.bank && typeof account.bank === 'object'
      ? (account.bank as Record<string, unknown>)
      : {};
  const customer =
    account.customer && typeof account.customer === 'object'
      ? (account.customer as Record<string, unknown>)
      : {};
  await persistVerifiedMerchantWalletAssignment(supabase, {
    requestId,
    merchantId,
    accountNumber,
    accountName:
      typeof account.account_name === 'string' ? account.account_name : null,
    bankName: typeof bank.name === 'string' ? bank.name : null,
    currency,
    providerAccountId: account.id ? String(account.id) : null,
    providerCustomerCode: customer.customer_code
      ? String(customer.customer_code)
      : null,
  });
  return { kind: 'match' as const };
}
