import type { UtilityRepeatDefaults } from '@/lib/utility-repeat';
import {
  type RouteRepeatParams,
  VALID_UTILITY_TYPES,
  type ValidUtilityType,
} from './utility-purchase.types';

export const UTILITY_TYPE_TITLES: Record<ValidUtilityType, string> = {
  airtime: 'Airtime',
  data: 'Data',
  tv: 'TV',
  power: 'Electricity',
  gaming: 'Betting',
};

export function isValidUtilityType(value: string): value is ValidUtilityType {
  return (VALID_UTILITY_TYPES as readonly string[]).includes(value);
}

export function getRouteRepeatDefaults(
  params: RouteRepeatParams
): UtilityRepeatDefaults {
  return {
    amount: params.repeatAmount,
    billerName: params.repeatBillerName,
    billItemIdentifier: params.repeatBillItemIdentifier,
    customerIdentifier: params.repeatCustomerIdentifier,
    dataPlanCode: params.repeatDataPlanCode,
    isVerified: params.repeatVerified === '1',
    networkProvider: params.repeatNetworkProvider,
    phoneNumber: params.repeatPhoneNumber,
  };
}
