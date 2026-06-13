import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';
import { apiClient } from '@/lib/api-client';

export interface AiInsight {
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral' | 'opportunity';
  priority: 'high' | 'medium' | 'low';
  action?: string;
}

export interface AiInsightsResponse {
  insights: AiInsight[];
}

export function useAiInsights() {
  const { session, user, isLoading: isAuthLoading } = useAuth();
  const { merchant, isLoading: isMerchantLoading } = useMerchant();
  const merchantId = merchant?.id;
  const userId = user?.id;

  return useQuery<AiInsightsResponse>({
    queryKey: ['ai-insights', merchantId, userId],
    queryFn: () => apiClient<AiInsightsResponse>('/api/analytics/insights'),
    enabled: Boolean(
      session?.access_token &&
        merchantId &&
        userId &&
        !isAuthLoading &&
        !isMerchantLoading
    ),
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });
}
