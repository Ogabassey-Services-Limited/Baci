'use client';

import { AlertTriangle, RefreshCcw } from 'lucide-react';
import '@/app/globals.css';
import { useEffect } from 'react';
import { PlatformFooter } from '@/components/platform/footer';
import { PlatformHeader } from '@/components/platform/header';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Client-side application error:', error);
  }, [error]);

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans">
      <PlatformHeader />

      <main className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full shadow-lg space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              Something went wrong
            </h2>
            <p className="text-muted-foreground">
              We encountered an unexpected error while loading this page. Our
              team has been notified.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={reset}
              className="w-full flex items-center gap-2"
              size="lg"
            >
              <RefreshCcw className="w-4 h-4" />
              Try again
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full"
              size="lg"
            >
              Go home
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-4 bg-muted rounded-lg text-left overflow-auto max-h-48 text-xs font-mono">
              <p className="font-bold text-red-500 mb-2">
                {error.name}: {error.message}
              </p>
              <pre className="whitespace-pre-wrap">{error.stack}</pre>
            </div>
          )}
        </div>
      </main>

      <PlatformFooter />
    </div>
  );
}
