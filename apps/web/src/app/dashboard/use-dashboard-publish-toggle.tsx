'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { useToast } from '@/hooks/use-toast';
import { requestMerchantPublish } from '@/lib/merchant-publish-client';

type ToastFn = (
  props: Parameters<ReturnType<typeof useToast>['toast']>[0]
) => unknown;

interface UseDashboardPublishToggleOptions {
  isPublished: boolean | undefined | null;
  merchantId: string | undefined;
  refresh: () => void;
  /** Deliberately not invoked: this callback reloads the implicit merchant. */
  reloadMerchant: () => void;
  toast: ToastFn;
}

export function useDashboardPublishToggle({
  isPublished,
  merchantId,
  refresh,
  toast,
}: UseDashboardPublishToggleOptions) {
  const [publishingMerchantRequests, setPublishingMerchantRequests] = useState<
    Record<string, number>
  >({});
  const activeMerchantId = useRef(merchantId);
  useLayoutEffect(() => {
    activeMerchantId.current = merchantId;
  }, [merchantId]);

  const togglePublish = async () => {
    if (!merchantId) {
      toast({
        description: 'Reload the dashboard and try again.',
        title: 'Store unavailable',
        variant: 'destructive',
      });
      return;
    }

    const submittedMerchantId = merchantId;
    setPublishingMerchantRequests((current) => ({
      ...current,
      [submittedMerchantId]: (current[submittedMerchantId] ?? 0) + 1,
    }));

    try {
      const response = await requestMerchantPublish(
        submittedMerchantId,
        isPublished
      );
      const data = await response.json();

      if (activeMerchantId.current !== submittedMerchantId) return;

      if (!response.ok) {
        toast({
          description: data.missingItems?.join(', ') || data.message,
          title: data.error || 'Failed to update store status',
          variant: 'destructive',
        });
        return;
      }

      toast({
        description: isPublished
          ? 'Your store is now offline.'
          : 'Your store is now live and accessible to customers.',
        title: isPublished ? 'Store Unpublished' : 'Store Published!',
      });
      refresh();
    } catch (_error) {
      if (activeMerchantId.current !== submittedMerchantId) return;
      toast({
        description: 'Failed to update store status. Please try again.',
        title: 'Error',
        variant: 'destructive',
      });
    } finally {
      setPublishingMerchantRequests((current) => {
        const pendingRequestCount = current[submittedMerchantId] ?? 0;
        if (pendingRequestCount > 1) {
          return {
            ...current,
            [submittedMerchantId]: pendingRequestCount - 1,
          };
        }

        const next = { ...current };
        delete next[submittedMerchantId];
        return next;
      });
    }
  };

  return {
    isPublishing: Boolean(merchantId && publishingMerchantRequests[merchantId]),
    togglePublish,
  };
}
