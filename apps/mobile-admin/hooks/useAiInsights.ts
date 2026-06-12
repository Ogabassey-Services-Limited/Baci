import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
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
  const { session, isLoading: isAuthLoading } = useAuth();

  return useQuery<AiInsightsResponse>({
    queryKey: ['ai-insights'],
    queryFn: () => apiClient<AiInsightsResponse>('/api/analytics/insights'),
    enabled: !!session?.access_token && !isAuthLoading,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });
}
