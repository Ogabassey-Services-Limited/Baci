import type {
  UtilityHistoryFilter,
  VTUHistoryTransaction,
} from '@/hooks/use-vtu-history';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import {
  UTILITY_HISTORY_PAYMENT_RECEIVED_STATUS,
  UTILITY_HISTORY_FILTERS,
  UTILITY_HISTORY_STATUS_COLORS,
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

type UtilityHistoryStatusData = Pick<
  VTUHistoryTransaction,
  'payment_status' | 'status'
>;

export const utilityHistoryHelpers = {
  formatAmount(amount: number): string {
    return formatNgnCurrency(amount);
  },

  formatDate(dateString: string) {
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
  },

  getTransactionDetail(transaction: UtilityHistoryDetailData) {
    if (transaction.type === 'airtime' || transaction.type === 'data') {
      return transaction.phone_number || 'Phone number unavailable';
    }

    return (
      transaction.customer_identifier ||
      transaction.customer_name ||
      'Customer identifier unavailable'
    );
  },

  getTransactionTitle(transaction: UtilityHistoryTitleData) {
    return (
      transaction.biller_name ||
      transaction.network_provider ||
      UTILITY_HISTORY_TYPE_LABELS[transaction.type] ||
      'Utility payment'
    );
  },

  getDisplayStatus(transaction: UtilityHistoryStatusData) {
    if (
      transaction.status !== 'successful' &&
      transaction.payment_status === 'completed'
    ) {
      return {
        color: UTILITY_HISTORY_STATUS_COLORS.paymentReceived,
        label: UTILITY_HISTORY_PAYMENT_RECEIVED_STATUS.label,
        message: UTILITY_HISTORY_PAYMENT_RECEIVED_STATUS.message,
      };
    }

    return {
      color: UTILITY_HISTORY_STATUS_COLORS[transaction.status],
      label: transaction.status,
      message: null,
    };
  },

  resolveFilter(type?: string): UtilityHistoryFilter {
    return UTILITY_HISTORY_FILTERS.some((filter) => filter.id === type)
      ? (type as UtilityHistoryFilter)
      : 'all';
  },
} as const;
