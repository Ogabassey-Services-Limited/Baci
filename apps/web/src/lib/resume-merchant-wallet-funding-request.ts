import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createOrGetCustomer,
  type DedicatedAccountResponse,
  getDedicatedAccounts,
} from '@/lib/paystack';
import { logMerchantWalletProvisioningError } from './merchant-wallet-provisioning-logging';

const STALE_PENDING_MS = 15 * 60 * 1000;

type MerchantIdentity = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

function pickRecoverableAccount(
  accounts: DedicatedAccountResponse[] | undefined
): DedicatedAccountResponse | null {
  if (!accounts?.length) return null;
  const match = accounts.find(
    (account) =>
      account.active === true &&
      account.assigned === true &&
      account.currency === 'NGN' &&
      /^\d{10,20}$/.test(account.account_number)
  );
  return match ?? null;
}

export async function resumeMerchantWalletFundingRequest(
  supabase: SupabaseClient,
  merchant: MerchantIdentity,
  request: { id: string; created_at?: string | null }
): Promise<
  | {
      status: 'active';
      account: {
        accountName: string | null;
        accountNumber: string;
        bankName: string | null;
        currency: 'NGN';
        status: 'active';
      };
    }
  | { status: 'pending'; account: null; requestId: string }
> {
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
  } catch (error: unknown) {
    logMerchantWalletProvisioningError(
      'Merchant wallet funding recovery customer lookup failed',
      request.id,
      merchant.id,
      error
    );
    return { status: 'pending', account: null, requestId: request.id };
  }
  if (!customer.success) {
    return { status: 'pending', account: null, requestId: request.id };
  }

  const existing = await getDedicatedAccounts(customer.data.customer_code);
  const account = existing.success
    ? pickRecoverableAccount(existing.data)
    : null;
  if (account) {
    const { data: persisted, error: persistError } = await supabase.rpc(
      'persist_merchant_wallet_payment_account',
      {
        p_request_id: request.id,
        p_merchant_id: merchant.id,
        p_account_number: account.account_number,
        p_account_name: account.account_name ?? null,
        p_bank_name: account.bank?.name ?? null,
        p_currency: 'NGN',
        p_provider_account_id: String(account.id),
        p_provider_customer_code: account.customer?.customer_code ?? null,
      }
    );
    if (persistError) throw persistError;
    return {
      status: 'active',
      account: {
        accountName:
          typeof persisted?.account_name === 'string'
            ? persisted.account_name
            : (account.account_name ?? null),
        accountNumber: account.account_number,
        bankName:
          typeof persisted?.bank_name === 'string'
            ? persisted.bank_name
            : (account.bank?.name ?? null),
        currency: 'NGN',
        status: 'active',
      },
    };
  }

  const createdAtMs = Date.parse(String(request.created_at ?? ''));
  const isStale =
    Number.isFinite(createdAtMs) &&
    Date.now() - createdAtMs >= STALE_PENDING_MS;
  if (isStale) {
    const { error } = await supabase.rpc(
      'fail_merchant_wallet_funding_request',
      {
        p_request_id: request.id,
        p_merchant_id: merchant.id,
      }
    );
    if (error) {
      logMerchantWalletProvisioningError(
        'Failed to expire stale merchant wallet funding request',
        request.id,
        merchant.id,
        error
      );
      throw new Error('FUNDING_REQUEST_REVIEW_REQUIRED');
    }
    throw new Error('FUNDING_REQUEST_EXPIRED_RETRY');
  }

  return { status: 'pending', account: null, requestId: request.id };
}
