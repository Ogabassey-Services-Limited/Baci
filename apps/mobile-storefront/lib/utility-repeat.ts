import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import { createLogger } from '@/lib/logger';

export type UtilityRouteType = 'airtime' | 'data' | 'tv' | 'power' | 'gaming';

export interface UtilityRepeatRouteParams {
  repeatAmount?: string;
  repeatBillerName?: string;
  repeatBillItemIdentifier?: string;
  repeatCustomerIdentifier?: string;
  repeatDataPlanCode?: string;
  repeatNetworkProvider?: string;
  repeatPhoneNumber?: string;
  repeatVerified?: '1';
  type: UtilityRouteType;
}

export interface UtilityRepeatDefaults {
  amount?: string;
  billerName?: string;
  billItemIdentifier?: string;
  customerIdentifier?: string;
  dataPlanCode?: string;
  isVerified?: boolean;
  networkProvider?: string;
  phoneNumber?: string;
}

const HISTORY_TYPE_TO_UTILITY_ROUTE = {
  airtime: 'airtime',
  data: 'data',
  electricity: 'power',
  cable_tv: 'tv',
  betting: 'gaming',
} as const satisfies Record<VTUHistoryTransaction['type'], UtilityRouteType>;

const KUDA_TO_MOBILE_PROVIDER: Record<string, string> = {
  '9MOBILE': 't2',
  AIRTEL: 'airtel',
  GLO: 'glo',
  MTN: 'mtn',
};

const NORMALIZED_MOBILE_PROVIDER_SLUGS = new Set(['airtel', 'glo', 'mtn', 't2']);

const log = createLogger('UtilityRepeat');

function toProviderSlug(networkProvider: string): string {
  return networkProvider
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getRepeatProvider(networkProvider?: string | null): string | undefined {
  if (!networkProvider) {
    return undefined;
  }

  const trimmedProvider = networkProvider.trim();
  if (!trimmedProvider) {
    return undefined;
  }

  const mappedProvider = KUDA_TO_MOBILE_PROVIDER[trimmedProvider.toUpperCase()];
  if (mappedProvider) {
    return mappedProvider;
  }

  const fallbackProvider = toProviderSlug(trimmedProvider);
  if (!fallbackProvider) {
    return undefined;
  }

  if (!NORMALIZED_MOBILE_PROVIDER_SLUGS.has(fallbackProvider)) {
    log.warn('Unknown repeat provider received', {
      fallbackProvider,
      networkProvider: trimmedProvider,
    });
  }

  return fallbackProvider;
}

function getRouteType(
  type: VTUHistoryTransaction['type']
): UtilityRouteType {
  return HISTORY_TYPE_TO_UTILITY_ROUTE[type];
}

function getDefaults(
  transaction: VTUHistoryTransaction
): UtilityRepeatDefaults {
  const amount =
    transaction.amount != null && Number.isFinite(transaction.amount)
      ? String(transaction.amount)
      : undefined;
  const networkProvider = getRepeatProvider(transaction.network_provider);

  return {
    ...(amount && { amount }),
    ...(transaction.biller_name && {
      billerName: transaction.biller_name,
    }),
    ...(transaction.biller_item_code && {
      billItemIdentifier: transaction.biller_item_code,
    }),
    ...(transaction.customer_identifier && {
      customerIdentifier: transaction.customer_identifier,
    }),
    ...(transaction.phone_number && {
      phoneNumber: transaction.phone_number,
    }),
    ...(transaction.repeat_data_plan_code && {
      dataPlanCode: transaction.repeat_data_plan_code,
    }),
    ...(transaction.status === 'successful' && { isVerified: true }),
    ...(networkProvider && { networkProvider }),
  };
}

function getRouteParams(
  transaction: VTUHistoryTransaction
): UtilityRepeatRouteParams {
  const defaults = getDefaults(transaction);

  return {
    type: getRouteType(transaction.type),
    ...(defaults.amount && { repeatAmount: defaults.amount }),
    ...(defaults.billerName && { repeatBillerName: defaults.billerName }),
    ...(defaults.billItemIdentifier && {
      repeatBillItemIdentifier: defaults.billItemIdentifier,
    }),
    ...(defaults.customerIdentifier && {
      repeatCustomerIdentifier: defaults.customerIdentifier,
    }),
    ...(defaults.dataPlanCode && { repeatDataPlanCode: defaults.dataPlanCode }),
    ...(defaults.networkProvider && {
      repeatNetworkProvider: defaults.networkProvider,
    }),
    ...(defaults.phoneNumber && { repeatPhoneNumber: defaults.phoneNumber }),
    ...(defaults.isVerified && { repeatVerified: '1' }),
  };
}

export const utilityRepeatHelpers = {
  getDefaults,
  getRouteParams,
  getRouteType,
} as const;
