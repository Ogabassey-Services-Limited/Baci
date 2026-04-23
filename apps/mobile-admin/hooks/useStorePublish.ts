import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface PublishStoreResponse {
  message?: string;
  success: boolean;
}

interface UseStorePublishOptions {
  merchantId?: string | null;
  onPublished?: () => Promise<unknown>;
}

export function useStorePublish({
  merchantId,
  onPublished,
}: UseStorePublishOptions) {
  const queryClient = useQueryClient();
  const [isPublishing, setIsPublishing] = useState(false);

  async function publishStore() {
    if (!merchantId) {
      throw new Error('Merchant not loaded. Please try again.');
    }

    setIsPublishing(true);

    try {
      const response = await apiClient<PublishStoreResponse>(
        '/api/merchant/publish',
        {
          method: 'POST',
        }
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to publish store.');
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['merchant'] }),
        queryClient.invalidateQueries({ queryKey: ['store-readiness'] }),
      ]);

      await onPublished?.();
    } finally {
      setIsPublishing(false);
    }
  }

  return {
    isPublishing,
    publishStore,
  };
}
