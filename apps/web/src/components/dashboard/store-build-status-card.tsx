'use client';
import type { StoreBuildStatus } from '@baci/shared';
import { CheckCircle2, Loader2, Pencil, Sparkles, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { isWebStoreReadiness } from './is-web-store-readiness';
import {
  addPendingMerchant,
  buildReadinessUrl,
  getFallbackProgress,
  getStatusAccent,
  getStatusLabel,
  readApplyResponse,
  removePendingMerchant,
} from './store-build-status-card-helpers';
import { StoreBuildStatusCardLoadingState } from './store-build-status-card-loading-state';

type Props = { merchantId?: string; onApplied?: () => void };
type ScopedStatus = { merchantId: string; value: StoreBuildStatus };
export function StoreBuildStatusCard({ merchantId, onApplied }: Props) {
  const [loadedStatus, setLoadedStatus] = useState<ScopedStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(merchantId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [applyingMerchantIds, setApplyingMerchantIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [staleDialogFor, setStaleDialogFor] = useState<string | null>(null);
  const activeMerchantId = useRef(merchantId);
  useLayoutEffect(() => {
    activeMerchantId.current = merchantId;
  }, [merchantId]);
  const { toast } = useToast();
  const status =
    loadedStatus?.merchantId === merchantId ? loadedStatus?.value : null;
  const applying = merchantId ? applyingMerchantIds.has(merchantId) : false;
  useEffect(() => {
    setLoadedStatus(null);
    setLoadError(null);
    setStaleDialogFor((current) => (current === merchantId ? current : null));
    setLoading(Boolean(merchantId));
    if (!merchantId) return;
    let active = true;
    fetch(buildReadinessUrl(merchantId), {
      credentials: 'include',
      ...(reloadToken > 0 ? { cache: 'no-store' } : {}),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load store build status');
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (
          !isWebStoreReadiness(payload) ||
          payload.merchantId !== merchantId
        ) {
          throw new Error('Invalid readiness payload');
        }
        if (active) {
          setLoadedStatus({ merchantId, value: payload.storeBuild });
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load store build status:', error);
        if (active) {
          setLoadError('Failed to load store build status.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
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
  const applyDraft = (force = false) => {
    if (!merchantId || !status?.latestJobId || !status.canApplyAiDraft) {
      toast({
        title: 'Cannot apply this AI design',
        description: 'You need builder edit access to replace the store draft.',
        variant: 'destructive',
      });
      return;
    }
    const submittedMerchantId = merchantId;
    setApplyingMerchantIds((current) =>
      addPendingMerchant(current, submittedMerchantId)
    );
    fetchWithCsrf(`/api/ai-jobs/${status.latestJobId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        force ? { merchantId, force: true } : { merchantId }
      ),
    })
      .then(async (response) => {
        const payload = await readApplyResponse(response);
        if (activeMerchantId.current !== submittedMerchantId) return;
        if (
          !force &&
          response.status === 409 &&
          payload.code === 'ai_draft_stale'
        ) {
          setStaleDialogFor(submittedMerchantId);
          return;
        }
        if (!response.ok) {
          throw new Error(
            payload.error || payload.message || 'Failed to apply AI design'
          );
        }
        setLoadedStatus((current) =>
          current?.merchantId === submittedMerchantId
            ? {
                ...current,
                value: {
                  ...current.value,
                  aiStatus: 'applied',
                  message: 'Your generated storefront is now editable.',
                },
              }
            : current
        );
        toast({
          title: 'AI design applied',
          description: 'The generated storefront is now your editable draft.',
        });
        onApplied?.();
      })
      .catch((error: unknown) => {
        if (activeMerchantId.current !== submittedMerchantId) return;
        console.error('Failed to apply AI storefront draft:', error);
        toast({
          title: 'Failed to apply AI design',
          description:
            error instanceof Error ? error.message : 'Please try again later.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setApplyingMerchantIds((current) =>
          removePendingMerchant(current, submittedMerchantId)
        );
      });
  };
  if (loading || loadError) {
    return (
      <StoreBuildStatusCardLoadingState
        loadError={loadError}
        loading={loading}
        onRetry={retryLoad}
      />
    );
  }
  if (!status || status.aiStatus === 'not_started') {
    return null;
  }
  const progress = getFallbackProgress(status.aiStatus);
  const canPreview =
    status.latestJobId && ['ready', 'applied'].includes(status.aiStatus);
  return (
    <>
      <Card className={cn('overflow-hidden', getStatusAccent(status.aiStatus))}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                {status.aiStatus === 'applied' ? (
                  <CheckCircle2 className="size-5 text-green-600" />
                ) : (
                  <Wand2 className="size-5 text-primary" />
                )}
                {getStatusLabel(status.aiStatus)}
              </CardTitle>
              <CardDescription className="mt-1">
                {status.message}
              </CardDescription>
            </div>
            {status.aiStatus === 'processing' && (
              <Loader2 className="size-5 animate-spin text-primary" />
            )}
          </div>
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Store build progress
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row">
          {canPreview && (
            <Button asChild variant="outline">
              <Link href={`/builder?aiDraftJobId=${status.latestJobId}`}>
                Preview
              </Link>
            </Button>
          )}
          {status.aiStatus === 'ready' && status.canApplyAiDraft && (
            <Button onClick={() => applyDraft()} disabled={applying}>
              {applying ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              Apply AI design
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href="/builder">
              <Pencil className="mr-2 size-4" />
              Edit starter store
            </Link>
          </Button>
        </CardFooter>
      </Card>
      <AlertDialog
        open={staleDialogFor === merchantId}
        onOpenChange={(open) =>
          setStaleDialogFor(open ? (merchantId ?? null) : null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your current draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Your starter draft changed after this AI design was generated.
              Applying it will replace the current starter draft with the AI
              design.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current draft</AlertDialogCancel>
            <AlertDialogAction onClick={() => applyDraft(true)}>
              Replace draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
