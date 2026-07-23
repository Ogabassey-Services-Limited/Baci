import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { resolveWalletTopUpMerchant } from '@/lib/resolve-wallet-top-up-merchant';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveVtuCustomer } from '@/lib/vtu-pending-transaction';

const MERCHANT_SELECT = 'id, slug, business_name, paystack_subaccount_code';

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
  // paystack_subaccount_code is SELECT-revoked from the authenticated role, so
  // the merchant payment-config lookup must run under the service-role client.
  // resolveVtuCustomer below stays on the caller's authenticated RLS client.
  const merchant = await resolveWalletTopUpMerchant<SavingsMerchant>(
    createAdminClient(),
    identifiers,
    MERCHANT_SELECT
  );

  if (!merchant) {
    return {
      response: NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      ),
    };
  }

  const customer = await resolveVtuCustomer({
    merchantId: merchant.id,
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
