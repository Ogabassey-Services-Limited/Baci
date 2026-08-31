import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveJumiaMarketplaceCurrency } from '@/lib/jumia/jumia-marketplace-currency';

export async function loadJumiaMarketplaceCurrency(
  supabase: SupabaseClient,
  merchantId: string,
  integrationId: string
): Promise<
  { ok: true; currency: string } | { ok: false; status: number; error: string }
> {
  const { data, error } = await supabase
    .from('marketplace_integrations')
    .select('country_code')
    .eq('id', integrationId)
    .eq('merchant_id', merchantId)
    .eq('platform', 'jumia')
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      error: 'Failed to load Jumia integration currency',
    };
  }

  const currency = resolveJumiaMarketplaceCurrency(data?.country_code);
  if (!currency.ok) {
    return {
      ok: false,
      status: 400,
      error: currency.error,
    };
  }

  return {
    ok: true,
    currency: currency.currency,
  };
}

/** Ensure prices are expressed in the merchant's configured settlement currency. */
export async function validateJumiaMarketplaceCurrencyForMerchant(
  supabase: SupabaseClient,
  merchantId: string,
  marketplaceCurrency: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from('merchants')
    .select('payout_currency')
    .eq('id', merchantId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      error: 'Failed to load merchant currency',
    };
  }

  const merchantCurrency = data?.payout_currency?.trim().toUpperCase();
  if (!merchantCurrency) {
    return {
      ok: false,
      status: 400,
      error: 'Merchant is missing a payout currency',
    };
  }
  if (merchantCurrency !== marketplaceCurrency.toUpperCase()) {
    return {
      ok: false,
      status: 400,
      error: `Jumia marketplace currency ${marketplaceCurrency} does not match merchant payout currency ${merchantCurrency}`,
    };
  }

  return { ok: true };
}
