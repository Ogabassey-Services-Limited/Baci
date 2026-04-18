export const TRUST_PROFILE_RETURN_METHODS = [
  'mail',
  'in_store',
  'carrier_dropoff',
] as const;

export type MerchantTrustProfileReturnMethod =
  (typeof TRUST_PROFILE_RETURN_METHODS)[number];

export const TRUST_PROFILE_RETURN_FEES = [
  'free',
  'customer_pays',
  'original_shipping_deducted',
] as const;

export type MerchantTrustProfileReturnFee =
  (typeof TRUST_PROFILE_RETURN_FEES)[number];

export const TRUST_PROFILE_SHIPPING_FEE_TYPES = [
  'free',
  'flat_rate',
  'calculated',
] as const;

export type MerchantTrustProfileShippingFeeType =
  (typeof TRUST_PROFILE_SHIPPING_FEE_TYPES)[number];

export interface MerchantTrustProfileDraft {
  founded_year?: number | null;
  customer_service?: {
    whatsapp_number?: string | null;
    hours_summary?: string | null;
    timezone?: string | null;
    response_time_summary?: string | null;
  } | null;
  return_policy?: {
    summary?: string | null;
    window_days?: number | null;
    return_method?: MerchantTrustProfileReturnMethod | null;
    return_fees?: MerchantTrustProfileReturnFee | null;
  } | null;
  shipping_policy?: {
    summary?: string | null;
    regions?: string[] | null;
    handling_days_min?: number | null;
    handling_days_max?: number | null;
    transit_days_min?: number | null;
    transit_days_max?: number | null;
    shipping_fee_type?: MerchantTrustProfileShippingFeeType | null;
  } | null;
  warranty_policy?: {
    summary?: string | null;
  } | null;
}
