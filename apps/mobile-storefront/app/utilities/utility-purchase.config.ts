import type { UtilityRepeatDefaults } from '@/lib/utility-repeat';
import {
  type RawRouteRepeatParams,
  type RouteRepeatParams,
  VALID_UTILITY_TYPES,
  type ValidUtilityType,
} from './utility-purchase.types';

export const UTILITY_TYPE_TITLES: Record<ValidUtilityType, string> = {
  airtime: 'Airtime',
  data: 'Data',
  tv: 'TV',
  power: 'Electricity',
  // `gaming` is the internal Kuda bill category; storefront copy uses the domain label "Betting".
  gaming: 'Betting',
};

export function isValidUtilityType(value: string): value is ValidUtilityType {
  return (VALID_UTILITY_TYPES as readonly string[]).includes(value);
}

export function isBillUtilityType(
  type: ValidUtilityType
): type is 'tv' | 'power' | 'gaming' {
  return type === 'tv' || type === 'power' || type === 'gaming';
}

export function getRouteRepeatDefaults(
  params: RawRouteRepeatParams | RouteRepeatParams
): UtilityRepeatDefaults {
  return {
    amount:
      params.repeatAmount == null ? undefined : String(params.repeatAmount),
    billerName: params.repeatBillerName,
    billItemIdentifier: params.repeatBillItemIdentifier,
    customerIdentifier: params.repeatCustomerIdentifier,
    dataPlanCode: params.repeatDataPlanCode,
    isVerified:
      params.repeatVerified === true ||
      params.repeatVerified === 1 ||
      params.repeatVerified === '1' ||
      params.repeatVerified === 'true',
    networkProvider: params.repeatNetworkProvider,
    phoneNumber: params.repeatPhoneNumber,
  };
}
