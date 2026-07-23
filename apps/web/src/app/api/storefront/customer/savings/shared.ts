import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchMerchantPaystackSubaccountCode } from '@/lib/fetch-merchant-payment-secret';
import { resolveWalletTopUpMerchant } from '@/lib/resolve-wallet-top-up-merchant';
import { resolveVtuCustomer } from '@/lib/vtu-pending-transaction';

// Identity only (no secret). Resolved on the caller's RLS client so an
// unpublished merchant the customer cannot access is indistinguishable from a
// nonexistent one (no tenant existence oracle). The revoked
// paystack_subaccount_code is read via the admin client AFTER the customer is
// verified, keyed by the resolved id.
const MERCHANT_IDENTITY_SELECT = 'id, slug, business_name';

interface SavingsMerchantIdentity {
  business_name: string | null;
  id: string;
  slug: string | null;
}

export interface SavingsMerchant {
  business_name: string | null;
  id: string;
  paystack_subaccount_code: string | null;
  slug: string | null;
}

export interface SavingsFeatureSettings {
  customer_device_savings_auto_debit_enabled: boolean | null;
  customer_device_savings_enabled: boolean | null;
  paystack_enabled: boolean | null;
}

type SavingsContext =
  | { response: NextResponse }
  | {
      customer: NonNullable<Awaited<ReturnType<typeof resolveVtuCustomer>>>;
      merchant: SavingsMerchant;
      supabase: SupabaseClient;
    };

export function getSavingsIdentifierParams(searchParams: URLSearchParams) {
  return {
    merchantId: searchParams.get('merchantId') ?? undefined,
    merchantSlug: searchParams.get('merchantSlug') ?? undefined,
  };
}

export async function resolveCustomerSavingsContext({
  identifiers,
  supabase,
  user,
}: {
  identifiers: { merchantId?: string; merchantSlug?: string };
  supabase: SupabaseClient;
  user: User;
}): Promise<SavingsContext> {
  // Resolve identity on the caller's RLS client first — no cross-tenant oracle.
  const identity = await resolveWalletTopUpMerchant<SavingsMerchantIdentity>(
    supabase,
    identifiers,
    MERCHANT_IDENTITY_SELECT
  );

  if (!identity) {
    return {
      response: NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      ),
    };
  }

  const customer = await resolveVtuCustomer({
    merchantId: identity.id,
    supabase,
    user,
  });

  if (!customer) {
    return {
      response: NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      ),
    };
  }

  // Customer is verified — only now read the revoked payment secret, via the
  // bounded SECURITY DEFINER RPC on the caller's authenticated client.
  const merchant: SavingsMerchant = {
    ...identity,
    paystack_subaccount_code: await fetchMerchantPaystackSubaccountCode(
      supabase,
      identity.id
    ),
  };

  return {
    customer,
    merchant,
    supabase,
  };
}

export async function getCustomerSavingsFeatureSettings({
  customerId,
  merchantId,
  supabase,
}: {
  customerId: string;
  merchantId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase.rpc(
    'get_customer_savings_feature_settings',
    {
      p_customer_id: customerId,
      p_merchant_id: merchantId,
    }
  );

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : null;
  const settings = (row ?? {}) as SavingsFeatureSettings;
  return {
    autoDebitEnabled:
      settings.customer_device_savings_auto_debit_enabled === true,
    paystackEnabled: settings.paystack_enabled !== false,
    savingsEnabled: settings.customer_device_savings_enabled === true,
  };
}
