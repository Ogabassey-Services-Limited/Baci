import type { WebsiteAnalyticsResponse } from '@baci/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';

export function useWebsiteAnalytics() {
  const { isLoading: isAuthLoading, session } = useAuth();

  return useQuery<WebsiteAnalyticsResponse>({
    queryFn: () => apiClient('/api/analytics/website-performance'),
    queryKey: ['website-analytics'],
    enabled: !isAuthLoading && !!session?.access_token,
  });
}
