import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMerchantCurrencyConfig } from '@/lib/resolve-merchant-currency';
import type { Database } from '@/types/supabase';

type AdminGiglEligibilityResult =
  | { ok: true }
  | {
      ok: false;
      status: 422 | 500;
      body: { error: string; code?: string };
    };

function includesGigl(value: unknown) {
  return (
    Array.isArray(value) &&
    value.some(
      (provider) =>
        typeof provider === 'string' && provider.trim().toLowerCase() === 'gigl'
    )
  );
}

export async function resolveAdminGiglEligibility(
  supabase: SupabaseClient<Database>,
  merchantId: string
): Promise<AdminGiglEligibilityResult> {
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('country, payout_currency')
    .eq('id', merchantId)
    .maybeSingle();
  if (merchantError) {
    return {
      ok: false,
      status: 500,
      body: { error: 'Failed to resolve merchant eligibility' },
    };
  }

  const country = merchant?.country?.trim().toUpperCase();
  const currency = merchant
    ? resolveMerchantCurrencyConfig(merchant).code
    : null;
  if (!merchant || currency !== 'NGN' || (country && country !== 'NG')) {
    return {
      ok: false,
      status: 422,
      body: {
        error: 'GIGL quotes are available only for Nigerian NGN merchants',
        code: 'GIGL_MERCHANT_INELIGIBLE',
      },
    };
  }

  const { data: settings, error: settingsError } = await supabase
    .from('merchant_feature_settings')
    .select('shipping_providers')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (
    settingsError ||
    !settings ||
    !includesGigl(settings.shipping_providers)
  ) {
    return {
      ok: false,
      status: 422,
      body: {
        error: 'GIGL shipping is not enabled for this merchant',
        code: 'GIGL_PROVIDER_DISABLED',
      },
    };
  }

  return { ok: true };
}
