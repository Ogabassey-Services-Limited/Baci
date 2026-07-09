import { formatMerchantAmount } from '@/lib/format-merchant-currency';

/**
 * Formats an order total using the currency's own locale conventions
 * (`formatMerchantAmount`) instead of hardcoding `en-NG` for every currency.
 */
export function formatPrice(amount: number, currency = 'NGN') {
  return formatMerchantAmount(
    amount,
    { payout_currency: currency },
    { minimumFractionDigits: 0 }
  );
}
