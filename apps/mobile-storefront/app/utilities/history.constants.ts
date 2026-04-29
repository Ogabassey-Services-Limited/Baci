import { palette } from '@/constants/Colors';
import type {
  UtilityHistoryFilter,
  VTUHistoryTransaction,
} from '@/hooks/use-vtu-history';

export const UTILITY_HISTORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'airtime', label: 'Airtime' },
  { id: 'data', label: 'Data' },
  { id: 'power', label: 'Power' },
  { id: 'tv', label: 'TV' },
  { id: 'gaming', label: 'Gaming' },
] as const satisfies ReadonlyArray<{
  id: UtilityHistoryFilter;
  label: string;
}>;

export const UTILITY_HISTORY_TYPE_LABELS = {
  airtime: 'Airtime',
  data: 'Data',
  electricity: 'Power',
  cable_tv: 'TV',
  betting: 'Gaming',
} as const satisfies Record<VTUHistoryTransaction['type'], string>;

export type UtilityHistoryStatusColorKey =
  | VTUHistoryTransaction['status']
  | 'paymentReceived';

export type UtilityHistoryStatusMetaKey = UtilityHistoryStatusColorKey;

export const UTILITY_HISTORY_STATUS_COLORS = {
  failed: palette.red[700],
  paymentReceived: palette.amber[800],
  pending: palette.amber[800],
  processing: palette.amber[800],
  successful: palette.emerald[700],
} as const satisfies Record<UtilityHistoryStatusColorKey, string>;

export const UTILITY_HISTORY_STATUS_META = {
  failed: {
    color: UTILITY_HISTORY_STATUS_COLORS.failed,
    label: 'Failed',
  },
  paymentReceived: {
    color: UTILITY_HISTORY_STATUS_COLORS.paymentReceived,
    label: 'Payment Received',
  },
  pending: {
    color: UTILITY_HISTORY_STATUS_COLORS.pending,
    label: 'Pending',
  },
  processing: {
    color: UTILITY_HISTORY_STATUS_COLORS.processing,
    label: 'Processing',
  },
  successful: {
    color: UTILITY_HISTORY_STATUS_COLORS.successful,
    label: 'Successful',
  },
} as const satisfies Record<
  UtilityHistoryStatusMetaKey,
  { color: string; label: string }
>;

export const DEFAULT_UTILITY_HISTORY_STATUS_COLOR = palette.gray[700];
export const DEFAULT_UTILITY_HISTORY_STATUS_LABEL = 'Unknown';

export const UTILITY_HISTORY_PAYMENT_RECEIVED_STATUS = {
  label: 'Payment Received',
  message: 'Payment received. Tap Sync payment to retry bill fulfillment.',
} as const;

export const UTILITY_HISTORY_STYLE_TOKENS = {
  cardGap: 10,
  cardRadius: 18,
  chipHorizontalPadding: 14,
  chipVerticalPadding: 10,
  contentGap: 12,
  detailTextSize: 13,
  labelTextSize: 13,
  messageLineHeight: 20,
  metaTextSize: 12,
  pillHorizontalPadding: 10,
  pillVerticalPadding: 5,
  referenceTextSize: 12,
  smallGap: 4,
  statePadding: 20,
  stateTitleSize: 18,
  statusTextSize: 11,
  statusTintSuffix: '18',
  touchTargetHeight: 40,
} as const;
