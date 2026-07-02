'use client';

import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { ChunkRecoveryNotice } from '@/components/system/chunk-recovery-notice';
import { Button } from '@/components/ui/button';
import { useBoundaryErrorReport } from '@/hooks/use-boundary-error-report';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const recovering = useBoundaryErrorReport(error, {
    routeSurface: 'dashboard',
    logLabel: 'Dashboard error',
  });

  if (recovering) {
    return <ChunkRecoveryNotice />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="size-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle
            className="size-8 text-destructive"
            aria-hidden="true"
          />
        </div>

        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>

        <p className="text-muted-foreground mb-6">
          We encountered an error loading this page. This has been logged and
          we&apos;ll look into it.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 w-full text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Error details (dev only)
            </summary>
            <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-auto max-h-48">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
              {error.digest && `\n\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}

        <div className="flex gap-4">
          <Button onClick={reset} variant="default">
            <RefreshCw className="size-4 mr-2" aria-hidden="true" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <Home className="size-4 mr-2" aria-hidden="true" />
              Dashboard home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
