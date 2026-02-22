import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HeroCarouselSlide } from '@baci/shared';
import { apiClient } from '@/lib/api-client';

export type { HeroCarouselSlide } from '@baci/shared';

interface HeroCarouselResponse {
  slides: HeroCarouselSlide[];
  source: 'mobile_hero_slides' | 'none';
  driftDetected: boolean;
}

interface HeroCarouselUpdateResponse {
  success: boolean;
  slides: HeroCarouselSlide[];
}

const QUERY_KEY = ['hero-carousel-settings'];

export function useHeroCarouselSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient<HeroCarouselResponse>(
        '/api/merchant/hero-carousel'
      );
      return response;
    },
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (slides: HeroCarouselSlide[]) => {
      const response = await apiClient<HeroCarouselUpdateResponse>(
        '/api/merchant/hero-carousel',
        {
          method: 'PUT',
          body: JSON.stringify({ slides }),
        }
      );

      return response;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['merchant'] }),
        queryClient.invalidateQueries({ queryKey: ['store-readiness'] }),
      ]);
    },
  });

  return {
    slides: query.data?.slides ?? [],
    source: query.data?.source ?? 'none',
    driftDetected: query.data?.driftDetected ?? false,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    saveSlides: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
