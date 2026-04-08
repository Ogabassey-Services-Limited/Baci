import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { z } from 'zod';
import { CONFIG } from '@/lib/config';
import { fetchWithTimeout, SHORT_TIMEOUT } from '@/lib/fetch-with-timeout';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://ogabassey.usebaci.com';

const HISTORY_FILTER_TO_API_TYPE = {
  airtime: 'airtime',
  data: 'data',
  tv: 'cable_tv',
  power: 'electricity',
  gaming: 'betting',
} as const;

const VTUHistoryTransactionSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  type: z.enum(['airtime', 'data', 'electricity', 'cable_tv', 'betting']),
  status: z.enum(['pending', 'successful', 'failed']),
  amount: z.number(),
  network_provider: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  biller_name: z.string().nullable().optional(),
  biller_item_code: z.string().nullable().optional(),
  customer_identifier: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  request_reference: z.string(),
  error_message: z.string().nullable().optional(),
  customer_cashback: z.number().nullable().optional(),
});

const VTUHistoryResponseSchema = z.object({
  transactions: z.array(VTUHistoryTransactionSchema),
});

export type UtilityHistoryFilter =
  | 'all'
  | keyof typeof HISTORY_FILTER_TO_API_TYPE;

export type VTUHistoryTransaction = z.infer<typeof VTUHistoryTransactionSchema>;

export const vtuHistoryKeys = {
  all: ['vtu', 'history'] as const,
  byFilter: (filter: UtilityHistoryFilter, limit: number) =>
    [...vtuHistoryKeys.all, filter, limit] as const,
};

function getApiTypeForFilter(filter: UtilityHistoryFilter) {
  return filter === 'all' ? null : HISTORY_FILTER_TO_API_TYPE[filter];
}

export function useVTUHistory(filter: UtilityHistoryFilter, limit = 20) {
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: vtuHistoryKeys.byFilter(filter, limit),
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const query = new URLSearchParams({
        merchantSlug: CONFIG.MERCHANT_SLUG,
        limit: String(limit),
      });
      const apiType = getApiTypeForFilter(filter);
      if (apiType) {
        query.set('type', apiType);
      }

      const response = await fetchWithTimeout(
        `${API_URL}/api/vtu/history?${query.toString()}`,
        {
          method: 'GET',
          timeout: SHORT_TIMEOUT,
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token && {
              Authorization: `Bearer ${session.access_token}`,
            }),
          },
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load utility history.');
      }

      const parsed = VTUHistoryResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error('Invalid utility history response from server.');
      }

      return parsed.data.transactions;
    },
  });
}
