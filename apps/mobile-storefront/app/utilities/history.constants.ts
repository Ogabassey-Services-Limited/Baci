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

export const UTILITY_HISTORY_STATUS_COLORS = {
  failed: palette.red[700],
  pending: palette.amber[800],
  successful: palette.emerald[700],
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
