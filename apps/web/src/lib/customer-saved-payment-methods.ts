import type { SupabaseClient } from '@supabase/supabase-js';

export interface PaystackAuthorization {
  authorization_code: string;
  card_type: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  bin?: string | null;
  bank: string | null;
  channel: string | null;
  signature: string | null;
  reusable: boolean;
  country_code: string | null;
  brand?: string | null;
  account_name?: string | null;
}

export interface SavedPaymentMethod {
  id: string;
  provider: 'paystack';
  label: string;
  brand: string | null;
  bank: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  is_default: boolean;
}

interface SavedPaymentMethodRow {
  id: string;
  provider: 'paystack';
  brand: string | null;
  bank: string | null;
  card_type: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  is_default: boolean;
}

interface UpsertSavedPaymentMethodInput {
  supabase: SupabaseClient;
  merchantId: string;
  customerId: string;
  customerEmail: string;
  authorization: PaystackAuthorization;
}

export function formatSavedPaymentMethodLabel(
  method: Pick<SavedPaymentMethodRow, 'bank' | 'brand' | 'card_type' | 'last4'>
) {
  const issuer = method.bank || method.brand || method.card_type || 'Card';
  const suffix = method.last4 ? ` ending ${method.last4}` : '';
  return `${issuer}${suffix}`;
}

export async function listSavedPaymentMethods({
  supabase,
  merchantId,
  customerId,
}: {
  supabase: SupabaseClient;
  merchantId: string;
  customerId: string;
}): Promise<SavedPaymentMethod[]> {
  const { data, error } = await supabase
    .from('customer_saved_payment_methods')
    .select(
      'id, provider, brand, bank, card_type, last4, exp_month, exp_year, is_default'
    )
    .eq('merchant_id', merchantId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('last_used_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const record = row as SavedPaymentMethodRow;
    return {
      id: record.id,
      provider: record.provider,
      label: formatSavedPaymentMethodLabel(record),
      brand: record.brand,
      bank: record.bank,
      last4: record.last4,
      exp_month: record.exp_month,
      exp_year: record.exp_year,
      is_default: record.is_default,
    };
  });
}

export async function upsertPaystackAuthorization({
  supabase,
  merchantId,
  customerId,
  customerEmail,
  authorization,
}: UpsertSavedPaymentMethodInput): Promise<string | null> {
  const signature = authorization.signature?.trim() ?? '';
  const authorizationCode = authorization.authorization_code?.trim() ?? '';
  const isReusable = authorization.reusable === true;

  if (!isReusable || !signature || !authorizationCode) {
    return null;
  }

  await supabase
    .from('customer_saved_payment_methods')
    .update({ is_default: false })
    .eq('merchant_id', merchantId)
    .eq('customer_id', customerId)
    .eq('provider', 'paystack');

  const payload = {
    merchant_id: merchantId,
    customer_id: customerId,
    provider: 'paystack' as const,
    provider_customer_email: customerEmail,
    authorization_code: authorizationCode,
    authorization_signature: signature,
    authorization_data: authorization,
    brand: authorization.brand ?? null,
    bank: authorization.bank ?? null,
    card_type: authorization.card_type ?? null,
    last4: authorization.last4 ?? null,
    exp_month: authorization.exp_month ?? null,
    exp_year: authorization.exp_year ?? null,
    country_code: authorization.country_code ?? null,
    reusable: true,
    is_default: true,
    is_active: true,
    disabled_at: null,
    last_used_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('customer_saved_payment_methods')
    .upsert(payload, {
      onConflict: 'customer_id,provider,authorization_signature',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.id === 'string' ? data.id : null;
}

export async function getSavedPaymentMethodById({
  supabase,
  merchantId,
  customerId,
  savedPaymentMethodId,
}: {
  supabase: SupabaseClient;
  merchantId: string;
  customerId: string;
  savedPaymentMethodId: string;
}) {
  const { data, error } = await supabase
    .from('customer_saved_payment_methods')
    .select(
      'id, provider, provider_customer_email, authorization_code, authorization_data, brand, bank, card_type, last4, exp_month, exp_year, is_default, is_active'
    )
    .eq('id', savedPaymentMethodId)
    .eq('merchant_id', merchantId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
