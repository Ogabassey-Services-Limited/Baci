import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { apiClient, NetworkError } from '@/lib/api-client';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
import { tryRefreshStoreReadiness } from '@/lib/try-refresh-store-readiness';

interface PublishStoreResponse {
  message?: string;
  success: boolean;
}

export type StorePublishResult = { status: 'published' } | { status: 'stale' };

interface MerchantScope {
  merchantId: string | null;
  revision: number;
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
  merchantRevision: number;
  isActiveMerchant: (merchantId: string, merchantRevision: number) => boolean;
  onPublished?: () => Promise<unknown>;
  queryClient: QueryClient;
  setPublishingScope: (scope: MerchantScope | null) => void;
}

// Module-scope helper: the try/finally (and throws inside try/catch) cannot
// live in the hook body because React Compiler does not lower that syntax yet.
async function executePublish({
  merchantId,
  merchantRevision,
  isActiveMerchant,
  onPublished,
  queryClient,
  setPublishingScope,
}: ExecutePublishOptions): Promise<StorePublishResult> {
  const submittedScope = { merchantId, revision: merchantRevision };
  setPublishingScope(submittedScope);

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

    if (!isActiveMerchant(merchantId, merchantRevision)) {
      return { status: 'stale' };
    }

    await onPublished?.();
    return {
      status: isActiveMerchant(merchantId, merchantRevision)
        ? 'published'
        : 'stale',
    };
  } catch (error) {
    if (!isActiveMerchant(merchantId, merchantRevision)) {
      console.error('[StorePublish] Stale publish failed', error);
      return { status: 'stale' };
    }
    throw error;
  } finally {
    setPublishingScope(null);
  }
}

export function useStorePublish({
  merchantId,
  onPublished,
}: UseStorePublishOptions) {
  const queryClient = useQueryClient();
  const activeMerchantScopeRef = useRef<MerchantScope>({
    merchantId: merchantId ?? null,
    revision: 0,
  });
  const [publishingScope, setPublishingScope] = useState<MerchantScope | null>(
    null
  );
  const inFlightPublishesRef = useRef(
    new Map<MerchantScope, Promise<StorePublishResult>>()
  );

  // A ref written during render leaks an abandoned concurrent render into an
  // already-committed screen. Only commit the active merchant once React has
  // committed that render, so an in-flight publish still belongs to the UI the
  // merchant can see.
  useLayoutEffect(() => {
    const activeMerchantId = merchantId ?? null;
    if (activeMerchantScopeRef.current.merchantId === activeMerchantId) return;
    activeMerchantScopeRef.current = {
      merchantId: activeMerchantId,
      revision: activeMerchantScopeRef.current.revision + 1,
    };
  }, [merchantId]);

  const clearPublishingScope = (submittedScope: MerchantScope) => {
    setPublishingScope((currentScope) =>
      currentScope?.merchantId === submittedScope.merchantId &&
      currentScope?.revision === submittedScope.revision
        ? null
        : currentScope
    );
  };

  function publishStore(): Promise<StorePublishResult> {
    if (!merchantId) {
      return Promise.reject(
        new Error('Merchant not loaded. Please try again.')
      );
    }

    const submittedScope = activeMerchantScopeRef.current;
    if (inFlightPublishesRef.current.has(submittedScope)) {
      return Promise.reject(new Error('A publish is already in progress.'));
    }

    const publish = executePublish({
      merchantId,
      merchantRevision: submittedScope.revision,
      isActiveMerchant: (submittedMerchantId, submittedMerchantRevision) =>
        activeMerchantScopeRef.current.merchantId === submittedMerchantId &&
        activeMerchantScopeRef.current.revision === submittedMerchantRevision,
      onPublished,
      queryClient,
      setPublishingScope: (scope) =>
        scope
          ? setPublishingScope(scope)
          : clearPublishingScope(submittedScope),
    });
    const trackedPublish = publish.finally(() => {
      if (inFlightPublishesRef.current.get(submittedScope) === trackedPublish) {
        inFlightPublishesRef.current.delete(submittedScope);
      }
    });
    inFlightPublishesRef.current.set(submittedScope, trackedPublish);
    return trackedPublish;
  }

  return {
    isPublishing:
      publishingScope?.merchantId === (merchantId ?? null) &&
      publishingScope?.revision === activeMerchantScopeRef.current.revision,
    publishStore,
  };
}
