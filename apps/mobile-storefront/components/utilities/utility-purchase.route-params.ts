import {
  NETWORK_PROVIDERS,
  type NetworkProviderId,
} from '@/constants/network-providers';
import type {
  RawRouteRepeatParams,
  UtilityPurchaseResult,
} from '@/components/utilities/utility-purchase.types';

export interface UtilityRouteParams extends RawRouteRepeatParams {
  type: string;
  paymentStatus?: string;
  reference?: string;
  amount?: string;
  customerIdentifier?: string;
  cashbackAmount?: string;
  cashbackNewBalance?: string;
  voucherPin?: string;
}

export type UtilityRouteSuccessData = Omit<UtilityPurchaseResult, 'voucherPin'> & {
  voucherPin: string | null;
};

export type UtilityRouteParamKey = keyof UtilityRouteParams;

export const UTILITY_ROUTE_PARAM_KEYS = [
  'amount',
  'cashbackAmount',
  'cashbackNewBalance',
  'customerIdentifier',
  'paymentStatus',
  'reference',
  'repeatAmount',
  'repeatBillerName',
  'repeatBillItemIdentifier',
  'repeatCustomerIdentifier',
  'repeatCustomerName',
  'repeatDataPlanCode',
  'repeatNetworkProvider',
  'repeatPhoneNumber',
  'repeatVerified',
  'type',
  'voucherPin',
] as const satisfies readonly UtilityRouteParamKey[];

export function getNetworkProviderId(
  value: string | undefined
): NetworkProviderId | undefined {
  return NETWORK_PROVIDERS.find((provider) => provider.id === value)?.id;
}

function safeParseNumber(value: string | undefined, fallback = 0) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function toUtilityRouteParams(
  rawParams: Partial<Record<UtilityRouteParamKey, string | string[]>>
): UtilityRouteParams {
  return UTILITY_ROUTE_PARAM_KEYS.reduce<UtilityRouteParams>(
    (routeParams, key) => {
      const value = getSearchParamValue(rawParams[key]);

      if (key === 'type') {
        routeParams.type = value ?? '';
        return routeParams;
      }

      routeParams[key] = value;
      return routeParams;
    },
    { type: '' }
  );
}

export function getParamSuccessData(
  params: UtilityRouteParams
): UtilityRouteSuccessData | null {
  const hasPaymentStatus =
    params.paymentStatus === 'successful' ||
    params.paymentStatus === 'processing';

  if (!hasPaymentStatus || !params.reference) {
    return null;
  }

  return {
    amount: safeParseNumber(params.amount),
    cashback:
      params.cashbackAmount && params.cashbackNewBalance
        ? {
            amount: safeParseNumber(params.cashbackAmount),
            newBalance: safeParseNumber(params.cashbackNewBalance),
          }
        : undefined,
    customerIdentifier: params.customerIdentifier,
    reference: params.reference,
    status: params.paymentStatus as 'processing' | 'successful',
    voucherPin: params.voucherPin ?? null,
  };
}
