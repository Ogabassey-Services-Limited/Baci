import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient, NetworkError } from '@/lib/api-client';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
import { tryRefreshStoreReadiness } from '@/lib/try-refresh-store-readiness';

interface PublishStoreResponse {
  message?: string;
  success: boolean;
}

interface UseStorePublishOptions {
  merchantId?: string | null;
  onPublished?: () => Promise<unknown>;
}

function buildPublishErrorMessage(error: NetworkError): string {
  const body = error.data;
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const missingItems = Array.isArray(record.missingItems)
      ? record.missingItems.filter(
          (item): item is string => typeof item === 'string'
        )
      : [];
    const header =
      typeof record.message === 'string' && record.message
        ? record.message
        : typeof record.error === 'string' && record.error
          ? record.error
          : error.message;

    if (missingItems.length > 0) {
      return `${header}\n- ${missingItems.join('\n- ')}`;
    }
    return header;
  }

  return error.message || 'Failed to publish store.';
}

interface ExecutePublishOptions {
  merchantId: string;
  onPublished?: () => Promise<unknown>;
  queryClient: QueryClient;
  setIsPublishing: (publishing: boolean) => void;
}

// Module-scope helper: the try/finally (and throws inside try/catch) cannot
// live in the hook body because React Compiler does not lower that syntax yet.
async function executePublish({
  merchantId,
  onPublished,
  queryClient,
  setIsPublishing,
}: ExecutePublishOptions): Promise<void> {
  setIsPublishing(true);

  try {
    try {
      await apiClient<PublishStoreResponse>('/api/merchant/publish', {
        method: 'POST',
        body: JSON.stringify({ merchantId }),
      });
    } catch (error) {
      // apiClient throws NetworkError on any non-2xx. The publish route
      // returns 400 with { error, message, missingItems } for validation
      // failures — surface those details so the caller can show the user
      // which setup steps are still blocking publication.
      if (error instanceof NetworkError) {
        throw new Error(buildPublishErrorMessage(error));
      }
      throw error;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['merchant'] }),
      tryRefreshStoreReadiness(() =>
        invalidateStoreReadiness(queryClient, merchantId)
      ),
      queryClient.invalidateQueries({ queryKey: ['merchant-payout'] }),
    ]);

    await onPublished?.();
  } finally {
    setIsPublishing(false);
  }
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

    await executePublish({
      merchantId,
      onPublished,
      queryClient,
      setIsPublishing,
    });
  }

  return {
    isPublishing,
    publishStore,
  };
}
