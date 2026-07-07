import type { ColorSchemeName } from 'react-native';
import {
  type RawRouteRepeatParams,
  type RouteRepeatParams,
  VALID_UTILITY_TYPES,
  type ValidUtilityType,
} from '@/components/utilities/utility-purchase.types';
import { BRAND } from '@/constants/Colors';
import type { UtilityRepeatDefaults } from '@/lib/utility-repeat';

export const UTILITY_TYPE_TITLES: Record<ValidUtilityType, string> = {
  airtime: 'Airtime',
  data: 'Data',
  tv: 'TV',
  power: 'Electricity',
  // `gaming` is the internal Kuda bill category; storefront copy uses the domain label "Betting".
  gaming: 'Betting',
};

/**
 * History (receipt) icon color for the utility header. Brand yellow reads
 * well on dark surfaces but gets lost on light ones — use brand red there.
 */
export function getUtilityHistoryIconColor(
  colorScheme: ColorSchemeName | null | undefined
): string {
  return colorScheme === 'dark' ? BRAND.secondary : BRAND.primary;
}

export function isValidUtilityType(value: string): value is ValidUtilityType {
  return (VALID_UTILITY_TYPES as readonly string[]).includes(value);
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
    customerName: params.repeatCustomerName,
    address: params.repeatCustomerAddress,
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
