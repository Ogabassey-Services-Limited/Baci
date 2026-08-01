import type {
  MerchantTrustProfileReturnFee,
  MerchantTrustProfileReturnMethod,
  MerchantTrustProfileShippingFeeType,
} from '@baci/shared';
import type { MerchantTrustProfileDraft } from '../../../../../../../packages/shared/src/contracts/merchant-trust-profile';

export interface TrustFormValues {
  foundedYear: string;
  whatsappNumber: string;
  supportHoursSummary: string;
  supportTimezone: string;
  supportResponseTimeSummary: string;
  returnPolicySummary: string;
  returnWindowDays: string;
  returnMethod: string;
  returnFees: string;
  shippingSummary: string;
  shippingRegions: string;
  handlingDaysMin: string;
  handlingDaysMax: string;
  transitDaysMin: string;
  transitDaysMax: string;
  shippingFeeType: string;
  warrantySummary: string;
}

export type TrustFieldName = keyof TrustFormValues;

export const INTEGER_FIELD_NAMES: TrustFieldName[] = [
  'foundedYear',
  'returnWindowDays',
  'handlingDaysMin',
  'handlingDaysMax',
  'transitDaysMin',
  'transitDaysMax',
];

function toInputString(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

function normalizeString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeEnum<T extends string>(value: string): T | null {
  const trimmed = value.trim();
  return trimmed ? (trimmed as T) : null;
}

function normalizeRegions(value: string): string[] | null {
  const regions = value
    .split(',')
    .map((region) => region.trim())
    .filter(Boolean);
  return regions.length > 0 ? regions : null;
}

export function createTrustFormValues(
  profile: MerchantTrustProfileDraft | null
): TrustFormValues {
  return {
    foundedYear: toInputString(profile?.founded_year),
    whatsappNumber: profile?.customer_service?.whatsapp_number ?? '',
    supportHoursSummary: profile?.customer_service?.hours_summary ?? '',
    supportTimezone: profile?.customer_service?.timezone ?? '',
    supportResponseTimeSummary:
      profile?.customer_service?.response_time_summary ?? '',
    returnPolicySummary: profile?.return_policy?.summary ?? '',
    returnWindowDays: toInputString(profile?.return_policy?.window_days),
    returnMethod: profile?.return_policy?.return_method ?? '',
    returnFees: profile?.return_policy?.return_fees ?? '',
    shippingSummary: profile?.shipping_policy?.summary ?? '',
    shippingRegions: profile?.shipping_policy?.regions?.join(', ') ?? '',
    handlingDaysMin: toInputString(profile?.shipping_policy?.handling_days_min),
    handlingDaysMax: toInputString(profile?.shipping_policy?.handling_days_max),
    transitDaysMin: toInputString(profile?.shipping_policy?.transit_days_min),
    transitDaysMax: toInputString(profile?.shipping_policy?.transit_days_max),
    shippingFeeType: profile?.shipping_policy?.shipping_fee_type ?? '',
    warrantySummary: profile?.warranty_policy?.summary ?? '',
  };
}

export function buildTrustProfile(
  values: TrustFormValues
): MerchantTrustProfileDraft {
  return {
    founded_year: normalizeInteger(values.foundedYear),
    customer_service: {
      whatsapp_number: normalizeString(values.whatsappNumber),
      hours_summary: normalizeString(values.supportHoursSummary),
      timezone: normalizeString(values.supportTimezone),
      response_time_summary: normalizeString(values.supportResponseTimeSummary),
    },
    return_policy: {
      summary: normalizeString(values.returnPolicySummary),
      window_days: normalizeInteger(values.returnWindowDays),
      return_method: normalizeEnum<MerchantTrustProfileReturnMethod>(
        values.returnMethod
      ),
      return_fees: normalizeEnum<MerchantTrustProfileReturnFee>(
        values.returnFees
      ),
    },
    shipping_policy: {
      summary: normalizeString(values.shippingSummary),
      regions: normalizeRegions(values.shippingRegions),
      handling_days_min: normalizeInteger(values.handlingDaysMin),
      handling_days_max: normalizeInteger(values.handlingDaysMax),
      transit_days_min: normalizeInteger(values.transitDaysMin),
      transit_days_max: normalizeInteger(values.transitDaysMax),
      shipping_fee_type: normalizeEnum<MerchantTrustProfileShippingFeeType>(
        values.shippingFeeType
      ),
    },
    warranty_policy: { summary: normalizeString(values.warrantySummary) },
  };
}
