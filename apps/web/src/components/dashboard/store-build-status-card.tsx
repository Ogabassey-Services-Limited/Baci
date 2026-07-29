'use client';

import { isStoreReadiness, type StoreBuildStatus } from '@baci/shared';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  getFallbackProgress,
  getStatusAccent,
  getStatusLabel,
  readApplyResponse,
} from './store-build-status-card-helpers';

interface StoreBuildStatusCardProps {
  onApplied?: () => void;
}

export function StoreBuildStatusCard({ onApplied }: StoreBuildStatusCardProps) {
  const [status, setStatus] = useState<StoreBuildStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [applying, setApplying] = useState(false);
  const [showStaleDialog, setShowStaleDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // The retry button increments reloadToken to intentionally re-run this effect.
    void reloadToken;
    let active = true;

    fetch('/api/merchant/readiness', {
      credentials: 'include',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load store build status');
        }

        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isStoreReadiness(payload) || payload.surface !== 'web') {
          throw new Error('Invalid readiness payload');
        }

        if (active) {
          setStatus(payload.storeBuild);
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
  }, [reloadToken]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError(null);
    setReloadToken((token) => token + 1);
  };

  const applyDraft = (force = false) => {
    if (!status?.latestJobId || !status.canApplyAiDraft) {
      toast({
        title: 'Cannot apply this AI design',
        description: 'You need builder edit access to replace the store draft.',
        variant: 'destructive',
      });
      return;
    }

    setApplying(true);
    fetchWithCsrf(`/api/ai-jobs/${status.latestJobId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(force ? { force: true } : {}),
    })
      .then(async (response) => {
        const payload = await readApplyResponse(response);

        if (
          !force &&
          response.status === 409 &&
          payload.code === 'ai_draft_stale'
        ) {
          setShowStaleDialog(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            payload.error || payload.message || 'Failed to apply AI design'
          );
        }

        setStatus((current) =>
          current
            ? {
                ...current,
                aiStatus: 'applied',
                message: 'Your generated storefront is now editable.',
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
        console.error('Failed to apply AI storefront draft:', error);
        toast({
          title: 'Failed to apply AI design',
          description:
            error instanceof Error ? error.message : 'Please try again later.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setApplying(false);
      });
  };

  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Checking store build status…
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4" />
            {loadError}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={retryLoad}
          >
            <RefreshCw className="size-4 mr-1.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!status || status.aiStatus === 'not_started') {
    return null;
  }

  const progress = getFallbackProgress(status.aiStatus);
  const canPreview = Boolean(
    status.latestJobId &&
      (status.aiStatus === 'ready' || status.aiStatus === 'applied')
  );

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
      <AlertDialog open={showStaleDialog} onOpenChange={setShowStaleDialog}>
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
