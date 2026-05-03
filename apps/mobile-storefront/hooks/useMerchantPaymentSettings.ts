import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import type { PaymentMethodType } from '@/components/checkout/PaymentMethodSelector';
import { supabase } from '@/lib/supabase';

const MERCHANT_ID =
  Constants.expoConfig?.extra?.merchantId ||
  '6b5cb8a4-5575-456c-b936-8cdfae30db74';

interface PaymentSettings {
  paystack_enabled: boolean;
  korapay_enabled: boolean;
  juicyway_enabled: boolean;
  credpal_enabled: boolean;
  credit_direct_enabled: boolean;
  pay_on_delivery_enabled: boolean;
  vat_registration_status: string;
  vat_rate: number;
}

/**
 * Fetch merchant payment settings via SECURITY DEFINER RPC.
 * Bypasses RLS so anon/customer sessions can read payment toggles.
 */
export function useMerchantPaymentSettings() {
  return useQuery({
    queryKey: ['merchant-payment-settings', MERCHANT_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_storefront_payment_settings', {
          p_merchant_id: MERCHANT_ID,
        })
        .single();

      if (error) throw error;
      return data as PaymentSettings;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get the tax rate for order calculations.
 * Returns 0 if merchant is not VAT-registered, otherwise the merchant's rate as a decimal.
 */
export function getMerchantTaxRate(
  settings: PaymentSettings | undefined | null
): number {
  if (!settings || settings.vat_registration_status !== 'registered') {
    return 0;
  }
  return (settings.vat_rate ?? 7.5) / 100;
}

/**
 * Convert settings to an array of enabled PaymentMethodType values.
 *
 * Default behavior (when settings are undefined/null — e.g. RPC fails):
 * - Show paystack + bank_transfer only (safe fallback)
 *
 * The RPC already applies COALESCE defaults matching the web's asymmetric logic:
 * - paystack/korapay: on unless explicitly false
 * - everything else: off unless explicitly true
 */
export function getEnabledPaymentMethods(
  settings: PaymentSettings | undefined | null
): PaymentMethodType[] {
  if (!settings) {
    return ['paystack', 'bank_transfer'];
  }

  const methods: PaymentMethodType[] = [];

  if (settings.paystack_enabled) methods.push('paystack');
  if (settings.korapay_enabled) methods.push('korapay');
  if (settings.juicyway_enabled) methods.push('juicyway');
  if (settings.pay_on_delivery_enabled) methods.push('pay_on_delivery');
  if (settings.credpal_enabled) methods.push('credpal');
  if (settings.credit_direct_enabled) methods.push('credit_direct');

  // Bank transfer is a Paystack sub-feature (DVA), include when paystack is enabled
  if (settings.paystack_enabled) methods.push('bank_transfer');

  return methods;
}
