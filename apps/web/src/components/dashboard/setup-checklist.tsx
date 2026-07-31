'use client';

import type { WebStoreReadiness } from '@baci/shared';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { requestMerchantPublish } from '@/lib/merchant-publish-client';
import { cn } from '@/lib/utils';
import { isWebStoreReadiness } from './is-web-store-readiness';
import { SetupChecklistDesktopCard } from './setup-checklist-desktop-card';
import { SetupChecklistMobileDrawer } from './setup-checklist-mobile-drawer';

interface SetupChecklistProps {
  merchantId?: string;
  onPublish?: () => void;
  compact?: boolean;
  dismissible?: boolean;
}

export function SetupChecklist({
  merchantId,
  onPublish,
  compact = false,
  dismissible = false,
}: SetupChecklistProps) {
  const { toast } = useToast();
  const [readiness, setReadiness] = useState<WebStoreReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const activeMerchantId = useRef(merchantId);
  activeMerchantId.current = merchantId;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('setup_complete')) return;

    params.delete('setup_complete');
    const query = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    );
    toast({
      title: 'Step Completed! 🎉',
      description: 'Great job! Moving to the next step.',
      className:
        'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/50 dark:border-green-800 dark:text-green-200',
    });
  }, [toast]);

  useEffect(() => {
    setReadiness(null);
    setLoadError(null);
    setPublishing(false);
    setDismissed(false);
    setShowAll(false);
    setIsSheetOpen(false);
    setLoading(Boolean(merchantId));
    if (!merchantId) return;

    let active = true;
    const cache: RequestCache = reloadToken > 0 ? 'reload' : 'no-store';

    fetch(
      `/api/merchant/readiness?merchantId=${encodeURIComponent(merchantId)}`,
      { cache }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to fetch readiness');
        const data: unknown = await response.json();
        if (!isWebStoreReadiness(data) || data.merchantId !== merchantId) {
          throw new Error('Invalid readiness payload');
        }
        if (active) {
          setReadiness(data);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to fetch readiness:', error);
        if (active) setLoadError('Failed to load your setup checklist.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [merchantId, reloadToken]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(null);
    setReloadToken((token) => token + 1);
  };

  const handlePublish = () => {
    if (
      !merchantId ||
      readiness?.merchantId !== merchantId ||
      !readiness.isReady
    ) {
      toast({
        variant: 'destructive',
        title: 'Cannot publish store',
        description: 'Please complete all required setup items first.',
      });
      return;
    }

    setPublishing(true);
    const submittedMerchantId = merchantId;
    requestMerchantPublish(submittedMerchantId, false)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to publish');
        if (activeMerchantId.current !== submittedMerchantId) return;
        toast({
          title: 'Store published!',
          description: 'Your store is now live and accepting orders.',
        });
        setReadiness((previous) =>
          previous?.merchantId === submittedMerchantId
            ? { ...previous, isPublished: true }
            : previous
        );
        onPublish?.();
        setIsSheetOpen(false);
      })
      .catch(() => {
        if (activeMerchantId.current !== submittedMerchantId) return;
        toast({
          variant: 'destructive',
          title: 'Failed to publish',
          description: 'Please try again later.',
        });
      })
      .finally(() => {
        if (activeMerchantId.current === submittedMerchantId) {
          setPublishing(false);
        }
      });
  };

  if (loading) return <SetupChecklistLoading compact={compact} />;
  if (loadError)
    return (
      <SetupChecklistLoadError
        compact={compact}
        error={loadError}
        onRetry={retryLoad}
      />
    );
  if (!readiness) return null;
  if (readiness.isPublished && readiness.isReady && dismissible && dismissed) {
    return null;
  }

  const incompleteItems = readiness.items.filter((item) => !item.completed);
  const displayItems = showAll
    ? readiness.items
    : compact
      ? incompleteItems.slice(0, 3)
      : incompleteItems;
  const requiredIncomplete = incompleteItems.filter(
    (item) => item.priority === 'required'
  );
  const checklistProps = {
    compact,
    displayItems,
    incompleteItems,
    readiness,
    requiredIncomplete,
    setShowAll,
    showAll,
  };

  return (
    <>
      <SetupChecklistMobileDrawer
        {...checklistProps}
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onPublish={handlePublish}
        publishing={publishing}
      />
      <SetupChecklistDesktopCard
        {...checklistProps}
        dismissible={dismissible}
        onDismiss={() => setDismissed(true)}
        onPublish={handlePublish}
        publishing={publishing}
      />
    </>
  );
}

function SetupChecklistLoading({ compact }: { compact: boolean }) {
  return (
    <Card className={cn(compact && 'border-0 shadow-none')}>
      <CardContent className="py-8">
        <div className="flex items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </CardContent>
    </Card>
  );
}

function SetupChecklistLoadError({
  compact,
  error,
  onRetry,
}: {
  compact: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <Card className={cn('border-destructive', compact && 'border shadow-none')}>
      <CardContent className="pt-6">
        <p className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="size-4" />
          {error}
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="mr-1.5 size-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function SetupChecklistCompact({ merchantId }: { merchantId?: string }) {
  return <SetupChecklist merchantId={merchantId} compact dismissible />;
}
