import type {
  UtilityHistoryFilter,
  VTUHistoryTransaction,
} from '@/hooks/use-vtu-history';
import {
  UTILITY_HISTORY_FILTERS,
  UTILITY_HISTORY_TYPE_LABELS,
} from './history.constants';

type UtilityHistoryTitleData = Pick<
  VTUHistoryTransaction,
  'biller_name' | 'network_provider' | 'type'
>;

type UtilityHistoryDetailData = Pick<
  VTUHistoryTransaction,
  'customer_identifier' | 'customer_name' | 'phone_number' | 'type'
>;

export function resolveUtilityHistoryFilter(
  type?: string
): UtilityHistoryFilter {
  return UTILITY_HISTORY_FILTERS.some((filter) => filter.id === type)
    ? (type as UtilityHistoryFilter)
    : 'all';
}

export function formatUtilityHistoryAmount(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatUtilityHistoryDate(dateString: string) {
  const parsedDate = new Date(dateString);

  if (Number.isNaN(parsedDate.getTime())) {
    return '-';
  }

  return parsedDate.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getUtilityHistoryTransactionTitle(
  transaction: UtilityHistoryTitleData
) {
  return (
    transaction.biller_name ||
    transaction.network_provider ||
    UTILITY_HISTORY_TYPE_LABELS[transaction.type] ||
    'Utility payment'
  );
}

export function getUtilityHistoryTransactionDetail(
  transaction: UtilityHistoryDetailData
) {
  if (transaction.type === 'airtime' || transaction.type === 'data') {
    return transaction.phone_number || 'Phone number unavailable';
  }

  return (
    transaction.customer_identifier ||
    transaction.customer_name ||
    'Customer identifier unavailable'
  );
}
