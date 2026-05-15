import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import { createLogger } from '@/lib/logger';

export type UtilityRouteType = 'airtime' | 'data' | 'tv' | 'power' | 'gaming';

export interface UtilityRepeatRouteParams {
  repeatAmount?: string;
  repeatBillerName?: string;
  repeatBillItemIdentifier?: string;
  repeatCustomerIdentifier?: string;
  repeatCustomerName?: string;
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
  customerName?: string;
  dataPlanCode?: string;
  isVerified?: boolean;
  networkProvider?: string;
  phoneNumber?: string;
}

export interface UtilityRepeatRecipient {
  id: string;
  title: string;
  identifierLabel: string;
  identifier: string;
  meta: string;
  defaults: UtilityRepeatDefaults;
}

const HISTORY_TYPE_TO_UTILITY_ROUTE = {
  airtime: 'airtime',
  data: 'data',
  electricity: 'power',
  cable_tv: 'tv',
  betting: 'gaming',
} as const satisfies Record<VTUHistoryTransaction['type'], UtilityRouteType>;

const IDENTIFIER_LABEL_BY_ROUTE_TYPE = {
  airtime: 'Phone Number',
  data: 'Phone Number',
  power: 'Meter Number',
  tv: 'Smartcard Number',
  gaming: 'Account ID',
} as const satisfies Record<UtilityRouteType, string>;

const KUDA_TO_MOBILE_PROVIDER: Record<string, string> = {
  '9MOBILE': 't2',
  AIRTEL: 'airtel',
  GLO: 'glo',
  MTN: 'mtn',
};

const NORMALIZED_MOBILE_PROVIDER_SLUGS = new Set(['airtel', 'glo', 'mtn', 't2']);

const MAX_RECENT_RECIPIENTS = 10;

// NG-only by design. Revisit when the mobile storefront ships in additional markets.
const REPEAT_AMOUNT_FORMATTER = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  maximumFractionDigits: 0,
  style: 'currency',
});

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
  const routeType = HISTORY_TYPE_TO_UTILITY_ROUTE[type];
  if (!routeType) {
    throw new Error(`Unsupported utility history transaction type: ${type}`);
  }
  return routeType;
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
    ...(transaction.customer_name && {
      customerName: transaction.customer_name,
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
    ...(defaults.customerName && {
      repeatCustomerName: defaults.customerName,
    }),
    ...(defaults.dataPlanCode && { repeatDataPlanCode: defaults.dataPlanCode }),
    ...(defaults.networkProvider && {
      repeatNetworkProvider: defaults.networkProvider,
    }),
    ...(defaults.phoneNumber && { repeatPhoneNumber: defaults.phoneNumber }),
    ...(defaults.isVerified && { repeatVerified: '1' }),
  };
}

function getRecipientTitle(
  transaction: VTUHistoryTransaction,
  defaults: UtilityRepeatDefaults
): string {
  return (
    defaults.customerName ||
    defaults.billerName ||
    transaction.network_provider ||
    defaults.phoneNumber ||
    defaults.customerIdentifier ||
    'Recent recipient'
  );
}

function getRecipientIdentifier(
  defaults: UtilityRepeatDefaults
): string | null {
  return defaults.phoneNumber ?? defaults.customerIdentifier ?? null;
}

function getRecipientKey(
  routeType: UtilityRouteType,
  defaults: UtilityRepeatDefaults,
  identifier: string
): string {
  return [
    routeType,
    defaults.networkProvider ?? '',
    defaults.billerName ?? '',
    defaults.billItemIdentifier ?? '',
    defaults.dataPlanCode ?? '',
    identifier,
  ].join(':');
}

function getRecipientMeta(transaction: VTUHistoryTransaction): string {
  return REPEAT_AMOUNT_FORMATTER.format(transaction.amount);
}

function getRecipient(
  transaction: VTUHistoryTransaction,
  requestedType: UtilityRouteType
): UtilityRepeatRecipient | null {
  if (transaction.status !== 'successful') {
    return null;
  }

  let routeType: UtilityRouteType;
  try {
    routeType = getRouteType(transaction.type);
  } catch {
    return null;
  }

  if (routeType !== requestedType) {
    return null;
  }

  const defaults = getDefaults(transaction);
  const identifier = getRecipientIdentifier(defaults);
  if (!identifier) {
    return null;
  }

  return {
    id: transaction.id,
    title: getRecipientTitle(transaction, defaults),
    identifierLabel: IDENTIFIER_LABEL_BY_ROUTE_TYPE[routeType],
    identifier,
    meta: getRecipientMeta(transaction),
    defaults,
  };
}

function getRecentRecipients(
  transactions: VTUHistoryTransaction[] | undefined,
  requestedType: UtilityRouteType
): UtilityRepeatRecipient[] {
  if (!transactions?.length) {
    return [];
  }

  const seen = new Set<string>();
  const recipients: UtilityRepeatRecipient[] = [];

  for (const transaction of transactions) {
    if (recipients.length >= MAX_RECENT_RECIPIENTS) {
      break;
    }

    const recipient = getRecipient(transaction, requestedType);
    if (!recipient) {
      continue;
    }

    const key = getRecipientKey(
      requestedType,
      recipient.defaults,
      recipient.identifier
    );
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    recipients.push(recipient);
  }

  return recipients;
}

export const utilityRepeatHelpers = {
  getDefaults,
  getRecentRecipients,
  getRouteParams,
  getRouteType,
} as const;
